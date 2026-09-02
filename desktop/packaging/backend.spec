# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"

hiddenimports = []
for package in [
    "analysis", "api", "models", "providers", "services",
]:
    try:
        hiddenimports += collect_submodules(package)
    except Exception:
        pass

# Requests / FastAPI dependencies are normally discovered automatically.

analysis = Analysis(
    [str(BACKEND / "main.py")],
    pathex=[str(BACKEND)],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(analysis.pure)

exe = EXE(
    pyz,
    analysis.scripts,
    analysis.binaries,
    analysis.datas,
    [],
    name="PALBackend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)
