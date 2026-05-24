import { useEffect, useRef, useState } from 'react';

export interface SSEState<T> {
  data: T | null;
  connected: boolean;
  error: string | null;
  lastTick: number;
}

/**
 * 优先用 SSE；端点不可达时回退到 1.5s 轮询 /api/snapshot。
 * 5173 端口下的 /sse 走 Vite proxy；生产或独立 8090 也兼容。
 */
export function useSSE<T = unknown>(url: string = '/sse', fallback: string = '/api/snapshot'): SSEState<T> {
  const [state, setState] = useState<SSEState<T>>({
    data: null,
    connected: false,
    error: null,
    lastTick: 0,
  });
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;

    const startPolling = () => {
      const tick = async () => {
        if (closed) return;
        try {
          const r = await fetch(fallback);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = (await r.json()) as T;
          setState((s) => ({ ...s, data: j, connected: false, error: null, lastTick: Date.now() }));
        } catch (err) {
          setState((s) => ({ ...s, error: String((err as Error).message ?? err) }));
        }
        if (!closed) {
          pollTimer.current = window.setTimeout(tick, 1500);
        }
      };
      tick();
    };

    try {
      es = new EventSource(url);
      es.addEventListener('snapshot', (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as T;
          setState({ data: parsed, connected: true, error: null, lastTick: Date.now() });
        } catch (e) {
          setState((s) => ({ ...s, error: 'parse error' }));
        }
      });
      es.onmessage = (ev) => {
        // sse-starlette 默认事件名 'message'，也兜底处理
        try {
          const parsed = JSON.parse(ev.data) as T;
          setState({ data: parsed, connected: true, error: null, lastTick: Date.now() });
        } catch {
          /* swallow */
        }
      };
      es.onerror = () => {
        if (closed) return;
        setState((s) => ({ ...s, connected: false, error: 'SSE 断开，已回退轮询' }));
        es?.close();
        es = null;
        if (!pollTimer.current) startPolling();
      };
    } catch (err) {
      setState((s) => ({ ...s, error: 'SSE 不可用，使用轮询' }));
      startPolling();
    }

    return () => {
      closed = true;
      es?.close();
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [url, fallback]);

  return state;
}
