export interface JournalAccount {
    login: number;
    server: string;
    name: string;
    currency: string;
    balance: number;
    equity: number;
    margin: number;
    free_margin: number;
}

export interface JournalPosition {
    ticket: number;
    symbol: string;
    type: string;
    volume: number;
    price_open: number;
    stop_loss: number;
    take_profit: number;
    profit: number;
    swap: number;
    time: string;
}

export interface JournalTrade {
    position_id: number;
    symbol: string;
    direction: string;
    volume: number;
    entry_price: number;
    exit_price: number;
    entry_time: string;
    exit_time: string;
    duration_seconds: number;
    profit: number;
    commission: number;
    swap: number;
    fee: number;
    net_profit: number;
    result: string;
    entry_ticket: number;
    exit_ticket: number;
    comment: string;
}

export interface JournalStatistics {
    total_trades: number;
    wins: number;
    losses: number;
    breakeven: number;
    win_rate: number;
    gross_profit: number;
    gross_loss: number;
    commission: number;
    swap: number;
    fee: number;
    net_profit: number;
    average_win: number;
    average_loss: number;
    profit_factor: number | null;
    average_duration_seconds: number;
    best_trade: JournalTrade | null;
    worst_trade: JournalTrade | null;
}

export interface JournalData {
    account: JournalAccount;
    open_positions: JournalPosition[];
    trades: JournalTrade[];
    statistics: JournalStatistics;
    period_days: number;
}

export interface JournalResponse {
    success: boolean;
    data: JournalData;
}