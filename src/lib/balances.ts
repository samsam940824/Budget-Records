import { PaymentMethod, Record } from '../types/database.types';

/**
 * Balance of each account as of `asOf` (inclusive): the opening balance plus
 * income, minus expenses, minus transfers out, plus transfers in.
 * Records dated after `asOf` are scheduled, not yet settled.
 */
export function accountBalances(
    accounts: Pick<PaymentMethod, 'id' | 'initial_balance'>[],
    records: Pick<Record, 'type' | 'amount' | 'date' | 'payment_method_id' | 'to_payment_method_id'>[],
    asOf: string,
): Map<string, number> {
    const balances = new Map<string, number>();
    for (const a of accounts) balances.set(a.id, Number(a.initial_balance) || 0);

    const add = (id: string | null | undefined, delta: number) => {
        if (id && balances.has(id)) balances.set(id, (balances.get(id) ?? 0) + delta);
    };

    for (const r of records) {
        if (r.date > asOf) continue;
        const amount = Number(r.amount) || 0;
        if (r.type === 'income') add(r.payment_method_id, amount);
        else if (r.type === 'expense') add(r.payment_method_id, -amount);
        else {
            add(r.payment_method_id, -amount);
            add(r.to_payment_method_id, amount);
        }
    }
    return balances;
}

export function netWorth(
    accounts: Pick<PaymentMethod, 'id' | 'include_in_total' | 'archived'>[],
    balances: Map<string, number>,
): number {
    return accounts
        .filter(a => a.include_in_total !== false && !a.archived)
        .reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
}

export interface PeriodTotals {
    income: number;
    expense: number;
    net: number;
    count: number;
}

/** Income and expense totals; transfers move money and are not counted. */
export function periodTotals(records: Pick<Record, 'type' | 'amount'>[]): PeriodTotals {
    let income = 0;
    let expense = 0;
    let count = 0;
    for (const r of records) {
        if (r.type === 'income') { income += Number(r.amount) || 0; count++; }
        else if (r.type === 'expense') { expense += Number(r.amount) || 0; count++; }
    }
    return { income, expense, net: income - expense, count };
}
