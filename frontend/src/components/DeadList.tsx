import type { DeadAccount, CallbackState } from '../types';

function fmtTs(ts?: number) {
  if (!ts) return '-';
  try {
    return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return '-';
  }
}

function titleText(value: string | number | undefined) {
  return value === undefined || value === null || value === '' ? '-' : String(value);
}

function cleanReason(reason?: string) {
  if (!reason) return '-';
  return reason
    .replace(/（[^）]*(同|模式|款)[^）]*）/g, '')
    .replace(/\([^)]*(same|like|pattern)[^)]*\)/gi, '')
    .replace(/，?\s*同\s*[^，。；;]*?(同款|模式)/g, '')
    .replace(/\s+/g, ' ')
    .trim() || '-';
}

const wrapText = 'block whitespace-normal break-words leading-5';

const STATUS_LABEL: Record<string, string> = {
  success: '成功',
  failed: '失败',
  permanently_failed: '永久失败',
  running: '进行中',
  pending: '等待',
};

function statusPill(status: string | undefined) {
  const s = status ?? '';
  if (s === 'success') {
    return <span className="pill bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">{STATUS_LABEL[s]}</span>;
  }
  if (s === 'failed' || s === 'permanently_failed') {
    return <span className="pill bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">{STATUS_LABEL[s]}</span>;
  }
  if (s === 'running' || s === 'pending') {
    return <span className="pill bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">{STATUS_LABEL[s]}</span>;
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
            总数 <span className="text-red-600">{deadList.length}</span>
          </span>
        </div>
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-left">
            <thead>
              <tr>
                <th className="th w-[22%]">账号</th>
                <th className="th w-[30%]">标记时间</th>
                <th className="th w-[38%]">原因</th>
                <th className="th w-[10%] text-center">锁定</th>
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
                      <span className={`${wrapText} text-zinc-900`} title={d.email ?? ''}>
                        {(d.email ?? '-').split('@')[0]}
                      </span>
                    </td>
                    <td className="td text-zinc-500">
                      <span className={wrapText} title={d.marked_at ?? ''}>
                        {d.marked_at ?? '-'}
                      </span>
                    </td>
                    <td className="td">
                      <span className={`${wrapText} text-zinc-500`} title={d.reason ?? ''}>
                        {cleanReason(d.reason)}
                      </span>
                    </td>
                    <td className="td text-center">
                      {d.do_not_retry ? (
                        <span className="pill bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">锁定</span>
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
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900">回调概览</h2>
          <div className="text-[11px] text-zinc-500 flex gap-3">
            <span>总数 <span className="text-zinc-900">{cbEntries.length}</span></span>
            <span>失败 <span className="text-red-600">{cbFailed.length}</span></span>
          </div>
        </div>
        <div className="px-4 py-2 text-[11px] text-zinc-500 bg-zinc-50/60 border-b border-zinc-200">
          最近成功
        </div>
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-left">
            <thead>
              <tr>
                <th className="th w-[24%]">账号</th>
                <th className="th w-[30%]">成功时间</th>
                <th className="th w-[18%]">状态</th>
                <th className="th w-[14%]">套餐</th>
                <th className="th w-[14%]">ID</th>
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
                      <span className={`${wrapText} text-zinc-900`} title={email}>
                        {email.split('@')[0]}
                      </span>
                    </td>
                    <td className="td text-zinc-500">
                      <span className={wrapText} title={fmtTs(v.succeeded_at)}>
                        {fmtTs(v.succeeded_at)}
                      </span>
                    </td>
                    <td className="td">{statusPill(v.status)}</td>
                    <td className="td text-emerald-600">
                      <span className={wrapText} title={v.plan_type || '-'}>
                        {v.plan_type || '-'}
                      </span>
                    </td>
                    <td className="td text-zinc-500">
                      <span className={wrapText} title={titleText(v.account_id)}>
                        {titleText(v.account_id)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {cbFailed.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] text-zinc-500 bg-zinc-50/60 border-y border-zinc-200">
              失败记录
            </div>
            <ul className="max-h-40 overflow-y-auto overflow-x-hidden divide-y divide-zinc-100">
              {cbFailed.map(([email, v]) => (
                <li key={email} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] gap-3 px-4 py-2 text-[12px]">
                  <span className={`${wrapText} text-zinc-900`} title={email}>{email.split('@')[0]}</span>
                  <span className={`${wrapText} text-red-600`} title={v.last_error ?? ''}>
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
