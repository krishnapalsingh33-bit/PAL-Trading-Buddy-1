import MetaTrader5 as mt5


if not mt5.initialize():
    print("MT5 initialization failed:")
    print(mt5.last_error())
    raise SystemExit


try:
    account = mt5.account_info()

    if account is None:
        print("Unable to retrieve MT5 account information.")
        print(mt5.last_error())
        raise SystemExit

    print("=" * 50)
    print("MT5 ACCOUNT CONNECTION")
    print("=" * 50)

    print("Login:", account.login)
    print("Server:", account.server)
    print("Name:", account.name)
    print("Currency:", account.currency)
    print("Balance:", account.balance)
    print("Equity:", account.equity)

    positions = mt5.positions_get()

    print("=" * 50)
    print("OPEN POSITIONS")
    print("=" * 50)

    if positions is None:
        print("Unable to retrieve positions.")
        print(mt5.last_error())
    elif len(positions) == 0:
        print("No open positions.")
    else:
        for position in positions:
            print(
                position.ticket,
                position.symbol,
                position.volume,
                position.price_open,
                position.profit,
            )

finally:
    mt5.shutdown()