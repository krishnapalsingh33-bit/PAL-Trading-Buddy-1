from __future__ import annotations

import time
import unittest
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import Mock, patch

import main


class MarketApiTests(unittest.TestCase):
    def setUp(self) -> None:
        with main._CACHE_LOCK:
            main._CACHE.clear()

    def test_expected_symbols_are_configured(self) -> None:
        self.assertEqual(set(main.SYMBOLS), {"DXY", "XAUUSD", "BTCUSD", "GBPUSD"})
        self.assertEqual(main.SYMBOLS["BTCUSD"]["provider_symbol"], "BTC-USD")
        self.assertEqual(main.SYMBOLS["DXY"]["provider_symbol"], "DX-Y.NYB")
        self.assertEqual(main.SYMBOLS["XAUUSD"]["provider_symbol"], "GC=F")
        self.assertEqual(main.SYMBOLS["GBPUSD"]["provider_symbol"], "GBPUSD=X")

    def test_freshness_boundaries(self) -> None:
        now = datetime.now(timezone.utc)
        self.assertEqual(main.freshness(now.isoformat())[0], "CURRENT")
        self.assertEqual(main.freshness((now.timestamp() - 3600).__str__())[0], "UNAVAILABLE")
        recent = datetime.fromtimestamp(now.timestamp() - 3600, timezone.utc).isoformat()
        stale = datetime.fromtimestamp(now.timestamp() - 90000, timezone.utc).isoformat()
        self.assertEqual(main.freshness(recent)[0], "RECENT")
        self.assertEqual(main.freshness(stale)[0], "STALE")

    def test_fetch_one_parses_live_quote_and_caches_it(self) -> None:
        now = int(time.time())
        response = Mock()
        response.json.return_value = {
            "chart": {
                "error": None,
                "result": [{
                    "meta": {"regularMarketPrice": 70000.0, "chartPreviousClose": 69000.0, "regularMarketTime": now},
                    "timestamp": [now - 60, now],
                    "indicators": {"quote": [{"close": [69500.0, 70000.0], "low": [69200.0, 69800.0], "high": [69900.0, 70300.0]}]},
                }],
            }
        }
        with patch.object(main.requests, "get", return_value=response) as get:
            quote = main.fetch_one("BTCUSD")
            self.assertEqual(quote["price"], 70000.0)
            self.assertAlmostEqual(quote["change_percent"], (1000 / 69000) * 100)
            self.assertEqual(quote["status"], "CURRENT")
            self.assertEqual(quote["source"], "Yahoo Finance chart API")
            # Second call should use the short cache instead of issuing another request.
            self.assertEqual(main.fetch_one("BTCUSD")["price"], 70000.0)
            self.assertEqual(get.call_count, 1)

    def test_fetch_one_reports_provider_failure_without_fake_price(self) -> None:
        with patch.object(main.requests, "get", side_effect=TimeoutError("test timeout")):
            quote = main.fetch_one("DXY")
        self.assertIsNone(quote["price"])
        self.assertEqual(quote["status"], "UNAVAILABLE")
        self.assertIn("Quote provider failed", quote["reason"])

    def test_market_snapshot_distinguishes_api_from_provider_status(self) -> None:
        current = datetime.now(timezone.utc).isoformat()
        def fake_quote(key: str) -> dict:
            return {"symbol": key, "price": 1.0, "status": "CURRENT", "timestamp": current, "change": 0.1, "change_percent": 1.0, "source": "unit test", "reason": None}
        with patch.object(main, "fetch_one", side_effect=fake_quote):
            result = main.market_snapshot()
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "CONNECTED")
        self.assertEqual(result["provider"]["usable_quotes"], 4)
        self.assertEqual(set(result["markets"]), set(main.SYMBOLS))

    def test_root_serves_dashboard_file(self) -> None:
        response = main.root()
        self.assertTrue(str(response.path).endswith("dashboard.html"))

    def test_analysis_proxy_rejects_unapproved_symbol(self) -> None:
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as caught:
            main.proxy_analysis("http://example.com")
        self.assertEqual(caught.exception.status_code, 400)

    def test_mobile_dashboard_download_file_is_present(self) -> None:
        response = main.download_mobile_dashboard()
        self.assertTrue(str(response.path).endswith("PAL-Trading-Buddy-Mobile.html"))
        self.assertTrue(Path(response.path).is_file())

    def test_right_now_dashboard_has_all_four_assets_and_direction_states(self) -> None:
        html = Path(__file__).with_name("dashboard.html").read_text(encoding="utf-8")
        self.assertIn('id="right-now-cards"', html)
        for symbol in ('key:"DXY"', 'key:"GBPUSD"', 'key:"XAUUSD"', 'key:"BTCUSD"'):
            self.assertIn(symbol, html)
        for label in ("BULLISH", "BEARISH", "NEUTRAL", "WAIT"):
            self.assertIn(label, html)

    def test_mobile_dashboard_calls_hosted_api(self) -> None:
        html = Path(__file__).with_name("PAL-Trading-Buddy-Mobile.html").read_text(encoding="utf-8")
        self.assertIn('var API_BASE="https://pal-market-data-api.onrender.com"', html)
        self.assertIn('target=(path.indexOf("http://")===0||path.indexOf("https://")===0)?path:API_BASE+path', html)

    def test_pwa_assets_are_installed_from_same_origin(self) -> None:
        dashboard = Path(__file__).with_name("dashboard.html").read_text(encoding="utf-8")
        manifest = Path(__file__).with_name("manifest.webmanifest").read_text(encoding="utf-8")
        worker = Path(__file__).with_name("service-worker.js").read_text(encoding="utf-8")
        self.assertIn('rel="manifest" href="/manifest.webmanifest"', dashboard)
        self.assertIn('navigator.serviceWorker.register("/service-worker.js")', dashboard)
        self.assertIn('"display": "standalone"', manifest)
        self.assertIn('"/pal/"', worker)

    def test_pwa_routes_return_existing_assets(self) -> None:
        for response, suffix in (
            (main.web_manifest(), "manifest.webmanifest"),
            (main.service_worker(), "service-worker.js"),
            (main.app_icon(), "app-icon.svg"),
        ):
            self.assertTrue(str(response.path).endswith(suffix))
            self.assertTrue(Path(response.path).is_file())

    def test_analysis_status_returns_quick_structured_failure(self) -> None:
        from unittest.mock import patch
        with patch.object(main, "_proxy_pal_json", side_effect=RuntimeError("mock offline")):
            result = main.analysis_status()
        self.assertFalse(result["success"])
        self.assertFalse(result["reachable"])
        self.assertIn("unavailable", result["error"].lower())


if __name__ == "__main__":
    unittest.main()
