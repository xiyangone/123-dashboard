import { useMemo } from 'react';
import { useSSE } from './hooks/useSSE';
import type { Snapshot } from './types';
import BatchProgress from './components/BatchProgress';
import Codex2apiHealth from './components/Codex2apiHealth';
import PhonePool from './components/PhonePool';
import DeadList from './components/DeadList';

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
    <div className="flex items-center gap-2 text-[11px] tracking-wider text-zinc-500 uppercase">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected ? 'bg-emerald-500 animate-pulseSoft' : 'bg-amber-500 animate-pulseSoft'
        }`}
        aria-hidden
      />
      <span>{connected ? 'live · sse' : 'polling fallback'}</span>
      {ago !== null && <span className="text-zinc-400">· {ago}s ago</span>}
    </div>
  );
}

export default function App() {
  const { data, connected, error, lastTick } = useSSE<Snapshot>('/sse', '/api/snapshot');

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

  return (
    <div className="min-h-full px-6 py-5 max-w-[1600px] mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-wide">
            <span className="text-zinc-900">plus_paypal_auto</span>{' '}
            <span className="text-zinc-500">· live dashboard</span>
          </h1>
          <span className="text-[11px] text-zinc-500">
            stage = <span className="text-zinc-700">{data?.batch?.stage ?? '-'}</span>
          </span>
          <span className="text-[11px] text-zinc-500">
            updated = <span className="text-zinc-700">{data?.batch?.updated_at ?? '-'}</span>
          </span>
        </div>
        <LiveIndicator connected={connected} lastTick={lastTick} />
      </header>

      {error && (
        <div className="mb-3 px-3 py-2 text-[12px] rounded-md border border-amber-300 bg-amber-50 text-amber-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
        <HeroStat label="批次总数" value={stats.total} />
        <HeroStat label="注册成功" value={stats.regOk} tone="sky" />
        <HeroStat label="PP 成功" value={stats.ppOk} tone="violet" />
        <HeroStat label="Plus 数" value={stats.plus} tone="emerald" />
        <HeroStat label="进行中" value={stats.active} tone="amber" />
        <HeroStat label="失败数" value={stats.failed} tone="red" />
        <HeroStat label="回调成功" value={stats.callbackOk} tone="emerald" />
        <HeroStat label="回调失败" value={stats.callbackFail} tone="red" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2">
          <BatchProgress batch={data?.batch} />
        </div>
        <div className="space-y-4">
          <Codex2apiHealth codex2api={data?.codex2api} />
          <PhonePool inUse={data?.phone_inuse} exhausted={data?.phone_exhausted} />
        </div>
      </section>

      <section className="mb-4">
        <DeadList dead={data?.dead} callback={data?.callback} />
      </section>

      <footer className="text-[11px] text-zinc-500 pt-4 border-t border-zinc-200">
        <span className="mr-4">backend = http://127.0.0.1:8090</span>
        <span className="mr-4">refresh = 1.5s</span>
        <span>data files = batch_progress.json · codex2api_progress.json · phone_pool · callback_state.json · pp_failed_accounts.json</span>
      </footer>
    </div>
  );
}
