import logging
from datetime import datetime, timezone

import requests

from models.candle import Candle
from models.market_data import MarketData


logger = logging.getLogger(__name__)


class YahooProvider:
    """
    Yahoo Finance provider for the US Dollar Index.

    Yahoo symbol:
        DX-Y.NYB
    """

    BASE_URL = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
    )

    SYMBOL = "DX-Y.NYB"

    def __init__(self):
        self.session = requests.Session()

        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 "
                "(Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 "
                "Chrome/151.0 Safari/537.36"
            )
        })

    def _download(
        self,
        interval: str,
        range_value: str,
    ) -> list[Candle]:

        url = (
            self.BASE_URL
            + self.SYMBOL
        )

        params = {
            "range": range_value,
            "interval": interval,
            "events": "history",
            "includeAdjustedClose": "true",
        }

        try:

            response = self.session.get(
                url,
                params=params,
                timeout=20,
            )

            response.raise_for_status()

            payload = response.json()

            chart = payload.get(
                "chart",
                {}
            )

            error = chart.get("error")

            if error:
                raise RuntimeError(
                    error.get(
                        "description",
                        "Yahoo Finance returned an error.",
                    )
                )

            results = chart.get(
                "result"
            )

            if not results:
                logger.warning(
                    "Yahoo returned no result: %s %s",
                    interval,
                    range_value,
                )
                return []

            result = results[0]

            timestamps = result.get(
                "timestamp",
                []
            )

            quote_list = result.get(
                "indicators",
                {}
            ).get(
                "quote",
                []
            )

            if not quote_list:
                return []

            quote = quote_list[0]

            opens = quote.get("open", [])
            highs = quote.get("high", [])
            lows = quote.get("low", [])
            closes = quote.get("close", [])
            volumes = quote.get("volume", [])

            candles = []

            for i, timestamp in enumerate(timestamps):

                try:

                    open_price = opens[i]
                    high_price = highs[i]
                    low_price = lows[i]
                    close_price = closes[i]

                    if (
                        open_price is None
                        or high_price is None
                        or low_price is None
                        or close_price is None
                    ):
                        continue

                    candle_time = datetime.fromtimestamp(
                        timestamp,
                        tz=timezone.utc,
                    ).replace(
                        tzinfo=None
                    )

                    volume = None

                    if (
                        i < len(volumes)
                        and volumes[i] is not None
                    ):
                        volume = float(
                            volumes[i]
                        )

                    candles.append(
                        Candle(
                            datetime=candle_time,
                            open=float(open_price),
                            high=float(high_price),
                            low=float(low_price),
                            close=float(close_price),
                            volume=volume,
                        )
                    )

                except (
                    IndexError,
                    TypeError,
                    ValueError,
                ):
                    continue

            logger.info(
                "Yahoo DXY %s %s: %s candles",
                interval,
                range_value,
                len(candles),
            )

            return candles

        except Exception as ex:

            logger.warning(
                "Yahoo DXY failed [%s/%s]: %s",
                interval,
                range_value,
                ex,
            )

            return []

    def get_dxy_data(self) -> MarketData:

        data = MarketData(
            symbol="DXY"
        )

        # -----------------------------------------
        # Higher timeframes
        # -----------------------------------------

        data.monthly = self._download(
            "1mo",
            "10y",
        )

        data.weekly = self._download(
            "1wk",
            "10y",
        )

        data.daily = self._download(
            "1d",
            "10y",
        )

        # -----------------------------------------
        # Intraday
        #
        # We intentionally request recent ranges.
        # Yahoo restricts how far back intraday
        # intervals can be queried.
        # -----------------------------------------

        data.h4 = self._download(
            "1h",
            "730d",
        )

        data.h1 = self._download(
            "1h",
            "730d",
        )

        data.m30 = self._download(
            "30m",
            "60d",
        )

        data.m15 = self._download(
            "15m",
            "60d",
        )

        data.m5 = self._download(
            "5m",
            "60d",
        )

        data.m1 = self._download(
            "1m",
            "7d",
        )

        # -----------------------------------------
        # Build M3 from M1
        # -----------------------------------------

        data.m3 = []

        if len(data.m1) >= 3:

            for i in range(
                2,
                len(data.m1),
                3,
            ):

                group = data.m1[
                    i - 2:i + 1
                ]

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