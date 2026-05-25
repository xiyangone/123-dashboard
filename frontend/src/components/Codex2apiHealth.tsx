import type { Codex2apiProgress } from '../types';

const STATUS_TONE: Record<string, string> = {
  healthy: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  revived: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cleaned: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  checking: 'bg-amber-50 text-amber-700 ring-amber-200',
  reviving: 'bg-amber-50 text-amber-700 ring-amber-200',
  cleaning: 'bg-amber-50 text-amber-700 ring-amber-200',
  dead: 'bg-red-50 text-red-700 ring-red-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  skipped: 'bg-zinc-50 text-zinc-500 ring-zinc-200',
  pending: 'bg-zinc-50 text-zinc-500 ring-zinc-200',
};

const STATUS_LABEL: Record<string, string> = {
  healthy: '健康',
  revived: '已复活',
  cleaned: '已清理',
  checking: '检测中',
  reviving: '复活中',
  cleaning: '清理中',
  dead: '失效',
  failed: '失败',
  skipped: '跳过',
  pending: '等待',
};

const wrapText = 'block whitespace-normal break-words leading-5';

function statusPill(status: string) {
  const cls = STATUS_TONE[status] ?? 'bg-zinc-50 text-zinc-500 ring-zinc-200';
  const label = STATUS_LABEL[status] ?? (status || '-');
  return (
    <span className={`pill ring-1 ring-inset ${cls}`}>{label}</span>
  );
}

function shortEmail(s: string | undefined, width: number = 30) {
  if (!s) return '-';
  const name = s.split('@')[0];
  return name.length <= width ? name : name;
}

function formatDeleted(value: number[] | string | undefined) {
  if (Array.isArray(value)) return value.length ? value.join(',') : '-';
  return value ? String(value) : '-';
}

function ProgressBar({ value, total, tone = 'emerald' }: { value: number; total: number; tone?: 'emerald' | 'sky' }) {
  const t = Math.max(0, total);
  const v = Math.min(Math.max(0, value), t);
  const pct = t === 0 ? 0 : Math.round((v / t) * 100);
  const cls = tone === 'sky' ? 'from-sky-500 to-sky-300' : 'from-emerald-500 to-emerald-300';
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full bg-gradient-to-r ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-[11px] tabular-nums text-zinc-600">
        {v}/{t}
      </span>
    </div>
  );
}

export default function Codex2apiHealth({ codex2api }: { codex2api?: Codex2apiProgress }) {
  const p = codex2api ?? {};
  const accounts = p.accounts ?? {};
  const events = (p.events ?? []).slice(-8).reverse();
  const total = p.total ?? Object.keys(accounts).length;
  const processed = p.processed ?? 0;
  const healthy = p.healthy ?? 0;
  const reviveAttempted = p.revive_attempted ?? 0;

  const visible = Object.entries(accounts).filter(([, r]) => {
    const s = String(r.status ?? '');
    return s !== 'pending' && s !== 'healthy';
  });

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900">AT 测活与复活</h2>
          <span className="status-chip h-8 min-h-8">{p.stage ?? '-'}</span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
              <span>处理进度</span>
              {p.current_email && <span title={p.current_email}>当前 {shortEmail(p.current_email, 34)}</span>}
            </div>
            <ProgressBar value={processed} total={total} tone="sky" />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-zinc-500">健康结果</div>
            <ProgressBar value={healthy} total={total} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] tabular-nums">
          <span>复活尝试 <span className="text-sky-600">{reviveAttempted}</span></span>
          <span>已复活 <span className="text-emerald-600">{p.revived ?? 0}</span></span>
          <span>清理 <span className="text-zinc-700">{p.cleaned ?? 0}</span></span>
          <span>死号 <span className="text-red-600">{p.dead ?? 0}</span></span>
          <span>失败 <span className="text-red-600">{p.failed ?? 0}</span></span>
          <span>跳过 <span className="text-zinc-700">{p.skipped ?? 0}</span></span>
        </div>
      </div>

      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr>
              <th className="th w-[8%] text-right">#</th>
              <th className="th w-[28%]">账号</th>
              <th className="th w-[18%]">状态</th>
              <th className="th w-[34%]">原因</th>
              <th className="th w-[12%]">清理</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="td text-zinc-500" colSpan={5}>
                  暂无待复活或异常账号。
                </td>
              </tr>
            ) : (
              visible.slice(0, 16).map(([email, r], idx) => (
                <tr key={email} className="row">
                  <td className="td text-right text-zinc-500">{idx + 1}</td>
                  <td className="td">
                    <span title={email} className={`${wrapText} text-zinc-900`}>{shortEmail(email)}</span>
                  </td>
                  <td className="td">{statusPill(String(r.status ?? '-'))}</td>
                  <td className="td">
                    <span className={`${wrapText} text-zinc-500`} title={r.reason ?? ''}>
                      {r.reason ?? '-'}
                    </span>
                  </td>
                  <td className="td">
                    <span className={`${wrapText} text-zinc-500`} title={formatDeleted(r.deletedStaleIds)}>
                      {formatDeleted(r.deletedStaleIds)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {events.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50/60">
          <div className="mb-1.5 text-[11px] text-zinc-500">最近事件</div>
          <ul className="space-y-1.5">
            {events.map((ev, i) => (
              <li key={i} className="grid grid-cols-[44px_minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2 text-[11px]">
                <span className="text-zinc-400 tabular-nums">{(ev.at ?? '').slice(11, 19) || '-'}</span>
                <span className={`${wrapText} text-zinc-600`} title={ev.email ?? ''}>{shortEmail(ev.email, 18)}</span>
                <span className={`${wrapText} text-zinc-500`} title={ev.message ?? ''}>{ev.message ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
