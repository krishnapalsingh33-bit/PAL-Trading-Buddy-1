from datetime import datetime, timezone
import unittest

from analysis.cross_asset_bias_engine import CrossAssetBiasEngine
from analysis.today_only_bias_engine import TodayOnlyBiasEngine


class CrossAssetBiasEngineTests(unittest.TestCase):
    def test_btc_bias_uses_asset_momentum_and_cross_asset_context(self):
        result = CrossAssetBiasEngine.analyze({
            "BTCUSD": {"price": 84000, "change_percent": 1.2, "right_now_momentum_percent": 0.08},
            "DXY": {"price": 102, "change_percent": -0.25},
            "US10Y": {"price": 4.1, "change_percent": -0.2},
        })["btcusd"]
        self.assertEqual(result["bias"], "BULLISH")
        self.assertGreater(result["confidence"], 0)
        self.assertLessEqual(result["confidence"], 90)
        self.assertEqual(result["confidence_type"], "EVIDENCE_STRENGTH_NOT_WIN_PROBABILITY")

    def test_cross_asset_context_alone_does_not_force_direction(self):
        result = CrossAssetBiasEngine.analyze({
            "BTCUSD": {"price": None, "change_percent": None, "right_now_momentum_percent": None},
            "DXY": {"price": 102, "change_percent": -0.8},
        })["btcusd"]
        self.assertEqual(result["bias"], "UNKNOWN")
        self.assertEqual(result["status"], "INSUFFICIENT_DATA")

    def test_today_window_uses_india_calendar_date(self):
        event_time = datetime(2026, 10, 12, 19, 0, tzinfo=timezone.utc)
        now = datetime(2026, 10, 13, 2, 0, tzinfo=timezone.utc)
        self.assertTrue(TodayOnlyBiasEngine._today({"time": event_time.isoformat()}, now))


if __name__ == "__main__":
    unittest.main()
