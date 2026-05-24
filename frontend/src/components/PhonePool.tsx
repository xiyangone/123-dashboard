import type { PhoneInUse, PhoneExhausted } from '../types';

function fmtAge(at?: number) {
  if (!at) return '-';
  const sec = Math.max(0, Math.floor(Date.now() / 1000 - at));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

export default function PhonePool({
  inUse,
  exhausted,
}: {
  inUse?: Record<string, PhoneInUse>;
  exhausted?: PhoneExhausted[];
}) {
  const inUseList = Object.entries(inUse ?? {});
  const exhaustedList = (exhausted ?? []).slice(-8).reverse();
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-900">手机号池</h2>
        <div className="text-[11px] text-zinc-500">
          in_use=<span className="text-zinc-900">{inUseList.length}</span>{' '}
          · exhausted=<span className="text-amber-600">{exhaustedList.length}</span>
        </div>
      </div>

      <div>
        <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-50/60 border-b border-zinc-200">
          In Use
        </div>
        {inUseList.length === 0 ? (
          <div className="px-4 py-3 text-[12px] text-zinc-500">空闲，无锁定号码。</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {inUseList.map(([phone, info]) => (
              <li key={phone} className="px-4 py-2 flex items-center justify-between text-[12px]">
                <span className="text-zinc-900 tabular-nums">{phone}</span>
                <span className="text-zinc-500 truncate max-w-[16rem]">{info.label ?? '-'}</span>
                <span className="text-zinc-400 tabular-nums">{fmtAge(info.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-50/60 border-y border-zinc-200">
          Exhausted (最近)
        </div>
        {exhaustedList.length === 0 ? (
          <div className="px-4 py-3 text-[12px] text-zinc-500">尚无耗尽事件。</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {exhaustedList.map((it, i) => (
              <li key={i} className="px-4 py-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-zinc-900 truncate">{it.email ?? it.label ?? '-'}</span>
                  <span className="text-zinc-400 tabular-nums">
                    {typeof it.at === 'number' ? fmtAge(it.at) : String(it.at ?? '-')}
                  </span>
                </div>
                <div className="text-zinc-500 truncate">
                  used: {(it.used_phones ?? []).join(', ') || '-'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
