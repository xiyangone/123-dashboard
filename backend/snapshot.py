# -*- coding: utf-8 -*-
"""读本地 JSON 合成仪表盘快照。"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

if getattr(sys, "frozen", False):
    # PyInstaller 单文件 exe：__file__ 在临时解压目录(_MEIPASS)，须用 exe 自身位置定位项目根。
    # portable 布局下 uvicorn-app.exe 位于 <项目根>/dashboard/，故根 = exe 上溯 1 级。
    ROOT = Path(sys.executable).resolve().parents[1]
else:
    # dev（uvicorn 直跑 backend/snapshot.py）：上溯 2 级到项目根。
    ROOT = Path(__file__).resolve().parents[2]

SOURCES = {
    "batch": ROOT / "plus_paypal_auto" / "batch_progress.json",
    "codex2api": ROOT / "_mcp_tmp" / "codex2api_progress.json",
    "phone_inuse": ROOT / "_mcp_tmp" / "phone_pool_inuse.json",
    "phone_exhausted": ROOT / "_mcp_tmp" / "phone_pool_exhausted.json",
    "callback": ROOT / "plus_paypal_auto" / "callback_state.json",
    "dead": ROOT / "pp_failed_accounts.json",
}


def _safe_load(path: Path, default: Any) -> Any:
    """读 JSON 文件；不存在 / 解析失败时返回 default。"""
    try:
        if not path.exists():
            return default
        text = path.read_text(encoding="utf-8")
        if not text.strip():
            return default
        return json.loads(text)
    except (OSError, json.JSONDecodeError):
        return default


def _file_mtime(path: Path) -> float:
    try:
        return path.stat().st_mtime if path.exists() else 0.0
    except OSError:
        return 0.0


def build_snapshot() -> dict[str, Any]:
    """读取并合并数据源，附带 ts 时间戳与每个源的 mtime。"""
    snapshot: dict[str, Any] = {
        "ts": time.time(),
        "sources": {key: _file_mtime(path) for key, path in SOURCES.items()},
        "batch": _safe_load(SOURCES["batch"], {}),
        "codex2api": _safe_load(SOURCES["codex2api"], {}),
        "phone_inuse": _safe_load(SOURCES["phone_inuse"], {}),
        "phone_exhausted": _safe_load(SOURCES["phone_exhausted"], []),
        "callback": _safe_load(SOURCES["callback"], {}),
        "dead": _safe_load(SOURCES["dead"], []),
    }
    return snapshot
