# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec：把 FastAPI 后端打成单文件 sidecar。

产物：dist/uvicorn-app.exe
后续被 Tauri 重命名为 uvicorn-app-x86_64-pc-windows-msvc.exe 放到 src-tauri/bin/。
"""
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

hidden = []
# 显式收齐 FastAPI / uvicorn / sse-starlette / starlette 依赖
hidden += collect_submodules('fastapi')
hidden += collect_submodules('starlette')
hidden += collect_submodules('uvicorn')
hidden += collect_submodules('uvicorn.lifespan')
hidden += collect_submodules('uvicorn.loops')
hidden += collect_submodules('uvicorn.protocols')
hidden += collect_submodules('uvicorn.protocols.http')
hidden += collect_submodules('uvicorn.protocols.websockets')
hidden += collect_submodules('uvicorn.logging')
hidden += collect_submodules('sse_starlette')
hidden += collect_submodules('anyio')
hidden += collect_submodules('h11')
hidden += collect_submodules('httptools')
hidden += collect_submodules('websockets')
hidden += collect_submodules('watchfiles')
hidden += ['snapshot']

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas', 'PIL'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='uvicorn-app',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
