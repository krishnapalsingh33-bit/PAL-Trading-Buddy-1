# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

# GitHub Actions runs PyInstaller from the repository root. The spec file
# is evaluated as Python source, where __file__ is not guaranteed to exist.
ROOT = Path.cwd()
BACKEND = ROOT / "backend"
LAUNCHER = ROOT / "desktop" / "packaging" / "backend_launcher.py"

hiddenimports = []
for package in ["analysis", "api", "models", "providers", "services"]:
    try:
        hiddenimports += collect_submodules(package)
    except Exception:
        pass

analysis = Analysis(
    [str(LAUNCHER)],
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
