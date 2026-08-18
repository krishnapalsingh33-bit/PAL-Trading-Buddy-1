from datetime import datetime, timezone

import requests


class ForexFactoryProvider:
    """
    Free Forex Factory economic calendar provider.

    Forex Factory publishes a weekly JSON calendar export
    through Fair Economy's calendar feed.

    PAL only needs:
        - title
        - currency
        - impact
        - time
        - forecast
        - previous
    """

    URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"

    SUPPORTED_CURRENCIES = {
        "USD",
        "GBP",
    }

    def __init__(self):
        self.session = requests.Session()

        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "Chrome/151.0 Safari/537.36"
                )
            }
        )

    def get_events(self) -> list[dict]:
        """
        Download the current weekly economic calendar.

        Returns events in the format expected by PAL's
        NewsEngine.
        """

        try:
            response = self.session.get(
                self.URL,
                timeout=20,
            )

            response.raise_for_status()

            data = response.json()

            if not isinstance(data, list):
                return []

            events = []

            for item in data:

                if not isinstance(item, dict):
                    continue

                currency = str(
                    item.get("country", "")
                ).upper()

                if currency not in self.SUPPORTED_CURRENCIES:
                    continue

                title = str(
                    item.get("title", "")
                ).strip()

                impact = str(
                    item.get("impact", "")
                ).strip()

                date_value = item.get("date")

                if not title or not date_value:
                    continue

                try:
                    event_time = datetime.fromisoformat(
                        date_value
                    )

                except (
                    TypeError,
                    ValueError,
                ):
                    continue

                # Convert the source timestamp to UTC.
                if event_time.tzinfo is not None:
                    event_time = (
                        event_time
                        .astimezone(timezone.utc)
                        .replace(tzinfo=None)
                    )

                events.append(
                    {
                        "title": title,
                        "currency": currency,
                        "impact": impact,
                        "time": event_time,
                        "forecast": item.get(
                            "forecast",
                            "",
                        ),
                        "previous": item.get(
                            "previous",
                            "",
                        ),
                    }
                )

            events.sort(
                key=lambda event: event["time"]
            )

            return events

        except requests.RequestException:
            return []

        except ValueError:
            return []

        except Exception:
            return []