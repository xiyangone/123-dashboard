import type { BatchProgress as BatchType, BatchAccount } from '../types';

const STAGE_LABELS: Record<string, string> = {
  'account-start': '开始',
  'dead-account-skipped': '死号跳过',
  'failed-no-retry': '失败跳过',
  success: '成功',
  startup: '初始化',
  final: '收尾中',
  'post-callback-workers': '回调补救',
  'drain-complete': '该批已清空',
  'final-drain': '尾轮清空',
  'post-account': '账号收尾',
  'paypal-requeued': '支付重排',
  'callback-pending': '待回调',
  'registered-pending-pp': '待支付',
  'callback-running': '回调中',
  'callback-failed': '回调失败',
  registered: '已注册',
  registering: '注册中',
  'confirm-existing': '确认已存在',
  'register-failed': '注册失败',
  'checkout-link': '长链中',
  'token-failed': '取 AT 失败',
  'checkout-failed': '长链失败',
  'paypal-running': '支付中',
  'paypal-retry-queued': '支付重排',
  'paypal-failed': '支付失败',
  'paypal-failed-no-trial': '无试用',
  'callback-queued': '回调排队',
};

type StepState = 'done' | 'failed' | 'active' | 'todo';
type StepKey = 'reg' | 'link' | 'pp' | 'cb';

const STEP_NAMES: Record<StepKey, string> = {
  reg: '注册',
  link: '长链',
  pp: '支付',
  cb: '回调',
};

function shortEmail(s: string | undefined) {
  if (!s) return '-';
  return s.split('@')[0];
}

const wrapText = 'block whitespace-normal break-words leading-5';

function isNoTrial(r: BatchAccount): boolean {
  return String(r.stage ?? '') === 'paypal-failed-no-trial';
}

function isFailed(r: BatchAccount): boolean {
  const status = String(r.status ?? '');
  const stage = String(r.stage ?? '');
  // paypal-failed-no-trial 视为终止态（红点显示，但通过 isNoTrial 单独计数）
  if (stage === 'paypal-failed-no-trial') return true;
  return status === 'failed' || status === 'permanently_failed' || stage.endsWith('-failed');
}

function isTerminalSuccess(r: BatchAccount): boolean {
  return Boolean(r.at_ok || r.local_plus_export);
}

function stepState(r: BatchAccount, step: StepKey): StepState {
  const stage = String(r.stage ?? '');
  const failed = isFailed(r);

  if (step === 'reg') {
    if (r.register_ok) return 'done';
    if (failed && stage.includes('register')) return 'failed';
    return stage.includes('register') ? 'active' : 'todo';
  }
  if (step === 'link') {
    if (r.checkout_url) return 'done';
    if (failed && (stage.includes('checkout') || stage.includes('token'))) return 'failed';
    if (stage.includes('checkout') || stage.includes('token-failed')) return 'active';
    return 'todo';
  }
  if (step === 'pp') {
    if (r.paypal_ok) return 'done';
    if (failed && stage.includes('paypal')) return 'failed';
    if (stage.includes('paypal')) return 'active';
    return 'todo';
  }
  // cb
  if (isTerminalSuccess(r)) return 'done';
  if (failed && stage.includes('callback')) return 'failed';
  if (r.paypal_ok || stage.includes('callback')) return 'active';
  return 'todo';
}

function activeStepInfo(r: BatchAccount): { step: StepKey | null; tone: 'active' | 'failed' | 'done'; label: string } {
  const steps: StepKey[] = ['reg', 'link', 'pp', 'cb'];
  // 先找 failed
  for (const k of steps) {
    if (stepState(r, k) === 'failed') {
      return { step: k, tone: 'failed', label: STAGE_LABELS[String(r.stage ?? '')] ?? String(r.stage ?? '') };
    }
  }
  // 再找 active
  for (const k of steps) {
    if (stepState(r, k) === 'active') {
      const stage = String(r.stage ?? '');
      let label = STAGE_LABELS[stage] ?? stage;
      // 支付阶段附带 attempt 计数
      if (k === 'pp') {
        const cur = r.paypal_attempt ?? r.paypal_attempts_done ?? 0;
        const tot = r.paypal_attempts_total ?? 0;
        if (tot > 0) label = `${label} ${cur}/${tot}`;
      }
      return { step: k, tone: 'active', label };
    }
  }
  // 都 done
  if (isTerminalSuccess(r)) {
    return { step: 'cb', tone: 'done', label: '已完成' };
  }
  return { step: null, tone: 'active', label: '-' };
}

function PipelineCell({ r }: { r: BatchAccount }) {
  const steps: StepKey[] = ['reg', 'link', 'pp', 'cb'];
  const info = activeStepInfo(r);
  return (
    <div className="pipe">
      {steps.map((k, i) => {
        const st = stepState(r, k);
        return (
          <span key={k} className="inline-flex items-center">
            <span className={`pipe-step ${st}`}>
              <span className="pipe-dot" />
              {STEP_NAMES[k]}
            </span>
            {i < steps.length - 1 && <span className="pipe-sep mx-1">›</span>}
          </span>
        );
      })}
      {info.label && info.label !== '-' && (
        <span className={`pipe-meta ${info.tone}`}>{info.label}</span>
      )}
    </div>
  );
}

const QUEUE_STAGES: Record<string, string> = {
  'callback-queued': '回调队列',
  'callback-pending': '回调待发',
  'paypal-retry-queued': '支付重排',
  'paypal-requeued': '支付重排',
  'registered-pending-pp': '待支付',
  'pending_register': '待注册',
};

function isQueuedStage(stage: string): boolean {
  return stage in QUEUE_STAGES;
}

function computeQueuePositions(list: [string, BatchAccount][]): Record<string, { type: string; pos: number; total: number }> {
  const buckets: Record<string, string[]> = {};
  for (const [email, r] of list) {
    const stage = String(r.stage ?? '');
    if (!isQueuedStage(stage)) continue;
    if (!buckets[stage]) buckets[stage] = [];
    buckets[stage].push(email);
  }
  const out: Record<string, { type: string; pos: number; total: number }> = {};
  for (const [stage, emails] of Object.entries(buckets)) {
    const total = emails.length;
    emails.forEach((email, idx) => {
      out[email] = { type: QUEUE_STAGES[stage] ?? stage, pos: idx + 1, total };
    });
  }
  return out;
}

interface RunningEntry {
  email: string;
  worker: string;
  stage: string;
  label: string;
  step: StepKey | null;
  updated_at?: string;
}

function collectRunning(list: [string, BatchAccount][]): RunningEntry[] {
  const out: RunningEntry[] = [];
  for (const [email, r] of list) {
    if (isTerminalSuccess(r)) continue;
    if (isFailed(r)) continue;
    const stage = String(r.stage ?? '');
    if (!stage || stage === 'success' || isQueuedStage(stage)) continue;
    const info = activeStepInfo(r);
    if (info.step === null) continue;
    out.push({
      email,
      worker: r.worker_tag ?? '-',
      stage,
      label: info.label,
      step: info.step,
      updated_at: r.updated_at,
    });
  }
  // 按 worker 排序，再按 updated_at desc
  out.sort((a, b) => {
    if (a.worker !== b.worker) return a.worker.localeCompare(b.worker);
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });
  return out;
}

function NowRunning({ entries }: { entries: RunningEntry[] }) {
  // 按 step 分桶用于头部计数：注/长/付/回 各几个
  const stepCounts: Record<StepKey, number> = { reg: 0, link: 0, pp: 0, cb: 0 };
  for (const e of entries) {
    if (e.step) stepCounts[e.step] += 1;
  }
  const total = entries.length;

  return (
    <div className="now-running">
      <div className="now-running-head">
        <span className="now-running-title">现在在跑</span>
        <span className="now-running-count">
          <b>{total}</b> 个
          {total > 0 && (
            <span className="ml-2 text-zinc-400">
              注 {stepCounts.reg} · 长 {stepCounts.link} · 付 {stepCounts.pp} · 回 {stepCounts.cb}
            </span>
          )}
        </span>
      </div>
      {total === 0 ? (
        <div className="nr-empty">空闲 — 没有账号正在跑</div>
      ) : (
        <div className="nr-grid">
          {entries.map((e) => (
            <div key={e.email} className="nr-row" title={`${e.email} · ${e.stage}`}>
              <span className="nr-dot" aria-hidden />
              <span className="nr-worker">{e.worker}</span>
              <span className="nr-email">{shortEmail(e.email)}</span>
              <span className="nr-arrow">›</span>
              <span className="nr-stage">{e.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function attemptText(r: BatchAccount) {
  const current = r.paypal_attempt ?? r.paypal_attempts_done ?? 0;
  const total = r.paypal_attempts_total ?? 0;
  const ppText = total > 0 ? `${current}/${total}` : String(current);
  return `${ppText} · ${r.oauth_attempts ?? 0}`;
}

function QueueOrAttempt({ r, queuePos }: { r: BatchAccount; queuePos?: { type: string; pos: number; total: number } }) {
  if (queuePos) {
    return (
      <span className="queue-pill" title={`${queuePos.type} 第 ${queuePos.pos} / ${queuePos.total}`}>
        {queuePos.type} <b>#{queuePos.pos}</b>/{queuePos.total}
      </span>
    );
  }
  return (
    <span
      className={`${wrapText} text-zinc-500 tabular-nums`}
      title={`roxy=${r.roxy_dir_id || '-'} ws=${r.roxy_ws || '-'}`}
    >
      {attemptText(r)}
    </span>
  );
}

export default function BatchProgress({ batch }: { batch?: BatchType }) {
  const accounts = batch?.accounts ?? {};
  const list = Object.entries(accounts);
  const summary = batch?.summary ?? {};
  const cbq = batch?.callback_queue ?? {};

  const workerTags = (batch?.workers ?? []).map((w) => w.tag).join(' · ') || '-';
  const running = collectRunning(list);
  const queuePositions = computeQueuePositions(list);
  const noTrialCount = list.filter(([, r]) => isNoTrial(r)).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-zinc-200">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-wide text-zinc-900">账号明细</h2>
          <p className="mt-1 text-[11px] text-zinc-500 truncate">来源 {batch?.accounts_file ?? '-'}</p>
        </div>
        <div className="text-[11px] text-zinc-500 text-right whitespace-nowrap">
          执行器 <span className="font-semibold text-zinc-700">{workerTags}</span>
        </div>
      </div>

      <NowRunning entries={running} />

      <div className="grid grid-cols-2 gap-x-5 gap-y-2 px-5 py-3 border-b border-zinc-200 bg-zinc-50/60 text-[11px] tabular-nums sm:grid-cols-7">
        <span className="text-zinc-500 font-semibold uppercase tracking-wider">汇总</span>
        <span>总 <span className="text-zinc-900 font-bold">{summary.total ?? 0}</span></span>
        <span>成 <span className="text-emerald-600 font-bold">{summary.success ?? 0}</span></span>
        <span>待回调 <span className="text-amber-600 font-bold">{summary.pp_done_pending_callback ?? 0}</span></span>
        <span>待支付 <span className="text-amber-600 font-bold">{summary.registered_pending_pp ?? 0}</span></span>
        <span>失败 <span className="text-red-600 font-bold">{summary.failed ?? 0}</span></span>
        <span>无试用 <span className="text-zinc-700 font-bold">{noTrialCount}</span></span>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-2 px-5 py-3 border-b border-zinc-200 text-[11px] tabular-nums sm:grid-cols-6">
        <span className="text-zinc-500 font-semibold uppercase tracking-wider">回调队列</span>
        <span>队列 <span className="text-zinc-900 font-bold">{cbq.queue_size ?? 0}</span></span>
        <span>就绪 <span className="text-zinc-900 font-bold">{cbq.ready_queue_size ?? 0}</span></span>
        <span>冷却 <span className="text-zinc-900 font-bold">{cbq.cooldown_queue_size ?? 0}</span></span>
        <span>运行 <span className="text-amber-600 font-bold">{cbq.running ?? 0}</span></span>
        <span>
          成 <span className="text-emerald-600 font-bold">{cbq.success ?? 0}</span> / 失{' '}
          <span className="text-red-600 font-bold">{cbq.failed ?? 0}</span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr>
              <th className="th w-[4%] text-right">#</th>
              <th className="th w-[16%]">账号</th>
              <th className="th w-[12%]">母号组</th>
              <th className="th w-[6%]">W</th>
              <th className="th w-[34%]">流水线</th>
              <th className="th w-[14%]">AT</th>
              <th className="th w-[14%]">支付/排队</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td className="td text-zinc-500" colSpan={7}>
                  等待 batch_progress.json …
                </td>
              </tr>
            ) : (
              list.map(([email, r], idx) => (
                <tr key={email} className="row">
                  <td className="td text-right text-zinc-400 tabular-nums">{idx + 1}</td>
                  <td className="td">
                    <span className={`${wrapText} font-semibold text-zinc-900`} title={email}>
                      {shortEmail(email)}
                    </span>
                  </td>
                  <td className="td">
                    <span className={`${wrapText} text-zinc-500`} title={r.group_key ?? '-'}>
                      {r.group_key ?? '-'}
                    </span>
                  </td>
                  <td className="td">
                    <span className="pill bg-zinc-100 text-zinc-700">{r.worker_tag ?? '-'}</span>
                  </td>
                  <td className="td">
                    <PipelineCell r={r} />
                  </td>
                  <td className="td">
                    {r.codex2api_id ? (
                      <span className={`${wrapText} tabular-nums`} title={`#${r.codex2api_id} ${r.codex2api_plan || '-'}`}>
                        <span className="text-zinc-500">#</span>
                        <span className="text-zinc-900 font-semibold">{r.codex2api_id}</span>
                        <span className="ml-1.5 text-emerald-600 font-semibold">{r.codex2api_plan || '-'}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="td">
                    <QueueOrAttempt r={r} queuePos={queuePositions[email]} />
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
