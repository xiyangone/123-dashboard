# plus_paypal_auto · live dashboard

替代旧的 pwsh `watch_batch_progress.py` 文本面板。后端汇总本地 JSON，前端 React + Tailwind 浅色仪表盘，SSE 1.5s 实时刷新。

## 端口

- 后端 FastAPI: `http://127.0.0.1:8090`
- 前端 Vite dev: `http://127.0.0.1:5173`

## 启动 exe

```pwsh
Z:\123\dashboard\dist-release\portable\dashboard-tauri.exe
```

portable 目录需要同时包含：

- `dashboard-tauri.exe`
- `uvicorn-app.exe`

主 exe 会自动拉起后端 sidecar，不需要再开两个 pwsh 窗口。

## 开发调试

```pwsh
cd Z:\123\dashboard
pwsh -File .\start.ps1
```

也可以手动分别跑：

```pwsh
# 后端
cd Z:\123\dashboard\backend
Z:\123\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8090 --reload

# 前端
cd Z:\123\dashboard\frontend
npm run dev
```

打开 <http://127.0.0.1:5173> 即可调试 Vite 页面。

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
  "phone_inuse": { /* 兼容字段，当前 UI 不展示 */ },
  "phone_exhausted": [ /* 兼容字段，当前 UI 不展示 */ ],
  "callback": { /* callback_state.json */ },
  "dead": [ /* pp_failed_accounts.json */ ]
}
```

## 数据源

| 字段           | 文件                                            |
|----------------|-------------------------------------------------|
| batch          | `Z:/123/plus_paypal_auto/batch_progress.json`   |
| codex2api      | `Z:/123/_mcp_tmp/codex2api_progress.json`       |
| phone_inuse    | `Z:/123/_mcp_tmp/phone_pool_inuse.json` (兼容保留，当前 UI 不展示) |
| phone_exhausted| `Z:/123/_mcp_tmp/phone_pool_exhausted.json` (兼容保留，当前 UI 不展示) |
| callback       | `Z:/123/plus_paypal_auto/callback_state.json`   |
| dead           | `Z:/123/pp_failed_accounts.json`                |

任一文件缺失或解析失败时，对应字段安全降级为 `{}` 或 `[]`，前端会自然显示空态。

## 界面

- 顶部指标：批次总数、注册成功、支付成功、Plus 数、进行中、失败数、回调成功、回调失败
- 主面板：全宽批次进度（注册/支付/回调三条进度 + 汇总条 + 回调队列条 + 回调运行中 + 账号明细表）
- 次级面板：AT 测活与复活（处理进度、健康结果、复活尝试、状态明细、最近事件）
- 明细面板：死号清单 + 回调概览（最近成功 + 失败明细）
- 右上角 pulse 圆点：`emerald` = SSE live，`amber` = 已回退轮询
- 全局：浅色工作台风格，卡片白底、细边框、状态 chip 和 `tabular-nums` 数字对齐

## 进度同步

- `batch_pipeline.py` 在注册失败、token 失败、checkout 链接失败、PayPal 重试排队、无 trial、最终 PayPal 失败时都会立刻刷新 `batch_progress.json`。
- PayPal attempt 会写入 `paypal_attempt`、`paypal_attempts_total`、`paypal_attempts_done`，并尽量从子进程日志回填 `roxy_dir_id` / `roxy_ws`。
- AT 复活进度来自 `Z:/123/_mcp_tmp/codex2api_progress.json`，前端展示 `processed`、`current_email`、`revive_attempted`、`revived`、`events` 与异常账号明细。

## 调试

- 后端无数据：单独 GET `http://127.0.0.1:8090/api/snapshot`，确认 `batch`、`codex2api`、`callback`、`dead` 等键存在。
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
│           └── DeadList.tsx
├── start.ps1
└── README.md
```
