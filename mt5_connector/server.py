from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    import MetaTrader5 as mt5
except ImportError as exc:  # pragma: no cover
    mt5 = None
    IMPORT_ERROR = str(exc)
else:
    IMPORT_ERROR = None

app = FastAPI(title="PAL Local MT5 Connector", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


def _initialize() -> None:
    if mt5 is None:
        raise RuntimeError(f"MetaTrader5 package is not installed: {IMPORT_ERROR}")
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")


def _account() -> dict:
    account = mt5.account_info()
    if account is None:
        raise RuntimeError(f"Unable to read MT5 account: {mt5.last_error()}")
    return {
        "login": int(account.login),
        "server": str(account.server),
        "name": str(account.name),
        "currency": str(account.currency),
        "balance": float(account.balance),
        "equity": float(account.equity),
        "margin": float(account.margin),
        "free_margin": float(account.margin_free),
    }


def _status() -> dict:
    _initialize()
    try:
        account = _account()
        terminal = mt5.terminal_info()
        return {
            "status": "CONNECTED",
            "connected": True,
            "reason": None,
            "account": account,
            "terminal": {
                "community_account": bool(getattr(terminal, "community_account", False)),
                "trade_allowed": bool(getattr(terminal, "trade_allowed", False)),
                "connected": bool(getattr(terminal, "connected", False)),
            },
        }
    finally:
        mt5.shutdown()


def _positions() -> list[dict]:
    positions = mt5.positions_get()
    if positions is None:
        raise RuntimeError(f"Unable to retrieve positions: {mt5.last_error()}")
    return [
        {
            "ticket": int(p.ticket),
            "symbol": str(p.symbol),
            "type": "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL",
            "volume": float(p.volume),
            "price_open": float(p.price_open),
            "stop_loss": float(p.sl),
            "take_profit": float(p.tp),
            "profit": float(p.profit),
            "swap": float(p.swap),
            "time": datetime.fromtimestamp(p.time).isoformat(),
        }
        for p in positions
    ]


def _journal(days: int) -> dict:
    _initialize()
    try:
        account = _account()
        positions = _positions()
        date_to = datetime.now()
        date_from = date_to - timedelta(days=max(1, min(days, 365)))
        deals = mt5.history_deals_get(date_from, date_to)
        if deals is None:
            raise RuntimeError(f"Unable to retrieve history: {mt5.last_error()}")

        deals = [d for d in deals if d.type in (mt5.DEAL_TYPE_BUY, mt5.DEAL_TYPE_SELL)]
        grouped: dict[int, list] = {}
        for deal in deals:
            grouped.setdefault(int(deal.position_id), []).append(deal)

        trades = []
        for position_id, items in grouped.items():
            items.sort(key=lambda d: d.time)
            entries = [d for d in items if d.entry == mt5.DEAL_ENTRY_IN]
            exits = [d for d in items if d.entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_OUT_BY)]
            if not entries or not exits:
                continue
            entry, exit_deal = entries[0], exits[-1]
            volume = sum(float(d.volume) for d in entries)
            exit_volume = sum(float(d.volume) for d in exits)
            entry_price = sum(float(d.price) * float(d.volume) for d in entries) / volume if volume else float(entry.price)
            exit_price = sum(float(d.price) * float(d.volume) for d in exits) / exit_volume if exit_volume else float(exit_deal.price)
            profit = sum(float(d.profit) for d in items)
            commission = sum(float(d.commission) for d in items)
            swap = sum(float(d.swap) for d in items)
            fee = sum(float(d.fee) for d in items)
            net_profit = profit + commission + swap + fee
            entry_time = datetime.fromtimestamp(entry.time)
            exit_time = datetime.fromtimestamp(exit_deal.time)
            trades.append({
                "position_id": position_id,
                "symbol": str(entry.symbol),
                "direction": "BUY" if entry.type == mt5.DEAL_TYPE_BUY else "SELL",
                "volume": volume,
                "entry_price": entry_price,
                "exit_price": exit_price,
                "entry_time": entry_time.isoformat(),
                "exit_time": exit_time.isoformat(),
                "duration_seconds": (exit_time - entry_time).total_seconds(),
                "profit": profit,
                "commission": commission,
                "swap": swap,
                "fee": fee,
                "net_profit": net_profit,
                "result": "WIN" if net_profit > 0 else "LOSS" if net_profit < 0 else "BREAKEVEN",
                "entry_ticket": int(entry.ticket),
                "exit_ticket": int(exit_deal.ticket),
                "comment": str(exit_deal.comment or entry.comment),
            })

        trades.sort(key=lambda t: t["exit_time"], reverse=True)
        wins = [t for t in trades if t["net_profit"] > 0]
        losses = [t for t in trades if t["net_profit"] < 0]
        total = len(trades)
        statistics = {
            "total_trades": total,
            "wins": len(wins),
            "losses": len(losses),
            "breakeven": total - len(wins) - len(losses),
            "win_rate": len(wins) / total * 100 if total else 0.0,
            "gross_profit": sum(t["profit"] for t in wins),
            "gross_loss": abs(sum(t["profit"] for t in losses)),
            "commission": sum(t["commission"] for t in trades),
            "swap": sum(t["swap"] for t in trades),
            "fee": sum(t["fee"] for t in trades),
            "net_profit": sum(t["net_profit"] for t in trades),
            "average_win": sum(t["net_profit"] for t in wins) / len(wins) if wins else 0.0,
            "average_loss": sum(t["net_profit"] for t in losses) / len(losses) if losses else 0.0,
            "profit_factor": sum(t["profit"] for t in wins) / abs(sum(t["profit"] for t in losses)) if losses else None,
            "average_duration_seconds": sum(t["duration_seconds"] for t in trades) / total if total else 0.0,
            "best_trade": max(trades, key=lambda t: t["net_profit"]) if trades else None,
            "worst_trade": min(trades, key=lambda t: t["net_profit"]) if trades else None,
        }
        return {"account": account, "open_positions": positions, "trades": trades, "statistics": statistics, "period_days": days}
    finally:
        mt5.shutdown()


@app.get("/health")
def health():
    return {"ok": True, "service": "PAL Local MT5 Connector"}


@app.get("/v2/mt5/status")
def status():
    try:
        return {"success": True, "data": _status()}
    except Exception as exc:
        return {"success": True, "data": {"status": "NOT_CONNECTED", "connected": False, "reason": str(exc), "account": None, "terminal": None}}


@app.get("/v2/journal")
def journal(days: int = 30):
    try:
        return {"success": True, "data": _journal(days)}
    except Exception as exc:
        return {"success": False, "error": str(exc), "data": None}


def main() -> None:
    import uvicorn
    parser = argparse.ArgumentParser(description="PAL local MT5 connector")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    print(f"PAL Local MT5 Connector listening on http://{args.host}:{args.port}")
    print("Keep MetaTrader 5 open and logged into the trading account.")
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
