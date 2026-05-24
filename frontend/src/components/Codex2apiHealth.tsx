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

function statusPill(status: string) {
  const cls = STATUS_TONE[status] ?? 'bg-zinc-50 text-zinc-500 ring-zinc-200';
  return (
    <span className={`pill ring-1 ring-inset ${cls}`}>{status || '-'}</span>
  );
}

function shortEmail(s: string | undefined, width: number = 26) {
  if (!s) return '-';
  const name = s.split('@')[0];
  return name.length <= width ? name : name.slice(0, width - 3) + '...';
}

export default function Codex2apiHealth({ codex2api }: { codex2api?: Codex2apiProgress }) {
  const p = codex2api ?? {};
  const accounts = p.accounts ?? {};
  const events = (p.events ?? []).slice(-6).reverse();
  const total = p.total ?? Object.keys(accounts).length;
  const healthy = p.healthy ?? 0;
  const pct = total > 0 ? Math.round((healthy / total) * 100) : 0;

  const visible = Object.entries(accounts).filter(([, r]) => {
    const s = String(r.status ?? '');
    return s !== 'pending';
  });

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900">codex2api · AT 测活</h2>
          <span className="text-[11px] text-zinc-500">{p.stage ?? '-'}</span>
        </div>
        <div className="text-[11px] text-zinc-500 mb-1">健康度</div>
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-zinc-700">
            {healthy}/{total}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3 text-[11px] tabular-nums">
          <span>救活 <span className="text-emerald-600">{p.revived ?? 0}</span></span>
          <span>清理 <span className="text-zinc-700">{p.cleaned ?? 0}</span></span>
          <span>死号 <span className="text-red-600">{p.dead ?? 0}</span></span>
          <span>失败 <span className="text-red-600">{p.failed ?? 0}</span></span>
        </div>
        {p.current_email && (
          <div className="text-[11px] text-zinc-500 mt-2">
            当前: <span className="text-zinc-900">{shortEmail(p.current_email, 34)}</span>
          </div>
        )}
      </div>

      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="th w-10 text-right">#</th>
              <th className="th">账号</th>
              <th className="th w-20">状态</th>
              <th className="th">原因</th>
              <th className="th w-14">plan</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="td text-zinc-500" colSpan={5}>
                  暂无非 pending 账号 …
                </td>
              </tr>
            ) : (
              visible.slice(0, 30).map(([email, r], idx) => (
                <tr key={email} className="row">
                  <td className="td text-right text-zinc-500">{idx + 1}</td>
                  <td className="td">
                    <span title={email} className="text-zinc-900">{shortEmail(email)}</span>
                  </td>
                  <td className="td">{statusPill(String(r.status ?? '-'))}</td>
                  <td className="td">
                    <span className="text-zinc-500 truncate inline-block max-w-[14rem]" title={r.reason ?? ''}>
                      {r.reason ?? '-'}
                    </span>
                  </td>
                  <td className="td">
                    <span className="text-emerald-600">{r.planType ?? '-'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {events.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50/60">
          <div className="text-[11px] text-zinc-500 mb-1.5">最近事件</div>
          <ul className="space-y-1">
            {events.map((ev, i) => (
              <li key={i} className="text-[11px] flex items-baseline gap-2">
                <span className="text-zinc-400 tabular-nums">{(ev.at ?? '').slice(11, 19)}</span>
                <span className="text-zinc-600 truncate">{shortEmail(ev.email, 18)}</span>
                <span className="text-zinc-500 truncate">{ev.message ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
