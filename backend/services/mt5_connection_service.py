from __future__ import annotations

from typing import Any


class MT5ConnectionService:
    """Safe, read-only MT5 terminal connection/status probe."""

    def status(self) -> dict[str, Any]:
        try:
            import MetaTrader5 as mt5
        except ImportError:
            return {
                "status": "UNAVAILABLE",
                "connected": False,
                "reason": "MetaTrader5 Python package is not installed.",
                "account": None,
                "terminal": None,
            }

        initialized = False
        try:
            initialized = bool(mt5.initialize())
            if not initialized:
                error = mt5.last_error()
                return {
                    "status": "NOT_CONNECTED",
                    "connected": False,
                    "reason": f"MT5 terminal could not be initialized: {error}",
                    "account": None,
                    "terminal": None,
                }

            account = mt5.account_info()
            terminal = mt5.terminal_info()

            if account is None:
                error = mt5.last_error()
                return {
                    "status": "NOT_CONNECTED",
                    "connected": False,
                    "reason": f"MT5 terminal is reachable but no trading account is available: {error}",
                    "account": None,
                    "terminal": _terminal_payload(terminal),
                }

            return {
                "status": "CONNECTED",
                "connected": True,
                "reason": None,
                "account": {
                    "login": int(account.login),
                    "server": str(account.server),
                    "name": str(account.name),
                    "currency": str(account.currency),
                    "balance": float(account.balance),
                    "equity": float(account.equity),
                },
                "terminal": _terminal_payload(terminal),
            }
        except Exception as exc:
            return {
                "status": "ERROR",
                "connected": False,
                "reason": f"MT5 status check failed: {exc}",
                "account": None,
                "terminal": None,
            }
        finally:
            if initialized:
                try:
                    mt5.shutdown()
                except Exception:
                    pass


def _terminal_payload(terminal: Any) -> dict[str, Any] | None:
    if terminal is None:
        return None
    return {
        "community_account": bool(getattr(terminal, "community_account", False)),
        "trade_allowed": bool(getattr(terminal, "trade_allowed", False)),
        "connected": bool(getattr(terminal, "connected", False)),
    }
