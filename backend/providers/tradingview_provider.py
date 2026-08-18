from datetime import datetime
import logging

from tvDatafeed import TvDatafeed, Interval

from models.candle import Candle
from models.market_data import MarketData
from providers.base_provider import BaseProvider


logger = logging.getLogger(__name__)


class TradingViewProvider(BaseProvider):
    """
    TradingView market-data provider.

    Used primarily for DXY because the challenge-account
    MT5 broker does not provide a DXY/USDX symbol.
    """

import os
from dotenv import load_dotenv

load_dotenv()


class TradingViewProvider(BaseProvider):

    def __init__(self):

        username = os.getenv("TRADINGVIEW_USERNAME")
        password = os.getenv("TRADINGVIEW_PASSWORD")

        if username and password:
            self.tv = TvDatafeed(
                username=username,
                password=password,
            )
        else:
            self.tv = TvDatafeed()

    def _download(
        self,
        symbol: str,
        exchange: str,
        interval: Interval,
        n_bars: int,
        name: str,
    ) -> list[Candle]:

        try:

            df = self.tv.get_hist(
                symbol=symbol,
                exchange=exchange,
                interval=interval,
                n_bars=n_bars,
            )

            if df is None or df.empty:

                logger.warning(
                    "%s returned no data.",
                    name,
                )

                return []

            candles = []

            for index, row in df.iterrows():

                candle_time = (
                    index.to_pydatetime()
                    if hasattr(index, "to_pydatetime")
                    else index
                )

                candles.append(
                    Candle(
                        datetime=candle_time,
                        open=float(row["open"]),
                        high=float(row["high"]),
                        low=float(row["low"]),
                        close=float(row["close"]),
                        volume=(
                            float(row["volume"])
                            if "volume" in row
                            else None
                        ),
                    )
                )

            logger.info(
                "%s: %s candles downloaded.",
                name,
                len(candles),
            )

            return candles

        except Exception as ex:

            logger.warning(
                "%s failed: %s",
                name,
                ex,
            )

            return []

    def get_market_data(
        self,
        symbol: str,
        exchange: str = "FX_IDC",
    ) -> MarketData:

        symbol = symbol.upper()

        data = MarketData(
            symbol=symbol
        )

        downloads = [

            ("monthly", Interval.in_monthly, 300),

            ("weekly", Interval.in_weekly, 500),

            ("daily", Interval.in_daily, 1000),

            ("h4", Interval.in_4_hour, 1000),

            ("h1", Interval.in_1_hour, 2000),

            ("m30", Interval.in_30_minute, 3000),

            ("m15", Interval.in_15_minute, 5000),

            ("m5", Interval.in_5_minute, 5000),

            ("m1", Interval.in_1_minute, 5000),
        ]

        for field, interval, bars in downloads:

            candles = self._download(
                symbol=symbol,
                exchange=exchange,
                interval=interval,
                n_bars=bars,
                name=field.upper(),
            )

            setattr(
                data,
                field,
                candles,
            )

        # --------------------------------------------------
        # Build M3 from M1
        # --------------------------------------------------

        data.m3 = []

        if len(data.m1) >= 3:

            for i in range(
                2,
                len(data.m1),
                3,
            ):

                group = data.m1[i - 2:i + 1]

                if len(group) != 3:
                    continue

                data.m3.append(
                    Candle(
                        datetime=group[-1].datetime,
                        open=group[0].open,
                        high=max(
                            candle.high
                            for candle in group
                        ),
                        low=min(
                            candle.low
                            for candle in group
                        ),
                        close=group[-1].close,
                        volume=sum(
                            candle.volume or 0
                            for candle in group
                        ),
                    )
                )

        return data

    def get_dxy_data(self) -> MarketData:

        # TradingView's real-time DXY symbol is TVC:DXY.
        return self.get_market_data(
            symbol="DXY",
            exchange="TVC",
        )