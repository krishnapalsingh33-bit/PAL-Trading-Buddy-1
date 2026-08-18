import unittest

from providers.online_market_data_provider import YahooMarketDataProvider


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self, payload):
        self.payload = payload
        self.headers = {}

    def get(self, *args, **kwargs):
        return FakeResponse(self.payload)


class YahooMarketDataProviderTests(unittest.TestCase):
    def test_symbol_mapping(self):
        self.assertEqual(YahooMarketDataProvider.yahoo_symbol("DXY"), "DX-Y.NYB")
        self.assertEqual(YahooMarketDataProvider.yahoo_symbol("GBP/USD"), "GBPUSD=X")
        self.assertEqual(YahooMarketDataProvider.yahoo_symbol("XAUUSD"), "GC=F")
        self.assertEqual(YahooMarketDataProvider.yahoo_symbol("WTI"), "CL=F")
        self.assertEqual(YahooMarketDataProvider.yahoo_symbol("US10Y"), "^TNX")
        self.assertEqual(YahooMarketDataProvider.yahoo_symbol("US500"), "^GSPC")

    def test_normalizes_quote_and_calculates_change(self):
        payload = {
            "chart": {
                "error": None,
                "result": [{
                    "meta": {
                        "regularMarketPrice": 1.35,
                        "previousClose": 1.34,
                        "regularMarketTime": 1760000000,
                    },
                    "timestamp": [1760000000],
                    "indicators": {"quote": [{"close": [1.35]}]},
                }],
            }
        }
        provider = YahooMarketDataProvider(session=FakeSession(payload))
        quote = provider.get_quote("GBPUSD")

        self.assertEqual(quote.symbol, "GBPUSD")
        self.assertEqual(quote.price, 1.35)
        self.assertEqual(quote.previous_price, 1.34)
        self.assertAlmostEqual(quote.change, 0.01)
        self.assertAlmostEqual(quote.change_percent, (0.01 / 1.34) * 100)
        self.assertEqual(quote.status, "CURRENT")
        self.assertEqual(quote.source, "Yahoo Finance")

    def test_provider_failure_is_non_fatal(self):
        class FailingSession:
            def __init__(self):
                self.headers = {}

            def get(self, *args, **kwargs):
                raise TimeoutError("simulated timeout")

        provider = YahooMarketDataProvider(session=FailingSession())
        quote = provider.get_quote("US500")

        self.assertEqual(quote.status, "UNAVAILABLE")
        self.assertIsNone(quote.price)
        self.assertIsNotNone(quote.reason)


if __name__ == "__main__":
    unittest.main()
