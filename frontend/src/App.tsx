import { useMemo } from 'react';
import { useSSE } from './hooks/useSSE';
import type { Snapshot } from './types';
import BatchProgress from './components/BatchProgress';
import Codex2apiHealth from './components/Codex2apiHealth';
import DeadList from './components/DeadList';

type SourceKey = keyof Snapshot['sources'];

const SOURCE_LABELS: Array<{ key: SourceKey; label: string }> = [
  { key: 'batch', label: '批次' },
  { key: 'codex2api', label: 'AT' },
  { key: 'callback', label: '回调' },
  { key: 'dead', label: '死号' },
];

function formatRelativeAge(epochMs?: number) {
  if (!epochMs) return '-';
  const diffMs = Math.max(0, Date.now() - epochMs);
  if (diffMs < 60_000) return `${Math.max(1, Math.round(diffMs / 1000))}秒前`;
  if (diffMs < 3_600_000) return `${Math.max(1, Math.round(diffMs / 60_000))}分钟前`;
  if (diffMs < 86_400_000) return `${Math.max(1, Math.round(diffMs / 3_600_000))}小时前`;
  return `${Math.max(1, Math.round(diffMs / 86_400_000))}天前`;
}

function formatLocalTime(epochMs?: number) {
  if (!epochMs) return '-';
  return new Date(epochMs).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatSnapshotTime(epochSeconds?: number) {
  if (!epochSeconds) return '-';
  return new Date(epochSeconds * 1000).toLocaleString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function HeroStat({
  label,
  value,
  tone = 'zinc',
}: {
  label: string;
  value: number | string;
  tone?: 'zinc' | 'emerald' | 'amber' | 'red' | 'sky' | 'violet';
}) {
  const toneCls = {
    zinc: 'text-zinc-900',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    sky: 'text-sky-600',
    violet: 'text-violet-600',
  }[tone];
  return (
    <div className="card px-5 py-4">
      <div className={`stat-num ${toneCls}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function LiveIndicator({ connected, lastTick }: { connected: boolean; lastTick: number }) {
  const ago = lastTick ? Math.max(0, Math.floor((Date.now() - lastTick) / 1000)) : null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected ? 'bg-emerald-500 animate-pulseSoft' : 'bg-amber-500 animate-pulseSoft'
        }`}
        aria-hidden
      />
      <span>{connected ? 'SSE 在线' : '轮询回退'}</span>
      {ago !== null && <span className="text-zinc-400">· {ago}秒前</span>}
    </div>
  );
}

function SourceChip({
  label,
  age,
  updatedAt,
  stale,
}: {
  label: string;
  age: string;
  updatedAt: string;
  stale: boolean;
}) {
  return (
    <span
      className={`status-chip ${stale ? 'danger' : 'blue'}`}
      title={updatedAt}
    >
      {label} · {age}
    </span>
  );
}

export default function App() {
  // 不传参，让 useSSE 用默认值（dev 相对走 vite proxy，prod 绝对到 http://127.0.0.1:8090）
  const { data, connected, error, lastTick } = useSSE<Snapshot>();

  const stats = useMemo(() => {
    if (!data) {
      return { total: 0, regOk: 0, ppOk: 0, plus: 0, failed: 0, active: 0, callbackOk: 0, callbackFail: 0 };
    }
    const acc = data.batch?.accounts ?? {};
    let total = 0;
    let regOk = 0;
    let ppOk = 0;
    let plus = 0;
    let failed = 0;
    let active = 0;
    for (const r of Object.values(acc)) {
      total += 1;
      if (r.register_ok) regOk += 1;
      if (r.paypal_ok) ppOk += 1;
      if (r.at_ok || r.local_plus_export) plus += 1;
      const stage = String(r.stage ?? '');
      const status = String(r.status ?? '');
      const isFailed = status === 'failed' || status === 'permanently_failed' || stage.endsWith('-failed');
      if (isFailed) failed += 1;
      if (!isFailed && !(r.at_ok || r.local_plus_export) && /register|checkout|paypal|callback/.test(stage)) {
        active += 1;
      }
    }
    const cbq = data.batch?.callback_queue ?? {};
    return {
      total,
      regOk,
      ppOk,
      plus,
      failed,
      active,
      callbackOk: cbq.success ?? 0,
      callbackFail: (cbq.failed ?? 0) + (cbq.permanently_failed ?? 0),
    };
  }, [data]);

  const freshness = useMemo(() => {
    const sourceMap = data?.sources ?? {};
    return SOURCE_LABELS.map((item) => {
      const raw = sourceMap[item.key];
      const epochMs = typeof raw === 'number' ? raw * 1000 : 0;
      const ageMs = epochMs ? Math.max(0, Date.now() - epochMs) : 0;
      return {
        ...item,
        updatedAt: epochMs ? formatLocalTime(epochMs) : '-',
        age: epochMs ? formatRelativeAge(epochMs) : '未写入',
        stale: !epochMs || ageMs > 2 * 60 * 60 * 1000,
      };
    });
  }, [data]);

  const staleSources = freshness.filter((item) => item.stale);
  const snapshotLabel = data?.ts ? formatSnapshotTime(data.ts) : '-';
  const batchUpdatedLabel = data?.batch?.updated_at ? formatLocalTime(Date.parse(data.batch.updated_at)) : '-';

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="brand">
            <div>
              <p className="brand-title">plus_paypal_auto 控制台</p>
              <p className="brand-subtitle">实时快照 · 数据新鲜度 · 后端 127.0.0.1:8090</p>
            </div>
          </div>
          <div className="header-actions">
            <LiveIndicator connected={connected} lastTick={lastTick} />
            <span className="status-chip">阶段 {data?.batch?.stage ?? '-'}</span>
            <span className="status-chip blue">批次 {batchUpdatedLabel}</span>
          </div>
        </div>
      </header>

      <main className="shell public-shell">
        <section className="page-header">
          <div>
            <h1>批次仪表盘</h1>
            <p>注册、支付、回调、AT 复活和死号清单集中展示。</p>
          </div>
          <div className="header-actions">
            <span className="status-chip blue">快照 {snapshotLabel}</span>
            {freshness.slice(0, 3).map((item) => (
              <SourceChip key={item.key} label={item.label} age={item.age} updatedAt={item.updatedAt} stale={item.stale} />
            ))}
          </div>
        </section>

        {staleSources.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            <span className="font-semibold">数据同步滞后</span>
            <span className="mx-2">·</span>
            <span>
              {staleSources.map((item) => `${item.label} ${item.age}`).join(' · ')}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 mb-5 md:grid-cols-4 lg:grid-cols-8">
          <HeroStat label="批次总数" value={stats.total} />
          <HeroStat label="注册成功" value={stats.regOk} tone="sky" />
          <HeroStat label="支付成功" value={stats.ppOk} tone="violet" />
          <HeroStat label="Plus 数" value={stats.plus} tone="emerald" />
          <HeroStat label="进行中" value={stats.active} tone="amber" />
          <HeroStat label="失败数" value={stats.failed} tone="red" />
          <HeroStat label="回调成功" value={stats.callbackOk} tone="emerald" />
          <HeroStat label="回调失败" value={stats.callbackFail} tone="red" />
        </section>

        <section className="mb-4">
          <BatchProgress batch={data?.batch} />
        </section>

        <section className="grid grid-cols-1 items-start gap-4 mb-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,2.05fr)]">
          <aside className="min-w-0 h-full [&>.card]:h-full">
            <Codex2apiHealth codex2api={data?.codex2api} />
          </aside>
          <div className="min-w-0 h-full [&>div]:h-full [&_.card]:h-full">
            <DeadList dead={data?.dead} callback={data?.callback} />
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-zinc-200 pt-4 text-[11px] text-zinc-500">
          <div className="flex flex-wrap gap-2">
            {freshness.map((item) => (
              <SourceChip key={item.key} label={item.label} age={item.age} updatedAt={item.updatedAt} stale={item.stale} />
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <span>后端 http://127.0.0.1:8090</span>
            <span>刷新 1.5s</span>
            <span>快照 {snapshotLabel}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
