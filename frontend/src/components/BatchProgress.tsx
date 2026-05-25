import type { BatchProgress as BatchType, BatchAccount } from '../types';

const STAGE_LABELS: Record<string, string> = {
  'account-start': '开始',
  'dead-account-skipped': '死号跳过',
  'failed-no-retry': '失败跳过',
  success: '成功',
  'callback-pending': '待回调',
  'registered-pending-pp': '待支付',
  'callback-running': '回调中',
  'callback-failed': '回调失败',
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
  'callback-queued': '回调排队',
};

function shortEmail(s: string | undefined, width: number = 30) {
  if (!s) return '-';
  const name = s.split('@')[0];
  return name.length <= width ? name : name;
}

const wrapText = 'block whitespace-normal break-words leading-5';
const wrapPill = '!whitespace-normal break-words leading-5 h-auto min-h-[22px] py-1 text-left';

function StepPill({ label, state }: { label: string; state: 'done' | 'failed' | 'active' | 'todo' }) {
  const cls = {
    done: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    failed: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    active: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    todo: 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200',
  }[state];
  const sym = { done: '完成', failed: '失败', active: '进行', todo: '等待' }[state];
  return <span className={`pill ${cls}`}>{label}:{sym}</span>;
}

function stepState(r: BatchAccount, step: 'reg' | 'pp' | 'cb'): 'done' | 'failed' | 'active' | 'todo' {
  const stage = String(r.stage ?? '');
  const status = String(r.status ?? '');
  const failed = status === 'failed' || status === 'permanently_failed' || stage.endsWith('-failed');
  if (step === 'reg') {
    if (r.register_ok) return 'done';
    if (failed && stage.includes('register')) return 'failed';
    return stage.includes('register') ? 'active' : 'todo';
  }
  if (step === 'pp') {
    if (r.paypal_ok) return 'done';
    if (failed && (stage.includes('paypal') || r.checkout_url)) return 'failed';
    if (r.checkout_url || stage.includes('paypal') || stage.includes('checkout')) return 'active';
    return 'todo';
  }
  // cb
  if (r.at_ok || r.local_plus_export) return 'done';
  if (failed && stage.includes('callback')) return 'failed';
  if (r.paypal_ok || stage.includes('callback')) return 'active';
  return 'todo';
}

function stageBadge(stage: string) {
  if (!stage || stage === '-') return <span className="text-zinc-500">-</span>;
  const label = STAGE_LABELS[stage] ?? stage;
  if (stage === 'success') {
    return <span className={`pill max-w-full ${wrapPill} bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200`}>{label}</span>;
  }
  if (stage.endsWith('-failed')) {
    return <span className={`pill max-w-full ${wrapPill} bg-red-50 text-red-700 ring-1 ring-inset ring-red-200`}>{label}</span>;
  }
  return <span className={`pill max-w-full ${wrapPill} bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200`}>{label}</span>;
}

function attemptText(r: BatchAccount) {
  const current = r.paypal_attempt ?? r.paypal_attempts_done ?? 0;
  const total = r.paypal_attempts_total ?? 0;
  const ppText = total > 0 ? `${current}/${total}` : String(current);
  return `支付 ${ppText} / 回调 ${r.oauth_attempts ?? 0}`;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const t = Math.max(0, total);
  const d = Math.min(Math.max(0, done), t);
  const pct = t === 0 ? 0 : Math.round((d / t) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-44 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-zinc-500">{d}/{t}</span>
    </div>
  );
}

export default function BatchProgress({ batch }: { batch?: BatchType }) {
  const accounts = batch?.accounts ?? {};
  const list = Object.entries(accounts);
  const summary = batch?.summary ?? {};
  const cbq = batch?.callback_queue ?? {};
  const groups = batch?.callback_groups ?? {};
  const activeGroups = Object.entries(groups).filter(([, g]) => {
    const status = String(g.status ?? '');
    return Boolean(g.error) || (status !== '' && status !== 'done' && status !== 'idle');
  });

  let total = 0,
    reg = 0,
    pp = 0,
    cb = 0;
  for (const [, r] of list) {
    total += 1;
    if (r.register_ok) reg += 1;
    if (r.paypal_ok) pp += 1;
    if (r.at_ok || r.local_plus_export) cb += 1;
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900">批次进度</h2>
          <span className="mt-1 block break-all text-[11px] text-zinc-500">来源 {batch?.accounts_file ?? '-'}</span>
        </div>
        <div className="shrink-0 text-right text-[11px] text-zinc-500">
          执行器{' '}
          <span className="text-zinc-700">{(batch?.workers ?? []).map((w) => w.tag).join(' · ') || '-'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-zinc-200 bg-zinc-50/60 px-4 py-3 md:grid-cols-3">
        <div>
          <div className="text-[11px] text-zinc-500 mb-1">注册</div>
          <ProgressBar done={reg} total={total} />
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 mb-1">支付</div>
          <ProgressBar done={pp} total={total} />
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 mb-1">回调</div>
          <ProgressBar done={cb} total={total} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-zinc-200 px-4 py-2 text-[11px] tabular-nums md:grid-cols-6">
        <span className="text-zinc-500">汇总</span>
        <span>总 <span className="text-zinc-900">{summary.total ?? 0}</span></span>
        <span>成 <span className="text-emerald-600">{summary.success ?? 0}</span></span>
        <span>待回调 <span className="text-amber-600">{summary.pp_done_pending_callback ?? 0}</span></span>
        <span>待支付 <span className="text-amber-600">{summary.registered_pending_pp ?? 0}</span></span>
        <span>失败 <span className="text-red-600">{summary.failed ?? 0}</span></span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-zinc-200 px-4 py-2 text-[11px] tabular-nums md:grid-cols-6">
        <span className="text-zinc-500">回调队列</span>
        <span>队列 <span className="text-zinc-900">{cbq.queue_size ?? 0}</span></span>
        <span>就绪 <span className="text-zinc-900">{cbq.ready_queue_size ?? 0}</span></span>
        <span>冷却 <span className="text-zinc-900">{cbq.cooldown_queue_size ?? 0}</span></span>
        <span>运行 <span className="text-amber-600">{cbq.running ?? 0}</span></span>
        <span>
          成 <span className="text-emerald-600">{cbq.success ?? 0}</span>{' '}
          / 失 <span className="text-red-600">{cbq.failed ?? 0}</span>
        </span>
      </div>

      {activeGroups.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-200 bg-zinc-50/60">
          <div className="text-[11px] text-zinc-500 mb-1">回调运行中</div>
          <div className="flex flex-wrap gap-1.5">
            {activeGroups.map(([k, g]) => (
              <span
                key={k}
                className={`pill ${
                  g.error
                    ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'
                    : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
                }`}
                title={`worker=${g.worker_tag} current=${g.current_email || '-'} updated=${g.updated_at || '-'}`}
              >
                {k}:{STAGE_LABELS[String(g.status ?? '')] ?? g.status ?? '-'}:{g.worker_tag ?? '-'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr>
              <th className="th w-[4%] text-right">#</th>
              <th className="th w-[14%]">账号</th>
              <th className="th w-[13%]">母号组</th>
              <th className="th w-[7%]">W</th>
              <th className="th w-[29%]">流水线</th>
              <th className="th w-[13%]">阶段</th>
              <th className="th w-[12%]">AT</th>
              <th className="th w-[8%]">尝试</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td className="td text-zinc-500" colSpan={8}>
                  等待 batch_progress.json …
                </td>
              </tr>
            ) : (
              list.map(([email, r], idx) => (
                <tr key={email} className="row">
                  <td className="td text-right text-zinc-500">{idx + 1}</td>
                  <td className="td">
                    <span className={`${wrapText} text-zinc-900`} title={email}>
                      {shortEmail(email)}
                    </span>
                  </td>
                  <td className="td text-zinc-500">
                    <span className={wrapText} title={r.group_key ?? '-'}>
                      {r.group_key ?? '-'}
                    </span>
                  </td>
                  <td className="td">
                    <span className="pill bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200">
                      {r.worker_tag ?? '-'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <StepPill label="注册" state={stepState(r, 'reg')} />
                      <span className="text-zinc-400">→</span>
                      <StepPill label="支付" state={stepState(r, 'pp')} />
                      <span className="text-zinc-400">→</span>
                      <StepPill label="回调" state={stepState(r, 'cb')} />
                    </div>
                  </td>
                  <td className="td">
                    <span className={wrapText} title={String(r.stage ?? r.status ?? '-')}>
                      {stageBadge(String(r.stage ?? r.status ?? '-'))}
                    </span>
                  </td>
                  <td className="td">
                    {r.codex2api_id ? (
                      <span className={`${wrapText} text-zinc-700`} title={`#${r.codex2api_id} ${r.codex2api_plan || '-'}`}>
                        #{r.codex2api_id}{' '}
                        <span className="text-emerald-600">{r.codex2api_plan || '-'}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="td">
                    <span className={`${wrapText} text-zinc-500`} title={`roxy=${r.roxy_dir_id || '-'} ws=${r.roxy_ws || '-'}`}>
                      {attemptText(r)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
