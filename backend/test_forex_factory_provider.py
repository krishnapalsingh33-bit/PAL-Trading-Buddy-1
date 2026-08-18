from providers.forex_factory_provider import (
    ForexFactoryProvider,
)


print("=" * 60)
print("FOREX FACTORY NEWS PROVIDER TEST")
print("=" * 60)


provider = ForexFactoryProvider()

events = provider.get_events()


print(
    f"Total USD/GBP events: {len(events)}"
)

print("=" * 60)


for event in events:

    print(
        {
            "title": event["title"],
            "currency": event["currency"],
            "impact": event["impact"],
            "time": event["time"].isoformat(),
            "forecast": event["forecast"],
            "previous": event["previous"],
        }
    )