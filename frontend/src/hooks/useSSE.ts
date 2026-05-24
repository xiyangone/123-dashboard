import { useEffect, useRef, useState } from 'react';

export interface SSEState<T> {
  data: T | null;
  connected: boolean;
  error: string | null;
  lastTick: number;
}

/**
 * 优先用 SSE；端点不可达时回退到 1.5s 轮询 /api/snapshot。
 *
 * Dev (vite 5173) 用相对路径，vite proxy 转 8090；
 * Build/Tauri portable 在 tauri://localhost 协议下相对路径会变成 tauri://localhost/sse → 404，
 * 必须显式绝对到 http://127.0.0.1:8090（backend 已开 CORS allow_origins=["*"]）。
 */
const BACKEND_PREFIX = import.meta.env.PROD ? 'http://127.0.0.1:8090' : '';

export function useSSE<T = unknown>(
  url: string = `${BACKEND_PREFIX}/sse`,
  fallback: string = `${BACKEND_PREFIX}/api/snapshot`,
): SSEState<T> {
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
