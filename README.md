# plus_paypal_auto · live dashboard

进度可视化**唯一入口**（2026-05-26 起，旧终端 `watch_batch_progress.py` 与 Rust `progress_rs/` 已全部删除）。后端汇总本地 JSON，前端 React + Tailwind 浅色仪表盘，SSE 1.5s 实时刷新，Tauri 2 打包为单一 portable exe。

## 设计原则

- **F-pattern 顶部 4 块 Hero KPI**（Plus / 进行中 / 失败 / 总数），关键数字 `clamp(2.6rem, 5vw, 3.4rem)`，第一眼就能扫完
- **严格语义色**：`emerald` 成功、`amber` 进行中 / 警告、`red` 失败、`zinc` 中性，禁止彩色 pill 堆叠
- **渐进披露**：汇总 → 进度条 → 明细，下钻才看每个号
- **响应式**：4 列 KPI 桌面 / 2 列移动；topbar 阶段名超长自动截断
- **毛玻璃质感**：彩色径向渐变衬底 + `backdrop-filter: blur(16-18px) saturate(160%)` + 半透白 + 内嵌高光，KPI/卡片/topbar 统一玻璃风
- **全量汉化**：`batch_pipeline.py` 与 `codex2api` 暴露的所有 stage / status 在 UI 层做中文映射，包括 `post-callback-workers`→`回调补救`、`drain-complete`→`该批已清空`、`scan-complete`→`扫描完成` 等

## 端口

- 后端 FastAPI: `http://127.0.0.1:8090`
- 前端 Vite dev: `http://127.0.0.1:5173`

## 启动 exe

```pwsh
Z:\codex_pp\dashboard\dashboard-tauri.exe
```

dashboard 根目录需要同时包含：

- `dashboard-tauri.exe`
- `uvicorn-app.exe`

主 exe 会自动拉起后端 sidecar，不需要再开两个 pwsh 窗口。`dist-release/portable/` 仍保留一份镜像备份。

## 构建 portable exe

需要 Rust 工具链（`cargo` 1.95+）+ Node.js + 项目 venv。前端改动后重新打包：

```pwsh
cd Z:\codex_pp\dashboard\frontend
npm install                # 首次或 package.json 改动时跑
npm run tauri:build        # 触发 vite build + Tauri release 编译，~1.5 min

# 把两个 exe 同步到 portable 目录
Copy-Item -Force src-tauri\target\release\dashboard-tauri.exe ..\dist-release\portable\
Copy-Item -Force src-tauri\target\release\uvicorn-app.exe     ..\dist-release\portable\
```

NSIS 安装包和 MSI 在 `src-tauri\target\release\bundle\` 下；portable 路线只用根 exe + sidecar exe 两个文件。

## 开发调试

```pwsh
cd Z:\codex_pp\dashboard
pwsh -File .\start.ps1
```

也可以手动分别跑：

```pwsh
# 后端
cd Z:\codex_pp\dashboard\backend
Z:\codex_pp\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8090 --reload

# 前端
cd Z:\codex_pp\dashboard\frontend
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
| batch          | `Z:/codex_pp/plus_paypal_auto/batch_progress.json`   |
| codex2api      | `Z:/codex_pp/_mcp_tmp/codex2api_progress.json` (兼容保留，当前 UI 不展示) |
| phone_inuse    | `Z:/codex_pp/_mcp_tmp/phone_pool_inuse.json` (兼容保留，当前 UI 不展示) |
| phone_exhausted| `Z:/codex_pp/_mcp_tmp/phone_pool_exhausted.json` (兼容保留，当前 UI 不展示) |
| callback       | `Z:/codex_pp/plus_paypal_auto/callback_state.json`   |
| dead           | `Z:/codex_pp/pp_failed_accounts.json`                |

任一文件缺失或解析失败时，对应字段安全降级为 `{}` 或 `[]`，前端会自然显示空态。

## 界面

- **顶部 Hero KPI 4 块**：Plus（emerald）/ 进行中（amber）/ 失败（red）/ 批次总数（zinc）
- **4 段进度条**：注册 / 支付 / 回调 / Plus 同一张卡片，gray track + 语义色 fill；回调以 `at_ok || local_plus_export || callback_state==success` 为完成判定
- **批次明细表**：账号 · 母号组 · W · 流水线（注/付/回 三个 StepDot 小圆点）· 阶段 · AT · 支付/回调
- **顶栏**：左 brand + 当前阶段（超长截断、支持 `W1:foo@mail:callback-running:1/3` 复合 key 中文化），右 SSE pulse `emerald` 在线 / `amber` 轮询回退 + 上次 tick 秒数
- 已下线：`DeadList` 死号清单 / 回调概览 / `Codex2apiHealth` AT 测活与复活板块（信息并入 `BatchProgress` 汇总条与流水线 cell）

## 进度同步

- `batch_pipeline.py` 在注册失败、token 失败、checkout 链接失败、PayPal 重试排队、无 trial、最终 PayPal 失败时都会立刻刷新 `batch_progress.json`。
- PayPal attempt 会写入 `paypal_attempt`、`paypal_attempts_total`、`paypal_attempts_done`，并尽量从子进程日志回填 `roxy_dir_id` / `roxy_ws`。

## 调试

- 后端无数据：单独 GET `http://127.0.0.1:8090/api/snapshot`，确认 `batch`、`codex2api`、`callback`、`dead` 等键存在。
- 前端连不上 SSE：检查 8090 是否监听（`Get-NetTCPConnection -LocalPort 8090`），Vite proxy 已把 `/sse` 转发到 8090。
- `pyright` 校验：本仓库 `pyproject.toml` 已配置；后端代码遵循当前 Python 3.13 venv。
- 端口冲突：改 `backend/main.py` 末尾 `port=8090`，以及 `frontend/vite.config.ts` 的 `port: 5173` 和 proxy target。

## 文件清单

```
Z:/codex_pp/dashboard/
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
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── types.ts
│   │   ├── hooks/useSSE.ts
│   │   └── components/
│   │       └── BatchProgress.tsx
│   └── src-tauri/                # Tauri 2 Rust 壳 + uvicorn sidecar bin
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       ├── src/
│       └── bin/uvicorn-app.exe
├── dashboard-tauri.exe           # 双击启动主程序
├── uvicorn-app.exe               # 主程序自动拉起的 sidecar
├── dist-release/portable/        # portable 产物镜像备份
│   ├── dashboard-tauri.exe
│   └── uvicorn-app.exe
├── start.ps1
└── README.md
```
