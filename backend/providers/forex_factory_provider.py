from datetime import datetime, timezone

import requests


class ForexFactoryProvider:
    """
    Free Forex Factory / Fair Economy economic calendar provider.

    PAL uses it as a rich fallback when Apify is unavailable. The provider
    preserves actual, forecast and previous values when the feed supplies them.
    """

    URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    SOURCE_URL = "https://www.forexfactory.com/calendar"

    SUPPORTED_CURRENCIES = {"USD", "GBP"}

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/151.0 Safari/537.36"
            )
        })

    def get_events(self) -> list[dict]:
        try:
            response = self.session.get(self.URL, timeout=20)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, list):
                return []

            events = []
            for item in data:
                if not isinstance(item, dict):
                    continue

                currency = str(item.get("country", "")).upper()
                if currency not in self.SUPPORTED_CURRENCIES:
                    continue

                title = str(item.get("title", "")).strip()
                impact = str(item.get("impact", "")).strip()
                date_value = item.get("date")
                if not title or not date_value:
                    continue

                try:
                    event_time = datetime.fromisoformat(str(date_value).replace("Z", "+00:00"))
                except (TypeError, ValueError):
                    continue

                if event_time.tzinfo is not None:
                    event_time = event_time.astimezone(timezone.utc).replace(tzinfo=None)

                events.append({
                    "id": f"ForexFactory:{currency}:{title}:{event_time.isoformat()}",
                    "title": title,
                    "currency": currency,
                    "impact": impact,
                    "time": event_time,
                    "actual": item.get("actual"),
                    "forecast": item.get("forecast"),
                    "previous": item.get("previous"),
                    "country": currency,
                    "source": "Forex Factory",
                    "source_url": self.SOURCE_URL,
                })

            events.sort(key=lambda event: event["time"])
            return events
        except requests.RequestException:
            return []
        except ValueError:
            return []
        except Exception:
            return []
