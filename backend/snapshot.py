# -*- coding: utf-8 -*-
"""读本地 JSON + 实时拉 codex2api admin 合成仪表盘快照。"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path("Z:/123")

SOURCES = {
    "batch": ROOT / "plus_paypal_auto" / "batch_progress.json",
    "codex2api": ROOT / "_mcp_tmp" / "codex2api_progress.json",
    "phone_inuse": ROOT / "_mcp_tmp" / "phone_pool_inuse.json",
    "phone_exhausted": ROOT / "_mcp_tmp" / "phone_pool_exhausted.json",
    "callback": ROOT / "plus_paypal_auto" / "callback_state.json",
    "dead": ROOT / "pp_failed_accounts.json",
}

CODEX2API_CONFIG = ROOT / "plus_paypal_auto" / "configs" / "config_w1.json"
CODEX2API_STALE_SECONDS = 300.0  # progress 文件超过 5 分钟未刷新，就用 live
CODEX2API_TIMEOUT = 2.5
CODEX2API_PAGE_SIZE = 500
HEALTHY_STATUSES = {"active", "healthy", "ok"}


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


def _load_codex2api_settings() -> tuple[str, str]:
    cfg = _safe_load(CODEX2API_CONFIG, {})
    section = cfg.get("codex2api", {}) if isinstance(cfg, dict) else {}
    base = str(section.get("base_url") or "http://127.0.0.1:8080").rstrip("/")
    key = str(section.get("admin_secret") or "")
    return base, key


def _fetch_codex2api_live(base: str, key: str) -> dict[str, Any] | None:
    """直接调 codex2api admin，把账号列表整成 Codex2apiProgress 形状。"""
    if not key:
        return None
    url = f"{base}/api/admin/accounts?page=1&page_size={CODEX2API_PAGE_SIZE}"
    req = urllib.request.Request(url, headers={"X-Admin-Key": key})
    try:
        with urllib.request.urlopen(req, timeout=CODEX2API_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None
    rows = payload.get("accounts") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return None

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z"
    accounts: dict[str, Any] = {}
    healthy = failed = dead = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        email = str(row.get("email") or row.get("name") or "").strip()
        if not email:
            continue
        plan = str(row.get("plan_type") or "").lower()
        status_raw = str(row.get("status") or "").lower()
        is_plus = plan == "plus"
        if is_plus and status_raw in HEALTHY_STATUSES:
            mapped = "healthy"
            healthy += 1
        elif status_raw in {"unauthorized", "expired", "dead"}:
            mapped = "dead"
            dead += 1
        else:
            mapped = "failed" if status_raw else "pending"
            if status_raw:
                failed += 1
        accounts[email] = {
            "email": email,
            "status": mapped,
            "reason": status_raw or "unknown",
            "planType": plan or "unknown",
            "checkedAt": now_iso,
            "event": f"codex2api {status_raw or 'unknown'}",
            "updated_at": now_iso,
            "codex2apiAccountId": row.get("id"),
        }

    total = len(accounts)
    return {
        "source": "codex2api-live",
        "stage": "live-scan",
        "updated_at": now_iso,
        "total": total,
        "processed": total,
        "healthy": healthy,
        "revived": 0,
        "failed": failed,
        "dead": dead,
        "skipped": 0,
        "revive_attempted": 0,
        "current_email": "",
        "accounts": accounts,
        "events": [],
        "cleaned": 0,
    }


def _resolve_codex2api(now: float) -> dict[str, Any]:
    """progress 文件新鲜就用它，否则回退到 codex2api admin live 数据。"""
    progress_path = SOURCES["codex2api"]
    progress_mtime = _file_mtime(progress_path)
    progress_fresh = progress_mtime > 0 and (now - progress_mtime) <= CODEX2API_STALE_SECONDS
    progress_data = _safe_load(progress_path, {})

    if progress_fresh and isinstance(progress_data, dict) and progress_data.get("accounts"):
        return progress_data

    base, key = _load_codex2api_settings()
    live = _fetch_codex2api_live(base, key)
    if live is not None:
        return live
    return progress_data if isinstance(progress_data, dict) else {}


def build_snapshot() -> dict[str, Any]:
    """读取并合并数据源，附带 ts 时间戳与每个源的 mtime。"""
    now = time.time()
    snapshot: dict[str, Any] = {
        "ts": now,
        "sources": {key: _file_mtime(path) for key, path in SOURCES.items()},
        "batch": _safe_load(SOURCES["batch"], {}),
        "codex2api": _resolve_codex2api(now),
        "phone_inuse": _safe_load(SOURCES["phone_inuse"], {}),
        "phone_exhausted": _safe_load(SOURCES["phone_exhausted"], []),
        "callback": _safe_load(SOURCES["callback"], {}),
        "dead": _safe_load(SOURCES["dead"], []),
    }
    return snapshot
