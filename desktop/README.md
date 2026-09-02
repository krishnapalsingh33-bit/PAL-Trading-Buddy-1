# PAL Trading Buddy Desktop

This folder contains the Windows desktop shell for PAL Trading Buddy.

The desktop build packages two parts together:

- the production Vite frontend
- a PyInstaller-built FastAPI backend (`PALBackend.exe`)

The Electron shell starts the backend automatically, waits for `/health`, serves the frontend locally, and opens the dashboard.

## Build prerequisites

Install Node.js, npm and Python on the build machine. Then from the repository root:

```powershell
cd frontend
npm.cmd install
npm.cmd run build
cd ..
py -m pip install -r backend\requirements.txt
py -m pip install pyinstaller
py -m PyInstaller --noconfirm --clean --onedir --name PALBackend --distpath desktop\backend desktop\packaging\backend.spec
```

The backend packaging spec is intentionally kept separate so the runtime can be bundled without requiring Python on the user's laptop.

## Electron build

From `desktop`:

```powershell
npm.cmd install
npm.cmd run dist
```

The Windows installer is written to `desktop/dist/`.
