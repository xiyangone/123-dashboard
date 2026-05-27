import { useMemo } from 'react';
import { useSSE } from './hooks/useSSE';
import type { Snapshot } from './types';
import BatchProgress from './components/BatchProgress';

type Tone = 'emerald' | 'amber' | 'red' | 'zinc';

const TONE_TEXT: Record<Tone, string> = {
  emerald: 'text-emerald-600',
  amber: 'text-amber-500',
  red: 'text-red-600',
  zinc: 'text-zinc-900',
};

const TONE_BAR: Record<Tone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  zinc: 'bg-zinc-300',
};

function Kpi({ label, value, tone, hint }: { label: string; value: number | string; tone: Tone; hint?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-num ${TONE_TEXT[tone]}`}>{value}</div>
      {hint !== undefined && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

function Bar({ label, done, total }: { label: string; done: number; total: number }) {
  const t = Math.max(0, total);
  const d = Math.min(Math.max(0, done), t);
  const pct = t === 0 ? 0 : Math.round((d / t) * 100);
  const tone: Tone = pct === 100 && t > 0 ? 'emerald' : pct > 0 ? 'amber' : 'zinc';
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className={`bar-fill ${TONE_BAR[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="bar-meta">
        <span className={`${TONE_TEXT[tone]} font-bold`}>{pct}%</span>
        <span className="text-zinc-400 tabular-nums">{d}/{t}</span>
      </div>
    </div>
  );
}

export default function App() {
  const { data, connected, error, lastTick } = useSSE<Snapshot>();

  const stats = useMemo(() => {
    const acc = data?.batch?.accounts ?? {};
    const cbMap = data?.callback ?? {};
    let total = 0, regOk = 0, ppOk = 0, cbOk = 0, plus = 0, failed = 0, active = 0, noTrial = 0;
    for (const [email, r] of Object.entries(acc)) {
      total += 1;
      if (r.register_ok) regOk += 1;
      if (r.paypal_ok) ppOk += 1;
      const cbEntry = cbMap[email];
      const cbDone = (r.at_ok || r.local_plus_export || cbEntry?.status === 'success') ?? false;
      if (cbDone) cbOk += 1;
      if (r.at_ok || r.local_plus_export) plus += 1;
      const stage = String(r.stage ?? '');
      const status = String(r.status ?? '');
      const isNoTrial = stage === 'paypal-failed-no-trial';
      const isFailed = status === 'failed' || status === 'permanently_failed' || (stage.endsWith('-failed') && !isNoTrial);
      if (isNoTrial) noTrial += 1;
      else if (isFailed) failed += 1;
      else if (!(r.at_ok || r.local_plus_export) && /register|checkout|paypal|callback/.test(stage)) active += 1;
    }
    if (total === 0 && data?.batch?.summary?.total) {
      const s = data.batch.summary;
      total = s.total ?? 0;
      plus = s.success ?? 0;
      cbOk = s.success ?? 0;
      failed = s.failed ?? 0;
      regOk = Math.max(0, total - (s.pending_register ?? 0));
      ppOk = (s.success ?? 0) + (s.pp_done_pending_callback ?? 0);
      active = (s.pending_register ?? 0) + (s.registered_pending_pp ?? 0) + (s.pp_done_pending_callback ?? 0);
    }
    return { total, regOk, ppOk, cbOk, plus, failed, active, noTrial };
  }, [data]);

  const lastTickAgo = lastTick ? Math.max(0, Math.floor((Date.now() - lastTick) / 1000)) : null;
  const batchUpdated = data?.batch?.updated_at ?? '';
  const accountsFile = data?.batch?.accounts_file ?? '';

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="brand-mark" aria-hidden>进</span>
            <h1 className="brand-title whitespace-nowrap">进度面板</h1>
            {accountsFile && (
              <span className="brand-sub min-w-0 truncate" title={accountsFile}>
                <span className="text-zinc-400">来源</span>
                <span className="ml-1.5 font-semibold text-zinc-700">{accountsFile}</span>
              </span>
            )}
          </div>
          <div className="topbar-meta flex items-center gap-1.5 whitespace-nowrap">
            <span className={`sse-dot ${connected ? 'online' : 'fallback'}`} aria-hidden />
            <span className="font-semibold text-zinc-700">{connected ? '已连接' : '轮询中'}</span>
            {lastTickAgo !== null && <span className="text-zinc-400">· {lastTickAgo}s 前</span>}
          </div>
        </div>
      </header>

      <main className="shell main-area">
        {error && !connected && (
          <div className="alert">{error}</div>
        )}

        <section className="kpi-grid">
          <Kpi label="升级成功" value={stats.plus} tone="emerald" hint={`/ 总数 ${stats.total}`} />
          <Kpi label="进行中" value={stats.active} tone={stats.active > 0 ? 'amber' : 'zinc'} />
          <Kpi
            label="失败"
            value={stats.failed}
            tone={stats.failed > 0 ? 'red' : 'zinc'}
            hint={stats.noTrial > 0 ? `含无试用 ${stats.noTrial}` : undefined}
          />
          <Kpi label="批次总数" value={stats.total} tone="zinc" />
        </section>

        <section className="card p-6 space-y-4">
          <Bar label="注册" done={stats.regOk} total={stats.total} />
          <Bar label="支付" done={stats.ppOk} total={stats.total} />
          <Bar label="回调" done={stats.cbOk} total={stats.total} />
          <Bar label="升级" done={stats.plus} total={stats.total} />
        </section>

        <BatchProgress batch={data?.batch} />

        <footer className="footer-bar">
          <span>后端 127.0.0.1:8090</span>
          <span>·</span>
          <span>刷新 1.5 秒</span>
          <span>·</span>
          <span>批次更新 {batchUpdated || '-'}</span>
        </footer>
      </main>
    </div>
  );
}
