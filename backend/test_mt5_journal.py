from providers.mt5_journal_provider import MT5JournalProvider


provider = MT5JournalProvider()

journal = provider.get_journal(
    days=30
)


print("=" * 60)
print("ACCOUNT")
print("=" * 60)

print(journal["account"])


print("=" * 60)
print("OPEN POSITIONS")
print("=" * 60)

if journal["open_positions"]:

    for position in journal["open_positions"]:
        print(position)

else:

    print("No open positions.")


print("=" * 60)
print("COMPLETED TRADES")
print("=" * 60)

if journal["trades"]:

    for trade in journal["trades"]:
        print(trade)

else:

    print("No completed trades found.")


print("=" * 60)
print("JOURNAL STATISTICS")
print("=" * 60)

print(journal["statistics"])