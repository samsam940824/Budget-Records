import React, { useMemo, useState } from 'react';
import { Plus, ChevronRight, Edit2, ArrowLeftRight, X } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { PaymentMethod } from '../../types/database.types';
import { accountBalances, netWorth } from '../../lib/balances';
import { todayString } from '../../lib/dates';
import { IconTile } from '../../components/AppIcon';
import { Card } from '../../components/ui';
import { formatCurrency, formatDateHeader } from '../../utils/helpers';
import RecordRow, { buildLookup } from '../records/RecordRow';
import { useRecordUI } from '../records/RecordUI';
import AccountForm from './AccountForm';

export function useAccountBalances() {
    const { paymentMethods, records } = useData();
    return useMemo(() => {
        const balances = accountBalances(paymentMethods, records, todayString());
        return { balances, total: netWorth(paymentMethods, balances) };
    }, [paymentMethods, records]);
}

function AccountDetail({ account, onClose, onEdit }: { account: PaymentMethod; onClose: () => void; onEdit: () => void }) {
    const { records, categories, paymentMethods } = useData();
    const { balances } = useAccountBalances();
    const { openNew, openDetail } = useRecordUI();
    const lookup = useMemo(() => buildLookup(categories, paymentMethods), [categories, paymentMethods]);
    const list = useMemo(
        () => records.filter(r => r.payment_method_id === account.id || r.to_payment_method_id === account.id),
        [records, account.id],
    );
    const balance = balances.get(account.id) ?? 0;

    const groups = useMemo(() => {
        const map = new Map<string, typeof list>();
        for (const r of list) {
            const g = map.get(r.date);
            if (g) g.push(r); else map.set(r.date, [r]);
        }
        return [...map.entries()];
    }, [list]);

    return (
        <div className="fixed inset-0 bg-black z-40 flex flex-col max-w-md mx-auto animate-in slide-in-from-bottom-10" role="dialog" aria-label={account.name}>
            <div className="flex justify-between items-center px-4 pt-8 pb-4">
                <button onClick={onClose} aria-label="關閉" className="bg-zinc-800 text-zinc-300 p-2 rounded-full"><X size={20} /></button>
                <h2 className="text-lg font-bold text-white truncate px-2">{account.name}</h2>
                <button onClick={onEdit} aria-label="編輯帳戶" className="bg-zinc-800 text-zinc-300 p-2 rounded-full"><Edit2 size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-28">
                <div className="flex flex-col items-center my-6">
                    <IconTile icon={account.icon} color={account.color} size={64} />
                    <p className="text-zinc-400 text-sm mt-4">目前餘額</p>
                    <p className={`text-4xl font-bold ${balance < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(balance, account.currency_code)}</p>
                    <p className="text-zinc-500 text-xs mt-1">期初 {formatCurrency(account.initial_balance, account.currency_code)} · {list.length} 筆交易</p>
                </div>
                <div className="space-y-6">
                    {groups.map(([date, rs]) => (
                        <div key={date}>
                            <h3 className="text-white font-bold mb-2 ml-1 text-sm">{formatDateHeader(date)}</h3>
                            <Card className="overflow-hidden">
                                {rs.map((r, i) => (
                                    <RecordRow key={r.id} record={r} lookup={lookup} onClick={() => openDetail(r)} last={i === rs.length - 1} accountId={account.id} />
                                ))}
                            </Card>
                        </div>
                    ))}
                    {list.length === 0 && <p className="text-center text-zinc-500 py-8">這個帳戶還沒有交易</p>}
                </div>
            </div>
            <button
                onClick={() => openNew(account.id)}
                aria-label="在此帳戶新增交易"
                className="fixed bottom-8 right-4 w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black z-40"
            >
                <Plus size={24} />
            </button>
        </div>
    );
}

export default function AccountsView() {
    const { paymentMethods, loading } = useData();
    const { balances, total } = useAccountBalances();
    const { openNew } = useRecordUI();
    const [editing, setEditing] = useState<PaymentMethod | null | 'new'>(null);
    const [viewing, setViewing] = useState<PaymentMethod | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const active = paymentMethods.filter(a => !a.archived);
    const archived = paymentMethods.filter(a => a.archived);
    const assets = active.filter(a => a.include_in_total !== false && (balances.get(a.id) ?? 0) >= 0).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
    const debts = active.filter(a => a.include_in_total !== false && (balances.get(a.id) ?? 0) < 0).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);

    const renderList = (list: PaymentMethod[]) => (
        <Card className="overflow-hidden">
            {list.map((a, i) => {
                const b = balances.get(a.id) ?? 0;
                return (
                    <button key={a.id} onClick={() => setViewing(a)} className={`w-full flex items-center gap-3 p-4 text-left hover:bg-zinc-800/50 ${i < list.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                        <IconTile icon={a.icon} color={a.color} />
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{a.name}</p>
                            {a.include_in_total === false && <p className="text-zinc-500 text-xs">不計入淨資產</p>}
                        </div>
                        <p className={`font-bold ${b < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(b, a.currency_code)}</p>
                        <ChevronRight size={16} className="text-zinc-600" />
                    </button>
                );
            })}
        </Card>
    );

    // Keep the open detail in sync with edits made while it is shown.
    const viewingFresh = viewing ? paymentMethods.find(a => a.id === viewing.id) ?? null : null;

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">帳戶</h1>
                <div className="flex gap-2">
                    <button onClick={() => openNew()} aria-label="新增轉帳或交易" className="bg-zinc-800 p-2 rounded-full text-white"><ArrowLeftRight size={22} /></button>
                    <button onClick={() => setEditing('new')} aria-label="新增帳戶" className="bg-zinc-800 p-2 rounded-full text-white"><Plus size={22} /></button>
                </div>
            </div>

            <Card className="p-5 mb-8">
                <p className="text-zinc-400 text-sm mb-1">淨資產</p>
                <p className={`text-3xl font-bold mb-4 ${total < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(total)}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-zinc-500 text-xs">資產</p><p className="text-emerald-400 font-medium">{formatCurrency(assets)}</p></div>
                    <div className="text-right"><p className="text-zinc-500 text-xs">負債</p><p className="text-red-400 font-medium">{formatCurrency(debts)}</p></div>
                </div>
            </Card>

            {active.length > 0 && renderList(active)}
            {!loading && paymentMethods.length === 0 && <p className="text-center text-zinc-500 py-10">尚未建立帳戶</p>}

            {archived.length > 0 && (
                <div className="mt-8">
                    <button onClick={() => setShowArchived(s => !s)} className="text-zinc-400 text-sm font-medium mb-3 px-1">
                        {showArchived ? '隱藏' : '顯示'}已封存帳戶（{archived.length}）
                    </button>
                    {showArchived && renderList(archived)}
                </div>
            )}

            {viewingFresh && (
                <AccountDetail account={viewingFresh} onClose={() => setViewing(null)} onEdit={() => setEditing(viewingFresh)} />
            )}
            {editing && (
                <AccountForm
                    account={editing === 'new' ? null : editing}
                    onClose={() => {
                        if (editing !== 'new' && !paymentMethods.some(a => a.id === editing.id)) setViewing(null);
                        setEditing(null);
                    }}
                />
            )}
        </div>
    );
}
