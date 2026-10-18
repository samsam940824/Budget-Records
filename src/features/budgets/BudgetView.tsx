import React, { useMemo, useState } from 'react';
import { Plus, MoreHorizontal, Calendar, Edit2, Trash2, Minus, Check, Wallet, X, LayoutGrid, Repeat, BarChart3, ChevronRight, Flag } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { Budget } from '../../types/database.types';
import { budgetPeriod, budgetSpent } from '../../lib/budget';
import { todayString } from '../../lib/dates';
import { formatCurrency, formatShortDate } from '../../utils/helpers';
import { IconTile } from '../../components/AppIcon';
import { Card, ConfirmDialog, FieldRow, SectionTitle, Sheet, Toggle } from '../../components/ui';

const REPEAT_MAP: { [key: string]: string } = {
    daily: '每日',
    weekly: '每週',
    monthly: '每月',
    yearly: '每年',
    none: '不重複',
};

const ALL = '__all__';

/**
 * A new repeating budget starts at the beginning of the current cycle, so
 * spending earlier this month already counts. A one-off budget starts today.
 */
function initialStartDate(repeat: Budget['repeat'], resetDay: number): string {
    const today = todayString();
    if (repeat === 'none') return today;
    return budgetPeriod({ repeat, start_date: '1970-01-01', end_date: null }, resetDay, today).start;
}

export function useBudgetProgress() {
    const { budgets, records, settings, categories } = useData();
    const resetDay = settings?.budget_reset_day || 1;
    return useMemo(() => {
        const today = todayString();
        return budgets.map(b => {
            const period = budgetPeriod(b, resetDay, today);
            const spent = budgetSpent(b, records, period);
            const amount = Number(b.amount) || 0;
            const category = b.category_id ? categories.find(c => c.id === b.category_id) : undefined;
            return {
                budget: b,
                category,
                period,
                spent,
                remaining: amount - spent,
                percent: amount > 0 ? (spent / amount) * 100 : 0,
            };
        });
    }, [budgets, records, resetDay, categories]);
}

export default function BudgetView() {
    const { budgets, categories, settings, addBudget, updateBudget, deleteBudget, updateSettings } = useData();
    const progress = useBudgetProgress();
    const resetDay = settings?.budget_reset_day || 1;
    const expenseCategories = categories.filter(c => (c.type ?? 'expense') === 'expense');

    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [resetDayOpen, setResetDayOpen] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Budget | null>(null);
    const [amount, setAmount] = useState('');
    const [catId, setCatId] = useState('');
    const [repeat, setRepeat] = useState<Budget['repeat']>('monthly');
    const [hasEnd, setHasEnd] = useState(false);
    const [endDate, setEndDate] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detailMenuOpen, setDetailMenuOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const totalBudget = progress.reduce((s, p) => s + (Number(p.budget.amount) || 0), 0);
    const remaining = progress.reduce((s, p) => s + p.remaining, 0);
    const isOverBudget = progress.some(p => p.remaining < 0);
    const selected = progress.find(p => p.budget.id === selectedId) ?? null;

    const openForm = (b: Budget | null) => {
        setEditing(b);
        setAmount(b ? String(b.amount) : '');
        setCatId(b ? (b.category_id ?? ALL) : '');
        setRepeat(b?.repeat ?? 'monthly');
        setHasEnd(!!b?.end_date);
        setEndDate(b?.end_date ?? '');
        setNote(b?.note ?? '');
        setError(null);
        setFormOpen(true);
    };

    const save = async () => {
        const value = Number(amount);
        if (!amount || !Number.isFinite(value) || value <= 0) { setError('請輸入預算金額'); return; }
        if (!catId) { setError('請選擇分類'); return; }
        setSaving(true);
        const data = {
            amount: value,
            category_id: catId === ALL ? null : catId,
            repeat,
            end_date: hasEnd && endDate ? endDate : null,
            note,
            currency_code: settings?.default_currency || 'TWD',
            start_date: editing?.start_date ?? initialStartDate(repeat, resetDay),
        };
        try {
            if (editing) await updateBudget(editing.id, data);
            else await addBudget(data);
            setFormOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : '儲存失敗');
        } finally {
            setSaving(false);
        }
    };

    const nameOf = (p: (typeof progress)[number]) => (p.budget.category_id ? p.category?.name ?? '未分類' : '全部支出');

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">預算</h1>
                <div className="flex space-x-3">
                    <div className="relative">
                        <button onClick={() => setHeaderMenuOpen(o => !o)} aria-label="預算選單" className="bg-zinc-800 p-2 rounded-full text-white hover:bg-zinc-700"><MoreHorizontal size={24} /></button>
                        {headerMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                                    <button onClick={() => { setResetDayOpen(true); setHeaderMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 flex items-center text-sm">
                                        <Calendar size={16} className="mr-2" /> 重置日設定
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <button onClick={() => openForm(null)} aria-label="新增預算" className="bg-zinc-800 p-2 rounded-full text-white hover:bg-zinc-700"><Plus size={24} /></button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-zinc-400 text-sm">計劃中</span>
                        <div className="bg-zinc-800 p-1 rounded-full text-zinc-400"><Minus size={16} /></div>
                    </div>
                    <p className="text-emerald-400 text-xl font-bold">{formatCurrency(totalBudget)}</p>
                </Card>
                <Card className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-zinc-400 text-sm">剩餘</span>
                        <div className="bg-zinc-800 p-1 rounded-full text-zinc-400"><Check size={16} /></div>
                    </div>
                    <p className={`${remaining < 0 ? 'text-red-400' : 'text-emerald-400'} text-xl font-bold`}>{formatCurrency(remaining)}</p>
                </Card>
            </div>

            {budgets.length > 0 && (
                <Card className={`p-4 mb-8 flex items-center space-x-2 ${isOverBudget ? 'border border-red-500/30' : ''}`}>
                    <span className="text-2xl">{isOverBudget ? '⚠️' : '🎉'}</span>
                    <span className={`${isOverBudget ? 'text-red-400' : 'text-white'} font-medium`}>
                        {isOverBudget ? `有 ${progress.filter(p => p.remaining < 0).length} 項預算已超支！` : '您在預算內！'}
                    </span>
                </Card>
            )}

            <h2 className="text-white font-bold text-lg mb-4">預算清單</h2>
            <div className="space-y-4">
                {progress.map(p => {
                    const isOver = p.remaining < 0;
                    const barColor = isOver ? '#f87171' : p.percent >= 80 ? '#fbbf24' : '#34d399';
                    return (
                        <button key={p.budget.id} onClick={() => setSelectedId(p.budget.id)} className="w-full text-left bg-zinc-900 rounded-3xl p-4 hover:bg-zinc-800 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <IconTile icon={p.budget.category_id ? p.category?.icon : 'Wallet'} color={p.budget.category_id ? p.category?.color : '#10b981'} />
                                    <div>
                                        <p className="text-white font-medium">{nameOf(p)}</p>
                                        <p className="text-zinc-400 text-xs">{REPEAT_MAP[p.budget.repeat]} · 已用 {Math.round(p.percent)}%</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-zinc-500 text-xs mb-1">{formatShortDate(p.period.start)} - {formatShortDate(p.period.end)}</p>
                                    <div className={`flex items-center justify-end font-bold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {formatCurrency(p.remaining)} <ChevronRight size={16} className="ml-1 text-zinc-600" />
                                    </div>
                                </div>
                            </div>
                            <div className="w-full bg-zinc-800 rounded-full h-2 mb-2" role="progressbar" aria-valuenow={Math.round(p.percent)} aria-valuemin={0} aria-valuemax={100}>
                                <div className="h-2 rounded-full" style={{ width: `${Math.min(p.percent, 100)}%`, backgroundColor: barColor }} />
                            </div>
                            <p className="text-zinc-400 text-sm">已支出 {formatCurrency(p.spent)} / {formatCurrency(p.budget.amount)}</p>
                        </button>
                    );
                })}
                {budgets.length === 0 && (
                    <div className="text-center text-zinc-500 py-12">
                        <Wallet size={48} className="mx-auto mb-4 opacity-20" />
                        <p>尚無預算設定</p>
                    </div>
                )}
            </div>

            {formOpen && (
                <Sheet title={editing ? '編輯預算' : '新預算'} onClose={() => setFormOpen(false)} action={{ label: saving ? '儲存中…' : '儲存', onClick: save, disabled: saving }}>
                    <Card className="p-4 mb-6 mt-4">
                        <div className="flex items-center text-3xl font-bold text-white">
                            <span className="mr-1">$</span>
                            <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" aria-label="預算金額" className="bg-transparent outline-none w-full placeholder-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" autoFocus />
                        </div>
                    </Card>
                    {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}

                    <SectionTitle>分配</SectionTitle>
                    <Card className="p-2 mb-6">
                        <FieldRow icon={<div className="bg-blue-500/20 text-blue-500 p-2 rounded-xl"><LayoutGrid size={20} /></div>} label="分類" last>
                            <select value={catId} onChange={e => setCatId(e.target.value)} className="bg-transparent text-right text-white outline-none appearance-none" aria-label="預算分類">
                                <option value="" disabled className="bg-zinc-900">選擇分類</option>
                                <option value={ALL} className="bg-zinc-900">全部支出</option>
                                {expenseCategories.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                            </select>
                        </FieldRow>
                    </Card>

                    <SectionTitle>間隔</SectionTitle>
                    <Card className="p-2 mb-6">
                        <FieldRow icon={<div className="bg-purple-500/20 text-purple-500 p-2 rounded-xl"><Repeat size={20} /></div>} label="重複">
                            <select value={repeat} onChange={e => setRepeat(e.target.value as Budget['repeat'])} className="bg-transparent text-right text-white outline-none appearance-none" aria-label="預算週期">
                                {Object.entries(REPEAT_MAP).map(([k, v]) => <option key={k} value={k} className="bg-zinc-900">{v}</option>)}
                            </select>
                        </FieldRow>
                        <FieldRow icon={<div className={`bg-zinc-700/50 ${hasEnd ? 'text-emerald-400' : 'text-zinc-400'} p-2 rounded-xl`}><Flag size={20} /></div>} label="結束" last>
                            <div className="flex items-center space-x-3">
                                {hasEnd && <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-right outline-none text-sm" aria-label="結束日期" />}
                                <Toggle checked={hasEnd} onChange={setHasEnd} label="設定結束日期" />
                            </div>
                        </FieldRow>
                    </Card>

                    <SectionTitle>備註</SectionTitle>
                    <Card className="p-4 mb-6">
                        <textarea value={note} onChange={e => setNote(e.target.value)} aria-label="備註" className="w-full bg-transparent outline-none text-white resize-none h-24 placeholder-zinc-600" />
                    </Card>
                </Sheet>
            )}

            {selected && (
                <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-10 max-w-md mx-auto" role="dialog" aria-label="預算詳情">
                    <div className="flex justify-between items-center px-4 pt-8 pb-4">
                        <button onClick={() => setSelectedId(null)} aria-label="關閉" className="bg-zinc-800 text-zinc-300 p-2 rounded-full"><X size={20} /></button>
                        <h2 className="text-lg font-bold text-white">預算詳情</h2>
                        <div className="relative">
                            <button onClick={() => setDetailMenuOpen(o => !o)} aria-label="更多動作" className="bg-zinc-800 text-zinc-300 p-2 rounded-full"><MoreHorizontal size={20} /></button>
                            {detailMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setDetailMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                                        <button onClick={() => { setDetailMenuOpen(false); setSelectedId(null); openForm(selected.budget); }} className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 flex items-center"><Edit2 size={16} className="mr-2" /> 編輯</button>
                                        <button onClick={() => { setDetailMenuOpen(false); setConfirmDelete(true); }} className="w-full text-left px-4 py-3 text-red-400 hover:bg-zinc-700 flex items-center"><Trash2 size={16} className="mr-2" /> 刪除</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="p-6 flex flex-col items-center">
                        <div className="text-5xl font-bold text-white mb-2">{formatCurrency(selected.budget.amount)}</div>
                        <div className="text-zinc-400 mb-8">{selected.budget.note || '無備註'}</div>
                        <div className="w-full bg-zinc-900 rounded-3xl overflow-hidden">
                            {[
                                { icon: <IconTile icon={selected.budget.category_id ? selected.category?.icon : 'Wallet'} color={selected.budget.category_id ? selected.category?.color : '#10b981'} />, label: '分類', value: nameOf(selected), cls: 'text-white' },
                                { icon: <div className="bg-emerald-500/20 text-emerald-500 p-2 rounded-xl"><Repeat size={20} /></div>, label: '間隔', value: `${REPEAT_MAP[selected.budget.repeat]}（${formatShortDate(selected.period.start)} - ${formatShortDate(selected.period.end)}）`, cls: 'text-white' },
                                { icon: <div className="bg-red-500/20 text-red-500 p-2 rounded-xl"><BarChart3 size={20} /></div>, label: '已支出', value: formatCurrency(selected.spent), cls: 'text-white' },
                                { icon: <div className={`${selected.remaining < 0 ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'} p-2 rounded-xl`}><Check size={20} /></div>, label: '剩餘', value: formatCurrency(selected.remaining), cls: selected.remaining < 0 ? 'text-red-400' : 'text-emerald-400' },
                            ].map((row, i, arr) => (
                                <div key={row.label} className={`flex items-center p-4 gap-4 ${i < arr.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                                    {row.icon}
                                    <div><p className="text-zinc-500 text-xs">{row.label}</p><p className={`${row.cls} font-medium`}>{row.value}</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {confirmDelete && (
                        <ConfirmDialog
                            title="確定要刪除這個預算嗎？"
                            confirmLabel="刪除"
                            onCancel={() => setConfirmDelete(false)}
                            onConfirm={async () => {
                                setConfirmDelete(false);
                                await deleteBudget(selected.budget.id);
                                setSelectedId(null);
                            }}
                        />
                    )}
                </div>
            )}

            {resetDayOpen && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 animate-in fade-in" role="dialog" aria-label="重置日設定">
                    <div className="bg-zinc-900 rounded-3xl w-full max-w-xs p-6">
                        <h3 className="text-white font-bold text-lg mb-4">重置日設定</h3>
                        <p className="text-zinc-400 text-sm mb-4">每月預算從這一天開始計算。超過當月天數時，會改用當月最後一天。</p>
                        <div className="grid grid-cols-7 gap-2 mb-6">
                            {[...Array(31)].map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => updateSettings({ budget_reset_day: i + 1 })}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${resetDay === i + 1 ? 'bg-emerald-400 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setResetDayOpen(false)} className="w-full py-3 rounded-xl bg-emerald-400 text-black font-bold">完成</button>
                    </div>
                </div>
            )}
        </div>
    );
}
