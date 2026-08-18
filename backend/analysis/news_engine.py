from datetime import datetime, timezone


class NewsEngine:
    """
    PAL Macro News Engine.

    Handles:
        1. Economic calendar events
        2. USD macro news
        3. GBP macro news
        4. GBP/USD cross-market news

    This engine does NOT:
        - analyze chart structure
        - create trading setups
        - create entries
        - create stop losses
        - create targets
        - determine trade readiness
        - use trading strategy rules
    """

    # ==========================================================
    # IMPORTANT ECONOMIC EVENTS
    # ==========================================================

    HIGH_IMPACT = {
        # US inflation
        "CPI",
        "Core CPI",
        "PPI",
        "Core PCE",
        "PCE",

        # US employment
        "NFP",
        "Nonfarm Payrolls",
        "Employment Change",
        "Unemployment Rate",
        "Initial Jobless Claims",
        "Jobless Claims",
        "Average Hourly Earnings",

        # Central banks
        "Interest Rate Decision",
        "FOMC",
        "Fed",
        "Federal Reserve",
        "BoE",
        "Bank of England",

        # Growth
        "GDP",
        "PMI",
        "Manufacturing PMI",
        "Services PMI",
        "Retail Sales",

        # Consumer
        "Consumer Confidence",
        "Consumer Sentiment",
        "Inflation Expectations",
    }

    IMPORTANT_CURRENCIES = {
        "USD",
        "GBP",
    }

    # ==========================================================
    # MAIN ANALYSIS
    # ==========================================================

    def analyze(
        self,
        events: list[dict],
        now: datetime,
        articles: list[dict] | None = None,
    ) -> dict:

        upcoming = []

        recent = []

        # ======================================================
        # ECONOMIC CALENDAR
        # ======================================================

        for event in events:

            if not isinstance(
                event,
                dict,
            ):
                continue

            title = str(
                event.get(
                    "title",
                    event.get(
                        "event",
                        "",
                    ),
                )
            ).strip()

            if not title:
                continue

            currency = str(
                event.get(
                    "currency",
                    "",
                )
            ).strip().upper()

            if (
                currency
                and currency
                not in self.IMPORTANT_CURRENCIES
            ):
                continue

            if not self._is_important_event(
                title
            ):
                continue

            impact = self._normalize_impact(
                event
            )

            event_time = (
                self._get_event_time(
                    event
                )
            )

            if event_time is None:
                continue

            if event_time.tzinfo is None:

                event_time = (
                    event_time.replace(
                        tzinfo=timezone.utc
                    )
                )

            if now.tzinfo is None:

                now = now.replace(
                    tzinfo=timezone.utc
                )

            event_time = (
                event_time.astimezone(
                    timezone.utc
                )
            )

            minutes = (
                event_time - now
            ).total_seconds() / 60

            item = {

                "id": str(
                    event.get(
                        "id",
                        "",
                    )
                ),

                "title": title,

                "currency": (
                    currency
                    or "USD/GBP"
                ),

                "time": (
                    event_time.isoformat()
                ),

                "impact": impact,

                "category": event.get(
                    "category",
                    "",
                ),

                "actual": event.get(
                    "actual"
                ),

                "forecast": event.get(
                    "forecast"
                ),

                "previous": event.get(
                    "previous"
                ),

                "minutes": round(
                    minutes
                ),

                "country": event.get(
                    "country",
                    "",
                ),

                "source": event.get(
                    "source",
                    "",
                ),
            }

            # Upcoming
            if minutes >= 0:

                upcoming.append(
                    item
                )

            # Last 3 hours
            elif minutes >= -180:

                item[
                    "minutes_since"
                ] = round(
                    abs(minutes)
                )

                recent.append(
                    item
                )

        # ======================================================
        # SORT CALENDAR
        # ======================================================

        upcoming.sort(
            key=lambda item: item[
                "minutes"
            ]
        )

        recent.sort(
            key=lambda item: item.get(
                "minutes_since",
                999999,
            )
        )

        upcoming = upcoming[:10]

        recent = recent[:10]

        # ======================================================
        # NEWS
        # ======================================================

        processed_news = (
            self._process_articles(
                articles or []
            )
        )

        # ======================================================
        # SPLIT NEWS BY MARKET
        # ======================================================

        usd_news = []

        gbp_news = []

        cross_news = []

        for article in processed_news:

            currency = str(
                article.get(
                    "currency",
                    "",
                )
            ).upper()

            if currency == "USD":

                usd_news.append(
                    article
                )

            elif currency == "GBP":

                gbp_news.append(
                    article
                )

            elif currency == "CROSS":

                cross_news.append(
                    article
                )

        # ======================================================
        # SUMMARY
        # ======================================================

        summary = (
            self._build_summary(
                upcoming=upcoming,
                recent=recent,
                usd_news=usd_news,
                gbp_news=gbp_news,
                cross_news=cross_news,
            )
        )

        # ======================================================
        # WARNINGS
        # ======================================================

        warnings = (
            self._build_warnings(
                upcoming
            )
        )

        # ======================================================
        # KEY RISK
        # ======================================================

        key_risk = (
            self._build_key_risk(
                upcoming=upcoming,
                recent=recent,
                usd_news=usd_news,
                gbp_news=gbp_news,
                cross_news=cross_news,
            )
        )

        # ======================================================
        # FINAL RESULT
        # ======================================================

        return {

            "summary": summary,

            "upcoming_events": upcoming,

            "recent_events": recent,

            "high_impact": [
                event
                for event in upcoming
                if event.get(
                    "impact"
                ) == "High"
            ],

            "warnings": warnings,

            "key_risk": key_risk,

            # ==================================================
            # PHASE C NEWS
            # ==================================================

            "headlines": processed_news,

            "usd": usd_news,

            "gbp": gbp_news,

            "cross": cross_news,
        }

    # ==========================================================
    # IMPACT
    # ==========================================================

    @staticmethod
    def _normalize_impact(
        event: dict,
    ) -> str:

        value = str(
            event.get(
                "impact",
                event.get(
                    "importance",
                    "",
                ),
            )
        ).strip().upper()

        if value in {
            "HIGH",
            "MEDIUM",
            "LOW",
        }:

            if value == "HIGH":
                return "High"

            if value == "MEDIUM":
                return "Medium"

            return "Low"

        try:

            importance = int(
                event.get(
                    "importance"
                )
            )

            if importance >= 3:
                return "High"

            if importance == 2:
                return "Medium"

        except (
            TypeError,
            ValueError,
        ):

            pass

        return "Low"

    # ==========================================================
    # EVENT DATETIME
    # ==========================================================

    @staticmethod
    def _get_event_time(
        event: dict,
    ):

        value = event.get(
            "time"
        )

        if isinstance(
            value,
            datetime,
        ):

            return value

        if not value:
            return None

        try:

            return datetime.fromisoformat(
                str(value).replace(
                    "Z",
                    "+00:00",
                )
            )

        except (
            TypeError,
            ValueError,
        ):

            return None

    # ==========================================================
    # IMPORTANT EVENT
    # ==========================================================

    @classmethod
    def _is_important_event(
        cls,
        title: str,
    ) -> bool:

        normalized = (
            title.lower()
        )

        for important in cls.HIGH_IMPACT:

            if (
                important.lower()
                in normalized
            ):

                return True

        return False

    # ==========================================================
    # PROCESS ARTICLES
    # ==========================================================

    @staticmethod
    def _process_articles(
        articles: list[dict],
    ) -> list[dict]:

        processed = []

        seen = set()

        for article in articles:

            if not isinstance(
                article,
                dict,
            ):
                continue

            title = str(
                article.get(
                    "title",
                    "",
                )
            ).strip()

            if not title:
                continue

            key = (
                title.lower()
            )

            if key in seen:
                continue

            seen.add(key)

            currency = str(
                article.get(
                    "currency",
                    "",
                )
            ).upper()

            # ----------------------------------------------
            # Preserve the three news buckets.
            # ----------------------------------------------

            if currency not in {
                "USD",
                "GBP",
                "CROSS",
            }:

                currency = "CROSS"

            processed.append(
                {
                    "id": article.get(
                        "id",
                        "",
                    ),

                    "title": title,

                    "currency": currency,

                    "impact": (
                        article.get(
                            "impact",
                            "Medium",
                        )
                    ),

                    "published_at": (
                        article.get(
                            "published_at",
                            "",
                        )
                    ),

                    "source": (
                        article.get(
                            "source",
                            "",
                        )
                    ),

                    "url": (
                        article.get(
                            "url",
                            "",
                        )
                    ),

                    "provider": (
                        article.get(
                            "provider",
                            "Google News",
                        )
                    ),
                }
            )

        # ------------------------------------------------------
        # Newest first.
        # ------------------------------------------------------

        processed.sort(
            key=lambda item: item.get(
                "published_at",
                "",
            ),
            reverse=True,
        )

        return processed[:15]

    # ==========================================================
    # SUMMARY
    # ==========================================================

    @staticmethod
    def _build_summary(
        upcoming: list[dict],
        recent: list[dict],
        usd_news: list[dict],
        gbp_news: list[dict],
        cross_news: list[dict],
    ) -> str:

        # ------------------------------------------------------
        # Calendar gets highest priority.
        # ------------------------------------------------------

        if upcoming:

            first = upcoming[0]

            minutes = first[
                "minutes"
            ]

            if minutes <= 60:

                return (
                    f"{first['title']} "
                    "is the next major "
                    "macro event."
                )

            return (
                f"{len(upcoming)} important "
                "macro event"
                + (
                    " is"
                    if len(upcoming) == 1
                    else "s are"
                )
                + " currently on the radar."
            )

        # ------------------------------------------------------
        # Recent calendar event.
        # ------------------------------------------------------

        if recent:

            return (
                f"{recent[0]['title']} "
                "was recently released. "
                "Recent macro news is also "
                "being monitored."
            )

        # ------------------------------------------------------
        # News.
        # ------------------------------------------------------

        total_news = (
            len(usd_news)
            + len(gbp_news)
            + len(cross_news)
        )

        if total_news:

            return (
                f"{total_news} relevant "
                "USD/GBP macro news "
                "headline"
                + (
                    " is"
                    if total_news == 1
                    else "s are"
                )
                + " currently being monitored."
            )

        return (
            "No major USD or GBP macro "
            "events or relevant news "
            "are currently on the radar."
        )

    # ==========================================================
    # WARNINGS
    # ==========================================================

    @staticmethod
    def _build_warnings(
        upcoming: list[dict],
    ) -> list[str]:

        warnings = []

        for event in upcoming[:3]:

            minutes = event[
                "minutes"
            ]

            if minutes <= 60:

                warnings.append(
                    f"{event['title']} "
                    f"in {minutes} minutes."
                )

        return warnings

    # ==========================================================
    # KEY RISK
    # ==========================================================

    @staticmethod
    def _build_key_risk(
        upcoming: list[dict],
        recent: list[dict],
        usd_news: list[dict],
        gbp_news: list[dict],
        cross_news: list[dict],
    ) -> str:

        # ------------------------------------------------------
        # Upcoming event.
        # ------------------------------------------------------

        if upcoming:

            event = upcoming[0]

            currency = event.get(
                "currency",
                "",
            )

            return (
                f"Next major catalyst: "
                f"{currency} "
                f"{event['title']}."
            )

        # ------------------------------------------------------
        # Recent event.
        # ------------------------------------------------------

        if recent:

            event = recent[0]

            return (
                f"Recent catalyst: "
                f"{event['title']}."
            )

        # ------------------------------------------------------
        # Cross-market news.
        # ------------------------------------------------------

        if cross_news:

            return (
                "GBP/USD macro developments "
                "are currently the main "
                "cross-market news focus."
            )

        # ------------------------------------------------------
        # USD news.
        # ------------------------------------------------------

        if usd_news:

            return (
                "USD macro developments "
                "are currently being monitored."
            )

        # ------------------------------------------------------
        # GBP news.
        # ------------------------------------------------------

        if gbp_news:

            return (
                "GBP macro developments "
                "are currently being monitored."
            )

        return (
            "No major scheduled macro "
            "catalyst currently identified."
        )