import { useMemo } from 'react';
import { useSSE } from './hooks/useSSE';
import type { Snapshot } from './types';
import BatchProgress from './components/BatchProgress';
import Codex2apiHealth from './components/Codex2apiHealth';

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

const STAGE_TOP_LABELS: Record<string, string> = {
  startup: '初始化',
  final: '收尾中',
  'post-callback-workers': '回调补救',
  'callback-running': '回调进行中',
  'callback-failed': '回调失败',
  'callback-queued': '回调排队',
  'callback-pending': '待回调',
  registered: '已注册',
  registering: '注册中',
  'confirm-existing': '确认已存在',
  'register-failed': '注册失败',
  'checkout-link': '生成链接',
  'token-failed': '取 AT 失败',
  'checkout-failed': '链接失败',
  'paypal-running': '支付中',
  'paypal-retry-queued': '等待重试',
  'paypal-failed': '支付失败',
  'paypal-failed-no-trial': '无试用',
  'paypal-requeued': '支付重排',
  'drain-complete': '该批已清空',
  'final-drain': '尾轮清空',
  'post-account': '账号收尾',
  success: '已完成',
};

function localizeStage(raw: string): string {
  if (!raw || raw === '-') return '-';
  // 格式可能是 "W1:foo@mail.com:callback-running:1/3" 这种复合 key
  const parts = raw.split(':');
  if (parts.length >= 3) {
    const worker = parts[0];
    const email = parts[1];
    const tail = parts.slice(2).join(':');
    const tailKey = tail.split(':')[0] ?? tail;
    const label = STAGE_TOP_LABELS[tailKey];
    const local = email.split('@')[0];
    if (label) {
      return `${worker} · ${local} · ${label}${tail.includes(':') ? ' ' + tail.split(':').slice(1).join(':') : ''}`;
    }
    return `${worker} · ${local} · ${tail}`;
  }
  return STAGE_TOP_LABELS[raw] ?? raw;
}

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
    let total = 0, regOk = 0, ppOk = 0, cbOk = 0, plus = 0, failed = 0, active = 0;
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
      const isFailed = status === 'failed' || status === 'permanently_failed' || stage.endsWith('-failed');
      if (isFailed) failed += 1;
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
    return { total, regOk, ppOk, cbOk, plus, failed, active };
  }, [data]);

  const lastTickAgo = lastTick ? Math.max(0, Math.floor((Date.now() - lastTick) / 1000)) : null;
  const batchUpdated = data?.batch?.updated_at ?? '';
  const rawStage = data?.batch?.stage ?? '-';
  const stage = localizeStage(rawStage);

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="flex items-baseline gap-3 min-w-0 flex-1">
            <h1 className="brand-title whitespace-nowrap">plus_paypal_auto</h1>
            <span className="topbar-stage min-w-0">
              <span className="text-zinc-400">阶段</span>
              <span className="ml-1.5 font-bold text-zinc-900 truncate" title={rawStage}>{stage}</span>
            </span>
          </div>
          <div className="topbar-meta flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulseSoft`}
              aria-hidden
            />
            <span>{connected ? 'SSE 在线' : '轮询回退'}</span>
            {lastTickAgo !== null && <span className="text-zinc-400">· {lastTickAgo}s</span>}
          </div>
        </div>
      </header>

      <main className="shell main-area">
        {error && !connected && (
          <div className="alert">{error}</div>
        )}

        <section className="kpi-grid">
          <Kpi label="Plus" value={stats.plus} tone="emerald" hint={`/ 总数 ${stats.total}`} />
          <Kpi label="进行中" value={stats.active} tone={stats.active > 0 ? 'amber' : 'zinc'} />
          <Kpi label="失败" value={stats.failed} tone={stats.failed > 0 ? 'red' : 'zinc'} />
          <Kpi label="批次总数" value={stats.total} tone="zinc" />
        </section>

        <section className="card p-6 space-y-4">
          <Bar label="注册" done={stats.regOk} total={stats.total} />
          <Bar label="支付" done={stats.ppOk} total={stats.total} />
          <Bar label="回调" done={stats.cbOk} total={stats.total} />
          <Bar label="Plus" done={stats.plus} total={stats.total} />
        </section>

        <BatchProgress batch={data?.batch} />

        <Codex2apiHealth codex2api={data?.codex2api} />

        <footer className="footer-bar">
          <span>后端 http://127.0.0.1:8090</span>
          <span>·</span>
          <span>刷新 1.5s</span>
          <span>·</span>
          <span>batch_progress {batchUpdated || '-'}</span>
        </footer>
      </main>
    </div>
  );
}
