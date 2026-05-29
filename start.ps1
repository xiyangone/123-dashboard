#requires -Version 7.0
<#
.SYNOPSIS
    一键启动 dashboard：后端 uvicorn @ 8090 + 前端 vite dev @ 5173。
    会打开两个独立 pwsh 子窗口，可单独关闭。
#>

$ErrorActionPreference = 'Stop'

$Root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend   = Join-Path $Root 'backend'
$Frontend  = Join-Path $Root 'frontend'
$Venv      = 'Z:\codex_pp\.venv\Scripts\python.exe'

if (-not (Test-Path $Venv)) {
    Write-Error "venv python 不存在: $Venv"
    exit 1
}
if (-not (Test-Path (Join-Path $Frontend 'node_modules'))) {
    Write-Warning "frontend/node_modules 不存在，先在 $Frontend 跑 'npm install'。"
}

# 后端窗口
$BackendCmd = @"
`$Host.UI.RawUI.WindowTitle = 'dashboard · backend (uvicorn:8090)'
cd '$Backend'
& '$Venv' -m uvicorn main:app --host 127.0.0.1 --port 8090 --reload
"@

# 前端窗口
$FrontendCmd = @"
`$Host.UI.RawUI.WindowTitle = 'dashboard · frontend (vite:5173)'
cd '$Frontend'
npm run dev
"@

Write-Host '启动后端 uvicorn (8090) …' -ForegroundColor Cyan
Start-Process pwsh -ArgumentList '-NoExit', '-NoProfile', '-Command', $BackendCmd | Out-Null

Start-Sleep -Seconds 1

Write-Host '启动前端 vite (5173) …' -ForegroundColor Cyan
Start-Process pwsh -ArgumentList '-NoExit', '-NoProfile', '-Command', $FrontendCmd | Out-Null

Write-Host '等待 vite 监听 5173 …' -ForegroundColor DarkGray
Start-Sleep -Seconds 6
Write-Host '自动打开浏览器 http://127.0.0.1:5173' -ForegroundColor Cyan
Start-Process 'http://127.0.0.1:5173' | Out-Null

Write-Host ''
Write-Host '已启动：' -ForegroundColor Green
Write-Host '  · backend  → http://127.0.0.1:8090/api/snapshot' -ForegroundColor Gray
Write-Host '  · backend  → http://127.0.0.1:8090/sse' -ForegroundColor Gray
Write-Host '  · frontend → http://127.0.0.1:5173' -ForegroundColor Gray
Write-Host ''
Write-Host '关闭：直接关闭两个子 pwsh 窗口。' -ForegroundColor DarkGray
