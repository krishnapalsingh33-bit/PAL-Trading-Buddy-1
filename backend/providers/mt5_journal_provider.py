from datetime import datetime, timedelta

import MetaTrader5 as mt5


class MT5JournalProvider:
    """
    Reads account information and converts MT5 deals
    into complete journal trades.
    """

    def _initialize(self):
        if not mt5.initialize():
            raise RuntimeError(
                f"MT5 initialization failed: {mt5.last_error()}"
            )

    def _account(self) -> dict:
        account = mt5.account_info()

        if account is None:
            raise RuntimeError(
                f"Unable to retrieve MT5 account information: "
                f"{mt5.last_error()}"
            )

        return {
            "login": int(account.login),
            "server": account.server,
            "name": account.name,
            "currency": account.currency,
            "balance": float(account.balance),
            "equity": float(account.equity),
            "margin": float(account.margin),
            "free_margin": float(account.margin_free),
        }

    def _open_positions(self) -> list[dict]:
        positions = mt5.positions_get()

        if positions is None:
            raise RuntimeError(
                f"Unable to retrieve MT5 positions: "
                f"{mt5.last_error()}"
            )

        result = []

        for position in positions:
            result.append(
                {
                    "ticket": int(position.ticket),
                    "symbol": position.symbol,
                    "type": (
                        "BUY"
                        if position.type == mt5.POSITION_TYPE_BUY
                        else "SELL"
                    ),
                    "volume": float(position.volume),
                    "price_open": float(position.price_open),
                    "stop_loss": float(position.sl),
                    "take_profit": float(position.tp),
                    "profit": float(position.profit),
                    "swap": float(position.swap),
                    "time": datetime.fromtimestamp(
                        position.time
                    ).isoformat(),
                }
            )

        return result

    def _deals(self, days: int) -> list:
        date_to = datetime.now()
        date_from = date_to - timedelta(days=days)

        deals = mt5.history_deals_get(
            date_from,
            date_to,
        )

        if deals is None:
            raise RuntimeError(
                f"Unable to retrieve MT5 trade history: "
                f"{mt5.last_error()}"
            )

        return [
            deal
            for deal in deals
            if deal.type in (
                mt5.DEAL_TYPE_BUY,
                mt5.DEAL_TYPE_SELL,
            )
        ]

    def _build_trades(self, deals) -> list[dict]:
        """
        Groups MT5 entry and exit deals using position_id.
        """

        grouped = {}

        for deal in deals:
            position_id = int(deal.position_id)

            grouped.setdefault(
                position_id,
                [],
            ).append(deal)

        trades = []

        for position_id, position_deals in grouped.items():

            position_deals.sort(
                key=lambda deal: deal.time
            )

            entry_deals = [
                deal
                for deal in position_deals
                if deal.entry == mt5.DEAL_ENTRY_IN
            ]

            exit_deals = [
                deal
                for deal in position_deals
                if deal.entry in (
                    mt5.DEAL_ENTRY_OUT,
                    mt5.DEAL_ENTRY_OUT_BY,
                )
            ]

            if not entry_deals or not exit_deals:
                continue

            entry = entry_deals[0]
            exit_deal = exit_deals[-1]

            direction = (
                "BUY"
                if entry.type == mt5.DEAL_TYPE_BUY
                else "SELL"
            )

            volume = sum(
                float(deal.volume)
                for deal in entry_deals
            )

            entry_price = (
                sum(
                    float(deal.price) * float(deal.volume)
                    for deal in entry_deals
                )
                / volume
                if volume
                else float(entry.price)
            )

            exit_volume = sum(
                float(deal.volume)
                for deal in exit_deals
            )

            exit_price = (
                sum(
                    float(deal.price) * float(deal.volume)
                    for deal in exit_deals
                )
                / exit_volume
                if exit_volume
                else float(exit_deal.price)
            )

            profit = sum(
                float(deal.profit)
                for deal in position_deals
            )

            commission = sum(
                float(deal.commission)
                for deal in position_deals
            )

            swap = sum(
                float(deal.swap)
                for deal in position_deals
            )

            fee = sum(
                float(deal.fee)
                for deal in position_deals
            )

            net_profit = (
                profit
                + commission
                + swap
                + fee
            )

            entry_time = datetime.fromtimestamp(
                entry.time
            )

            exit_time = datetime.fromtimestamp(
                exit_deal.time
            )

            duration_seconds = (
                exit_time - entry_time
            ).total_seconds()

            if net_profit > 0:
                result = "WIN"
            elif net_profit < 0:
                result = "LOSS"
            else:
                result = "BREAKEVEN"

            trades.append(
                {
                    "position_id": position_id,
                    "symbol": entry.symbol,
                    "direction": direction,
                    "volume": volume,
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "entry_time": entry_time.isoformat(),
                    "exit_time": exit_time.isoformat(),
                    "duration_seconds": duration_seconds,
                    "profit": profit,
                    "commission": commission,
                    "swap": swap,
                    "fee": fee,
                    "net_profit": net_profit,
                    "result": result,
                    "entry_ticket": int(entry.ticket),
                    "exit_ticket": int(exit_deal.ticket),
                    "comment": exit_deal.comment or entry.comment,
                }
            )

        trades.sort(
            key=lambda trade: trade["exit_time"],
            reverse=True,
        )

        return trades

    def _statistics(
        self,
        trades: list[dict],
    ) -> dict:
        """
        Calculates journal performance statistics
        from completed trades.
        """

        total_trades = len(trades)

        wins = [
            trade
            for trade in trades
            if trade["net_profit"] > 0
        ]

        losses = [
            trade
            for trade in trades
            if trade["net_profit"] < 0
        ]

        breakeven = [
            trade
            for trade in trades
            if trade["net_profit"] == 0
        ]

        win_count = len(wins)
        loss_count = len(losses)
        breakeven_count = len(breakeven)

        win_rate = (
            (win_count / total_trades) * 100
            if total_trades
            else 0.0
        )

        gross_profit = sum(
            trade["profit"]
            for trade in wins
        )

        gross_loss = abs(
            sum(
                trade["profit"]
                for trade in losses
            )
        )

        total_commission = sum(
            trade["commission"]
            for trade in trades
        )

        total_swap = sum(
            trade["swap"]
            for trade in trades
        )

        total_fee = sum(
            trade["fee"]
            for trade in trades
        )

        net_profit = sum(
            trade["net_profit"]
            for trade in trades
        )

        average_win = (
            sum(
                trade["net_profit"]
                for trade in wins
            ) / win_count
            if win_count
            else 0.0
        )

        average_loss = (
            sum(
                trade["net_profit"]
                for trade in losses
            ) / loss_count
            if loss_count
            else 0.0
        )

        profit_factor = (
            gross_profit / gross_loss
            if gross_loss
            else None
        )

        best_trade = (
            max(
                trades,
                key=lambda trade: trade["net_profit"],
            )
            if trades
            else None
        )

        worst_trade = (
            min(
                trades,
                key=lambda trade: trade["net_profit"],
            )
            if trades
            else None
        )

        average_duration_seconds = (
            sum(
                trade["duration_seconds"]
                for trade in trades
            ) / total_trades
            if total_trades
            else 0.0
        )

        return {
            "total_trades": total_trades,
            "wins": win_count,
            "losses": loss_count,
            "breakeven": breakeven_count,
            "win_rate": win_rate,
            "gross_profit": gross_profit,
            "gross_loss": gross_loss,
            "commission": total_commission,
            "swap": total_swap,
            "fee": total_fee,
            "net_profit": net_profit,
            "average_win": average_win,
            "average_loss": average_loss,
            "profit_factor": profit_factor,
            "average_duration_seconds": average_duration_seconds,
            "best_trade": best_trade,
            "worst_trade": worst_trade,
        }

    def get_journal(
        self,
        days: int = 30,
    ) -> dict:

        self._initialize()

        try:

            account = self._account()

            open_positions = self._open_positions()

            deals = self._deals(days)

            trades = self._build_trades(
                deals
            )

            statistics = self._statistics(
                trades
            )

            return {
                "account": account,
                "open_positions": open_positions,
                "trades": trades,
                "statistics": statistics,
                "period_days": days,
            }

        finally:
            mt5.shutdown()