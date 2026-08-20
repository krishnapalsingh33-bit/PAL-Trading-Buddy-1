from __future__ import annotations

import argparse

from fastapi import Body
from pydantic import BaseModel
import MetaTrader5 as mt5
import uvicorn

from .server import app, _account, _journal, _status


class MT5Credentials(BaseModel):
    login: int
    password: str
    server: str


@app.post("/v2/mt5/connect")
def connect(credentials: MT5Credentials = Body(...)):
    """Connect the local terminal using credentials entered in PAL.

    Credentials exist only in this request process and are never persisted by PAL.
    The password is sent only to 127.0.0.1, not to the PAL cloud backend.
    """
    initialized = False
    try:
        initialized = bool(
            mt5.initialize(
                login=int(credentials.login),
                password=credentials.password,
                server=credentials.server,
            )
        )
        if not initialized:
            return {
                "success": False,
                "error": f"MT5 connection failed: {mt5.last_error()}",
            }
        account = mt5.account_info()
        if account is None:
            return {
                "success": False,
                "error": f"MT5 account could not be read: {mt5.last_error()}",
            }
        return {
            "success": True,
            "data": {
                "status": "CONNECTED",
                "connected": True,
                "reason": None,
                "account": _account(),
                "terminal": {
                    "connected": bool(getattr(mt5.terminal_info(), "connected", False)),
                    "trade_allowed": bool(getattr(mt5.terminal_info(), "trade_allowed", False)),
                },
            },
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}
    finally:
        if initialized:
            try:
                mt5.shutdown()
            except Exception:
                pass


def main() -> None:
    parser = argparse.ArgumentParser(description="PAL local MT5 connector with login")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    print(f"PAL Local MT5 Connector listening on http://{args.host}:{args.port}")
    print("Credentials are accepted only on the local machine and are never stored.")
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
