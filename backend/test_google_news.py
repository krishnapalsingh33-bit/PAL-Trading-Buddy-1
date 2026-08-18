from providers.google_news_provider import GoogleNewsProvider


provider = GoogleNewsProvider()

headlines = provider.get_headlines()

print()
print("=" * 70)
print(f"GOOGLE NEWS HEADLINES: {len(headlines)}")
print("=" * 70)

for index, headline in enumerate(headlines, start=1):

    print()
    print(f"[{index}] {headline.get('currency')}")
    print(f"Title: {headline.get('title')}")
    print(f"Source: {headline.get('source')}")
    print(f"Published: {headline.get('published_at')}")
    print(f"URL: {headline.get('url')}")

print()
print("=" * 70)