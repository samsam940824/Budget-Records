import React, { useMemo, useState } from 'react';
import { ChevronRight, Pause, Play, Trash2 } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { RecurringTransaction } from '../../types/database.types';
import { describeSchedule, dueOccurrences } from '../../lib/recurring';
import { addDays, todayString } from '../../lib/dates';
import { IconTile } from '../../components/AppIcon';
import { Card, ConfirmDialog, FieldRow, Sheet, Toggle } from '../../components/ui';
import { amountColor, formatCurrency, formatShortDate } from '../../utils/helpers';
import { buildLookup } from '../records/RecordRow';

function RuleEditor({ rule, onClose }: { rule: RecurringTransaction; onClose: () => void }) {
    const { records, updateRecurring, deleteRecurring } = useData();
    const [amount, setAmount] = useState(String(rule.amount));
    const [description, setDescription] = useState(rule.description ?? '');
    const [hasEnd, setHasEnd] = useState(!!rule.end_date);
    const [endDate, setEndDate] = useState(rule.end_date ?? '');
    const [error, setError] = useState<string | null>(null);
    const [confirm, setConfirm] = useState(false);
    const generated = records.filter(r => r.recurring_id === rule.id).length;

    const save = async () => {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) { setError('請輸入金額'); return; }
        if (hasEnd && endDate && endDate < rule.start_date) { setError('結束日期早於開始日期'); return; }
        try {
            const end = hasEnd && endDate ? endDate : null;
            const wasFinished = !!rule.end_date && rule.next_date > rule.end_date;
            const nowFinished = end !== null && rule.next_date > end;
            await updateRecurring(rule.id, {
                amount: value,
                description,
                end_date: end,
                // Extending the end date of a finished rule starts it again.
                active: nowFinished ? false : wasFinished ? true : rule.active,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '儲存失敗');
        }
    };

    return (
        <Sheet title="定期交易" onClose={onClose} action={{ label: '儲存', onClick: save }} zIndex={60}>
            <p className="text-zinc-500 text-sm mb-4 px-1">修改只影響之後產生的交易，已產生的 {generated} 筆不會改變。</p>
            {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}
            <Card className="p-2 mb-6">
                <FieldRow label="金額">
                    <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="bg-transparent text-white text-right w-full outline-none" aria-label="金額" />
                </FieldRow>
                <FieldRow label="備註">
                    <input value={description} onChange={e => setDescription(e.target.value)} className="bg-transparent text-white text-right w-full outline-none" aria-label="備註" />
                </FieldRow>
                <FieldRow label="頻率"><span className="text-zinc-400">{describeSchedule(rule)}</span></FieldRow>
                <FieldRow label="開始"><span className="text-zinc-400">{rule.start_date}</span></FieldRow>
                <FieldRow label="結束" last>
                    <div className="flex items-center gap-3">
                        {hasEnd && <input type="date" value={endDate} min={rule.start_date} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-right outline-none text-sm" aria-label="結束日期" />}
                        <Toggle checked={hasEnd} onChange={setHasEnd} label="設定結束日期" />
                    </div>
                </FieldRow>
            </Card>
            <button onClick={() => setConfirm(true)} className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 font-medium flex items-center justify-center gap-2">
                <Trash2 size={18} /> 刪除定期交易
            </button>
            {confirm && (
                <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-6" role="alertdialog" aria-label="刪除定期交易">
                    <div className="bg-zinc-900 rounded-3xl w-full max-w-xs p-6 text-center space-y-3">
                        <h3 className="text-white font-bold text-lg">刪除定期交易？</h3>
                        <p className="text-zinc-400 text-sm">之後不會再自動產生。已產生的 {generated} 筆要怎麼處理？</p>
                        <button onClick={async () => { await deleteRecurring(rule.id, false); onClose(); }} className="w-full py-3 rounded-xl bg-zinc-800 text-white font-medium">保留已產生的交易</button>
                        <button onClick={async () => { await deleteRecurring(rule.id, true); onClose(); }} className="w-full py-3 rounded-xl bg-red-500 text-white font-bold">一併刪除 {generated} 筆</button>
                        <button onClick={() => setConfirm(false)} className="w-full py-2 text-zinc-400 text-sm">取消</button>
                    </div>
                </div>
            )}
        </Sheet>
    );
}

/**
 * Resuming skips what would have happened while paused: next_date moves to
 * the first occurrence on or after today instead of back-filling.
 */
function resumePatch(rule: RecurringTransaction): Partial<RecurringTransaction> {
    const today = todayString();
    if (rule.next_date >= today) return { active: true };
    return { active: true, next_date: dueOccurrences(rule, addDays(today, -1)).nextDate };
}

export default function RecurringManager({ onBack }: { onBack: () => void }) {
    const { recurring, categories, paymentMethods, updateRecurring } = useData();
    const lookup = useMemo(() => buildLookup(categories, paymentMethods), [categories, paymentMethods]);
    const [editing, setEditing] = useState<RecurringTransaction | null>(null);
    const [error, setError] = useState<string | null>(null);

    const sorted = [...recurring].sort((a, b) => Number(b.active) - Number(a.active) || a.next_date.localeCompare(b.next_date));
    const isFinished = (r: RecurringTransaction) => !!r.end_date && r.next_date > r.end_date;

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex items-center space-x-3 mb-6">
                <button onClick={onBack} aria-label="返回" className="bg-zinc-800 p-2 rounded-full text-white"><ChevronRight className="rotate-180" size={24} /></button>
                <h1 className="text-2xl font-bold text-white">定期交易</h1>
            </div>
            <p className="text-zinc-500 text-sm mb-4 px-1">新增交易時把「重複」設為每日、每週、每月或每年，就會出現在這裡並自動記帳。</p>
            {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
            <Card className="overflow-hidden">
                {sorted.map((r, i) => {
                    const c = r.category_id ? lookup.categoryById.get(r.category_id) : undefined;
                    const finished = isFinished(r);
                    return (
                        <div key={r.id} className={`flex items-center gap-3 p-3 ${i < sorted.length - 1 ? 'border-b border-zinc-800' : ''} ${r.active ? '' : 'opacity-60'}`}>
                            <button onClick={() => setEditing(r)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                                <IconTile icon={r.type === 'transfer' ? 'ArrowLeftRight' : c?.icon} color={r.type === 'transfer' ? '#38bdf8' : c?.color} />
                                <div className="min-w-0">
                                    <p className="text-white font-medium truncate">{r.description || c?.name || (r.type === 'transfer' ? '轉帳' : '未分類')}</p>
                                    <p className="text-zinc-500 text-xs">
                                        {describeSchedule(r)} · {finished ? '已結束' : r.active ? `下次 ${formatShortDate(r.next_date)}` : '已暫停'}
                                    </p>
                                </div>
                                <span className={`ml-auto font-bold shrink-0 ${amountColor(r.type)}`}>{formatCurrency(r.amount, r.currency_code)}</span>
                            </button>
                            {!finished && (
                                <button
                                    onClick={async () => {
                                        try { await updateRecurring(r.id, r.active ? { active: false } : resumePatch(r)); }
                                        catch (err) { setError(err instanceof Error ? err.message : '更新失敗'); }
                                    }}
                                    aria-label={r.active ? '暫停' : '恢復'}
                                    className="p-2 rounded-xl bg-zinc-800 text-zinc-300"
                                >
                                    {r.active ? <Pause size={16} /> : <Play size={16} />}
                                </button>
                            )}
                        </div>
                    );
                })}
                {sorted.length === 0 && <p className="text-center text-zinc-500 p-6">尚無定期交易</p>}
            </Card>
            {editing && <RuleEditor rule={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}
