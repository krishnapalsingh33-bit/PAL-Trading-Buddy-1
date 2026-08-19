@echo off
setlocal
cd /d "%~dp0.."

if not exist ".venv\Scripts\python.exe" (
    echo Creating PAL Python environment...
    py -m venv .venv
)

call ".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo Failed to install Python dependencies.
    pause
    exit /b 1
)

echo.
echo Starting PAL Local MT5 Connector...
echo Keep MetaTrader 5 open and logged in.
echo.
".venv\Scripts\python.exe" -m mt5_connector.server --host 127.0.0.1 --port 8765
pause
