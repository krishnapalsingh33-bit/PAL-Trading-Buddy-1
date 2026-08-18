import os
import logging
from datetime import datetime

import requests
from dotenv import load_dotenv

from models.candle import Candle
from models.market_data import MarketData

load_dotenv()

logger = logging.getLogger(__name__)


class TwelveDataProvider:
    """
    Provides DXY market data from Twelve Data.
    """

    BASE_URL = "https://api.twelvedata.com/time_series"

    def __init__(self):
        self.api_key = os.getenv("TWELVE_DATA_API_KEY")

        if not self.api_key:
            raise RuntimeError(
                "TWELVE_DATA_API_KEY is missing from .env"
            )

    def _download(
        self,
        interval: str,
        outputsize: int = 500,
    ) -> list[Candle]:

        params = {
            "symbol": "DXY",
            "interval": interval,
            "outputsize": outputsize,
            "apikey": self.api_key,
        }

        response = requests.get(
            self.BASE_URL,
            params=params,
            timeout=20,
        )

        response.raise_for_status()

        data = response.json()

        if "status" in data and data["status"] == "error":
            raise RuntimeError(
                data.get(
                    "message",
                    "Twelve Data returned an error.",
                )
            )

        values = data.get("values", [])

        candles = []

        for row in reversed(values):

            candles.append(
                Candle(
                    datetime=datetime.fromisoformat(
                        row["datetime"]
                    ),
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=(
                        float(row["volume"])
                        if row.get("volume") is not None
                        else None
                    ),
                )
            )

        logger.info(
            "DXY %s: %s candles downloaded.",
            interval,
            len(candles),
        )

        return candles

    def get_dxy_data(self) -> MarketData:

        data = MarketData(
            symbol="DXY"
        )

        data.monthly = self._download(
            "1month",
            300,
        )

        data.weekly = self._download(
            "1week",
            500,
        )

        data.daily = self._download(
            "1day",
            1000,
        )

        data.h4 = self._download(
            "4h",
            1000,
        )

        data.h1 = self._download(
            "1h",
            2000,
        )

        data.m30 = self._download(
            "30min",
            3000,
        )

        data.m15 = self._download(
            "15min",
            5000,
        )

        data.m5 = self._download(
            "5min",
            5000,
        )

        data.m1 = self._download(
            "1min",
            5000,
        )

        # Build M3 from M1
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
                            c.high for c in group
                        ),
                        low=min(
                            c.low for c in group
                        ),
                        close=group[-1].close,
                        volume=sum(
                            c.volume or 0
                            for c in group
                        ),
                    )
                )

        return data