# plus_paypal_auto · live dashboard

替代旧的 pwsh `watch_batch_progress.py` 文本面板。后端读 6 份本地 JSON，前端 React + Tailwind 暗色仪表盘，SSE 1.5s 实时刷新。

## 端口

- 后端 FastAPI: `http://127.0.0.1:8090`
- 前端 Vite dev: `http://127.0.0.1:5173`

## 启动

```pwsh
cd Z:\123\dashboard

# 首次：装依赖
Z:\123\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend; npm install; cd ..

# 一键启动（开两个独立 pwsh 子窗口）
pwsh -File .\start.ps1
```

或者手动分别跑：

```pwsh
# 后端
cd Z:\123\dashboard\backend
Z:\123\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8090 --reload

# 前端
cd Z:\123\dashboard\frontend
npm run dev
```

打开 <http://127.0.0.1:5173> 即可。

## API 端点

| 端点                | 用途                                  |
|---------------------|---------------------------------------|
| `GET /api/health`   | 健康检查                              |
| `GET /api/snapshot` | 一次性返回当前合并快照（JSON）        |
| `GET /sse`          | Server-Sent Events，每 1.5s 推一份快照 |

`/sse` 事件名为 `snapshot`，`data` 字段是 JSON 字符串：

```jsonc
{
  "ts": 1779600920.27,
  "sources": { "batch": 1779600907.0, "codex2api": 1779591884.0, ... },
  "batch": { /* batch_progress.json 原样 */ },
  "codex2api": { /* codex2api_progress.json 原样 */ },
  "phone_inuse": { /* phone_pool_inuse.json */ },
  "phone_exhausted": [ /* phone_pool_exhausted.json，可不存在 */ ],
  "callback": { /* callback_state.json */ },
  "dead": [ /* pp_failed_accounts.json */ ]
}
```

## 数据源

| 字段           | 文件                                            |
|----------------|-------------------------------------------------|
| batch          | `Z:/123/plus_paypal_auto/batch_progress.json`   |
| codex2api      | `Z:/123/_mcp_tmp/codex2api_progress.json`       |
| phone_inuse    | `Z:/123/_mcp_tmp/phone_pool_inuse.json`         |
| phone_exhausted| `Z:/123/_mcp_tmp/phone_pool_exhausted.json` (可缺) |
| callback       | `Z:/123/plus_paypal_auto/callback_state.json`   |
| dead           | `Z:/123/pp_failed_accounts.json`                |

任一文件缺失或解析失败时，对应字段安全降级为 `{}` 或 `[]`，前端会自然显示空态。

## 界面

- 顶部 hero stats：批次总数、注册成功、PP 成功、Plus 数、进行中、失败数、回调成功、回调失败
- 左大表：批次进度（注册/PayPal/回调 三条 progress + 汇总条 + 回调队列条 + 回调池 + 账号明细表）
- 右上：codex2api AT 测活（健康度条 + 状态明细 + 最近事件）
- 右下：手机号池（In Use + Exhausted）
- 底部：死号清单 + callback_state 概览（最近成功 + 失败明细）
- 右上角 pulse 圆点：`emerald` = SSE live，`amber` = 已回退轮询
- 全局：`bg-ink-950 (#070708)`，卡片 `bg-ink-850 (#101013)`，`font-mono` + `tabular-nums` 解决中英混排对齐

## 调试

- 后端无数据：单独 GET `http://127.0.0.1:8090/api/snapshot`，确认 6 个键全部存在。
- 前端连不上 SSE：检查 8090 是否监听（`Get-NetTCPConnection -LocalPort 8090`），Vite proxy 已把 `/sse` 转发到 8090。
- `pyright` 校验：本仓库 `pyproject.toml` 已配置；后端代码遵循当前 Python 3.13 venv。
- 端口冲突：改 `backend/main.py` 末尾 `port=8090`，以及 `frontend/vite.config.ts` 的 `port: 5173` 和 proxy target。

## 文件清单

```
Z:/123/dashboard/
├── backend/
│   ├── main.py
│   ├── snapshot.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── types.ts
│       ├── hooks/useSSE.ts
│       └── components/
│           ├── BatchProgress.tsx
│           ├── Codex2apiHealth.tsx
│           ├── PhonePool.tsx
│           └── DeadList.tsx
├── start.ps1
└── README.md
```
