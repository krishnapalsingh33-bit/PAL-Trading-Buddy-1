import os
import subprocess
import sys
from pathlib import Path

APP_HTML_NAME = "PAL-Journal-Desktop-V2.2-Fixed.html"


def resource_path(relative_path: str) -> Path:
    bundle_dir = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return bundle_dir / relative_path


def find_browser() -> Path | None:
    local = Path(os.environ.get("LOCALAPPDATA", ""))
    program_files = [
        Path(os.environ.get("PROGRAMFILES", r"C:\\Program Files")),
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\\Program Files (x86)")),
        local,
    ]
    candidates = []
    for root in program_files:
        candidates.extend([
            root / "Google/Chrome/Application/chrome.exe",
            root / "Microsoft/Edge/Application/msedge.exe",
            root / "Microsoft/Edge Beta/Application/msedge.exe",
        ])
    return next((p for p in candidates if p.is_file()), None)


def main() -> None:
    # The launcher deliberately writes the fixed HTML beside the EXE using the
    # same filename. Put the EXE beside the user's existing HTML to keep the
    # same file URL/storage origin in the same browser profile.
    app_dir = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
    bundled_html = resource_path("PAL-Journal-Desktop.html")
    target_html = app_dir / APP_HTML_NAME

    try:
        bundled_bytes = bundled_html.read_bytes()
        if not target_html.exists() or target_html.read_bytes() != bundled_bytes:
            target_html.write_bytes(bundled_bytes)
    except OSError:
        # If the EXE's folder is read-only, use a writable application folder.
        # This fallback cannot share an older file-origin browser store.
        app_dir = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "PALTradingJournal"
        app_dir.mkdir(parents=True, exist_ok=True)
        target_html = app_dir / APP_HTML_NAME
        bundled_bytes = bundled_html.read_bytes()
        if not target_html.exists() or target_html.read_bytes() != bundled_bytes:
            target_html.write_bytes(bundled_bytes)

    browser = find_browser()
    uri = target_html.resolve().as_uri()
    if browser:
        creationflags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        subprocess.Popen([str(browser), f"--app={uri}", "--new-window"], close_fds=True, creationflags=creationflags)
    else:
        os.startfile(str(target_html))


if __name__ == "__main__":
    main()
