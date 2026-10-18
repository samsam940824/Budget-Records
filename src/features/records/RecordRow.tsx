import React from 'react';
import { Repeat } from 'lucide-react';
import { Category, PaymentMethod, Record } from '../../types/database.types';
import { IconTile } from '../../components/AppIcon';
import { amountColor, formatSigned, formatShortDate } from '../../utils/helpers';

export interface Lookup {
    categoryById: Map<string, Category>;
    accountById: Map<string, PaymentMethod>;
}

export const buildLookup = (categories: Category[], accounts: PaymentMethod[]): Lookup => ({
    categoryById: new Map(categories.map(c => [c.id, c])),
    accountById: new Map(accounts.map(a => [a.id, a])),
});

export function recordTitle(r: Record, lookup: Lookup): string {
    if (r.description) return r.description;
    if (r.type === 'transfer') return '轉帳';
    return (r.category_id && lookup.categoryById.get(r.category_id)?.name) || '未分類';
}

export function recordSubtitle(r: Record, lookup: Lookup): string {
    const from = r.payment_method_id ? lookup.accountById.get(r.payment_method_id)?.name : undefined;
    if (r.type === 'transfer') {
        const to = r.to_payment_method_id ? lookup.accountById.get(r.to_payment_method_id)?.name : undefined;
        return `${from ?? '未指定'} → ${to ?? '未指定'}`;
    }
    const cat = r.category_id ? lookup.categoryById.get(r.category_id)?.name : undefined;
    return [cat ?? '無類別', r.time ? r.time.slice(0, 5) : null, from].filter(Boolean).join(' • ');
}

export default function RecordRow({
    record, lookup, onClick, showDate, last, accountId,
}: {
    record: Record;
    lookup: Lookup;
    onClick?: () => void;
    showDate?: boolean;
    last?: boolean;
    /** When listing one account, transfers show as money in (+) or out (-). */
    accountId?: string;
}) {
    const cat = record.category_id ? lookup.categoryById.get(record.category_id) : undefined;
    const isTransfer = record.type === 'transfer';
    const transferSign = isTransfer && accountId
        ? (record.to_payment_method_id === accountId ? '+' : '-')
        : '';
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left flex items-center justify-between gap-3 p-4 hover:bg-zinc-800/50 transition-colors ${last ? '' : 'border-b border-zinc-800'}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <IconTile
                    icon={isTransfer ? 'ArrowLeftRight' : cat?.icon}
                    color={isTransfer ? '#38bdf8' : cat?.color}
                />
                <div className="min-w-0">
                    <p className="text-white font-medium truncate flex items-center gap-1.5">
                        {recordTitle(record, lookup)}
                        {record.recurring_id && <Repeat size={12} className="text-zinc-500 shrink-0" aria-label="定期交易" />}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5 truncate">
                        {showDate ? `${formatShortDate(record.date)} • ` : ''}{recordSubtitle(record, lookup)}
                    </p>
                </div>
            </div>
            <p className={`font-bold shrink-0 ${amountColor(record.type)}`}>
                {transferSign}{formatSigned(record.amount, record.type, record.currency_code)}
            </p>
        </button>
    );
}
