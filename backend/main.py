# -*- coding: utf-8 -*-
"""FastAPI 后端：提供 /api/snapshot 与 /sse。"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from snapshot import build_snapshot

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("dashboard")

app = FastAPI(title="plus_paypal_auto dashboard", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/snapshot")
def snapshot() -> dict:
    """同步返回一份完整快照（用于首屏、调试或回退轮询）。"""
    return build_snapshot()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/sse")
async def sse() -> EventSourceResponse:
    """Server-Sent Events：每 1.5s 推一份合并快照。"""

    async def gen():
        try:
            while True:
                data = build_snapshot()
                yield {
                    "event": "snapshot",
                    "data": json.dumps(data, ensure_ascii=False, default=str),
                }
                await asyncio.sleep(1.5)
        except asyncio.CancelledError:  # pragma: no cover
            logger.info("SSE client disconnected")
            raise

    return EventSourceResponse(gen())


if __name__ == "__main__":
    import uvicorn

    # 传 app 对象而不是 "main:app" 字符串，避免 PyInstaller 单文件模式下
    # importlib 找不到 main 模块。
    uvicorn.run(app, host="127.0.0.1", port=8090, reload=False)
