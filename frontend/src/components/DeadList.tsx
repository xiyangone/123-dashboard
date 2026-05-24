import type { DeadAccount, CallbackState } from '../types';

function fmtTs(ts?: number) {
  if (!ts) return '-';
  try {
    return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return '-';
  }
}

function statusPill(status: string | undefined) {
  const s = status ?? '';
  if (s === 'success') {
    return <span className="pill bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">{s}</span>;
  }
  if (s === 'failed' || s === 'permanently_failed') {
    return <span className="pill bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">{s}</span>;
  }
  if (s === 'running' || s === 'pending') {
    return <span className="pill bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">{s}</span>;
  }
  return <span className="pill bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200">{s || '-'}</span>;
}

export default function DeadList({
  dead,
  callback,
}: {
  dead?: DeadAccount[];
  callback?: Record<string, CallbackState>;
}) {
  const deadList = dead ?? [];
  const cbEntries = Object.entries(callback ?? {});
  const cbFailed = cbEntries.filter(([, v]) => v.status === 'failed' || v.status === 'permanently_failed');
  const cbRecent = cbEntries
    .filter(([, v]) => v.status === 'success' && v.succeeded_at)
    .sort((a, b) => (b[1].succeeded_at ?? 0) - (a[1].succeeded_at ?? 0))
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900">死号清单</h2>
          <span className="text-[11px] text-zinc-500">
            total = <span className="text-red-600">{deadList.length}</span>
          </span>
        </div>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="th">账号</th>
                <th className="th w-44">标记时间</th>
                <th className="th">原因</th>
                <th className="th w-14 text-center">不重试</th>
              </tr>
            </thead>
            <tbody>
              {deadList.length === 0 ? (
                <tr>
                  <td className="td text-zinc-500" colSpan={4}>
                    无死号记录。
                  </td>
                </tr>
              ) : (
                deadList.map((d, i) => (
                  <tr key={(d.email ?? '') + i} className="row">
                    <td className="td">
                      <span className="text-zinc-900" title={d.email ?? ''}>
                        {(d.email ?? '-').split('@')[0]}
                      </span>
                    </td>
                    <td className="td text-zinc-500">{d.marked_at ?? '-'}</td>
                    <td className="td">
                      <span className="text-zinc-500 truncate inline-block max-w-[24rem]" title={d.reason ?? ''}>
                        {d.reason ?? '-'}
                      </span>
                    </td>
                    <td className="td text-center">
                      {d.do_not_retry ? (
                        <span className="pill bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">YES</span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900">callback_state 概览</h2>
          <div className="text-[11px] text-zinc-500 flex gap-3">
            <span>total = <span className="text-zinc-900">{cbEntries.length}</span></span>
            <span>failed = <span className="text-red-600">{cbFailed.length}</span></span>
          </div>
        </div>
        <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-50/60 border-b border-zinc-200">
          最近成功（succeeded_at desc）
        </div>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="th">账号</th>
                <th className="th w-44">成功时间</th>
                <th className="th w-20">状态</th>
                <th className="th w-20">plan</th>
                <th className="th w-20">acct_id</th>
              </tr>
            </thead>
            <tbody>
              {cbRecent.length === 0 ? (
                <tr>
                  <td className="td text-zinc-500" colSpan={5}>
                    暂无成功记录。
                  </td>
                </tr>
              ) : (
                cbRecent.map(([email, v]) => (
                  <tr key={email} className="row">
                    <td className="td">
                      <span className="text-zinc-900" title={email}>
                        {email.split('@')[0]}
                      </span>
                    </td>
                    <td className="td text-zinc-500">{fmtTs(v.succeeded_at)}</td>
                    <td className="td">{statusPill(v.status)}</td>
                    <td className="td text-emerald-600">{v.plan_type || '-'}</td>
                    <td className="td text-zinc-500">{v.account_id || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {cbFailed.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-50/60 border-y border-zinc-200">
              失败记录
            </div>
            <ul className="max-h-40 overflow-auto divide-y divide-zinc-100">
              {cbFailed.map(([email, v]) => (
                <li key={email} className="px-4 py-2 text-[12px] flex justify-between">
                  <span className="text-zinc-900">{email.split('@')[0]}</span>
                  <span className="text-red-600 truncate max-w-[20rem]" title={v.last_error ?? ''}>
                    {v.last_error ?? v.status ?? '-'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
