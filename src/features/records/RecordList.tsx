import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, ArrowUpDown, Plus } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { TimeFilter } from '../../App';
import { RecordType } from '../../types/database.types';
import { formatCurrency, formatDateHeader } from '../../utils/helpers';
import { periodTotals } from '../../lib/balances';
import { Card } from '../../components/ui';
import RecordRow, { buildLookup } from './RecordRow';
import { useRecordUI } from './RecordUI';
import { filterRecords, RecordFilters, SortKey, sortRecords } from './filterRecords';

interface RecordListProps {
    timeFilter: TimeFilter;
    filterCategory?: string;
    onFilterCategoryChange?: (id: string) => void;
}

const SORT_LABELS: { [K in SortKey]: string } = {
    'date-desc': '日期（新到舊）',
    'date-asc': '日期（舊到新）',
    'amount-desc': '金額（高到低）',
    'amount-asc': '金額（低到高）',
};

export default function RecordList({ timeFilter, filterCategory = '', onFilterCategoryChange }: RecordListProps) {
    const { records, categories, paymentMethods, loading, error } = useData();
    const { openNew, openDetail } = useRecordUI();
    const lookup = useMemo(() => buildLookup(categories, paymentMethods), [categories, paymentMethods]);

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [type, setType] = useState<'' | RecordType>('');
    const [accountId, setAccountId] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [sort, setSort] = useState<SortKey>('date-desc');

    const filters: RecordFilters = {
        start: timeFilter.start, end: timeFilter.end, query: '',
        type, categoryId: filterCategory, accountId, minAmount, maxAmount,
    };
    const activeFilterCount = [type, filterCategory, accountId, minAmount, maxAmount].filter(Boolean).length;

    const filtered = useMemo(
        () => sortRecords(filterRecords(records, filters, categories), sort),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [records, categories, sort, timeFilter.start, timeFilter.end, type, filterCategory, accountId, minAmount, maxAmount],
    );
    const totals = useMemo(() => periodTotals(filtered), [filtered]);

    const groups = useMemo(() => {
        if (!sort.startsWith('date')) return null;
        const map = new Map<string, typeof filtered>();
        for (const r of filtered) {
            const list = map.get(r.date);
            if (list) list.push(r);
            else map.set(r.date, [r]);
        }
        return [...map.entries()];
    }, [filtered, sort]);

    const clearFilters = () => {
        setType(''); setAccountId(''); setMinAmount(''); setMaxAmount('');
        onFilterCategoryChange?.('');
    };

    const visibleCategories = categories.filter(c => !type || type === 'transfer' || (c.type ?? 'expense') === type);
    const inputClass = 'w-full bg-zinc-800 text-white p-2 rounded-xl outline-none text-sm appearance-none';

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">交易</h1>
                <div className="flex gap-2">
                    <div className="relative">
                        <button onClick={() => setIsSortOpen(o => !o)} aria-label="排序" className="p-2 rounded-full bg-zinc-800 text-zinc-300">
                            <ArrowUpDown size={20} />
                        </button>
                        {isSortOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-44 bg-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                                    {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                                        <button key={k} onClick={() => { setSort(k); setIsSortOpen(false); }} className={`w-full text-left px-4 py-3 text-sm hover:bg-zinc-700 ${sort === k ? 'text-emerald-400' : 'text-white'}`}>
                                            {SORT_LABELS[k]}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(o => !o)}
                        aria-label="篩選"
                        aria-expanded={isFilterOpen}
                        className={`p-2 rounded-full transition-colors relative ${isFilterOpen || activeFilterCount ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-zinc-300'}`}
                    >
                        <SlidersHorizontal size={20} />
                        {activeFilterCount > 0 && !isFilterOpen && (
                            <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>
                        )}
                    </button>
                </div>
            </div>

            {isFilterOpen && (
                <Card className="p-4 mb-6 space-y-3 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs text-zinc-500 mb-1 block">類型</span>
                            <select value={type} onChange={e => setType(e.target.value as '' | RecordType)} className={inputClass}>
                                <option value="">全部</option>
                                <option value="expense">支出</option>
                                <option value="income">收入</option>
                                <option value="transfer">轉帳</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs text-zinc-500 mb-1 block">帳戶</span>
                            <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputClass}>
                                <option value="">全部</option>
                                {paymentMethods.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </label>
                    </div>
                    {type !== 'transfer' && (
                        <label className="block">
                            <span className="text-xs text-zinc-500 mb-1 block">分類</span>
                            <select value={filterCategory} onChange={e => onFilterCategoryChange?.(e.target.value)} className={inputClass}>
                                <option value="">全部</option>
                                {visibleCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </label>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs text-zinc-500 mb-1 block">最低金額</span>
                            <input type="number" inputMode="decimal" value={minAmount} onChange={e => setMinAmount(e.target.value)} className={inputClass} placeholder="不限" />
                        </label>
                        <label className="block">
                            <span className="text-xs text-zinc-500 mb-1 block">最高金額</span>
                            <input type="number" inputMode="decimal" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className={inputClass} placeholder="不限" />
                        </label>
                    </div>
                    {activeFilterCount > 0 && (
                        <button onClick={clearFilters} className="text-xs text-red-400 font-medium">清除篩選</button>
                    )}
                </Card>
            )}

            <Card className="p-5 mb-8 grid grid-cols-3 gap-2">
                <div>
                    <p className="text-zinc-400 text-xs mb-1">收入</p>
                    <p className="text-emerald-400 font-bold truncate">{formatCurrency(totals.income)}</p>
                </div>
                <div>
                    <p className="text-zinc-400 text-xs mb-1">支出</p>
                    <p className="text-red-400 font-bold truncate">{formatCurrency(totals.expense)}</p>
                </div>
                <div className="text-right">
                    <p className="text-zinc-400 text-xs mb-1">結餘</p>
                    <p className={`font-bold truncate ${totals.net < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(totals.net)}</p>
                </div>
            </Card>

            {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
            {loading && records.length === 0 && <p className="text-center text-zinc-500 py-10">載入中…</p>}

            {groups ? (
                <div className="space-y-8">
                    {groups.map(([date, list]) => {
                        const day = periodTotals(list);
                        return (
                            <div key={date}>
                                <div className="flex justify-between items-baseline mb-3 mx-1">
                                    <h3 className="text-white font-bold">{formatDateHeader(date)}</h3>
                                    <span className="text-sm text-zinc-500">
                                        {day.expense > 0 && <span className="text-red-400">-{formatCurrency(day.expense)}</span>}
                                        {day.expense > 0 && day.income > 0 && ' / '}
                                        {day.income > 0 && <span className="text-emerald-400">+{formatCurrency(day.income)}</span>}
                                    </span>
                                </div>
                                <Card className="overflow-hidden">
                                    {list.map((r, i) => (
                                        <RecordRow key={r.id} record={r} lookup={lookup} onClick={() => openDetail(r)} last={i === list.length - 1} />
                                    ))}
                                </Card>
                            </div>
                        );
                    })}
                </div>
            ) : filtered.length > 0 && (
                <Card className="overflow-hidden">
                    {filtered.map((r, i) => (
                        <RecordRow key={r.id} record={r} lookup={lookup} onClick={() => openDetail(r)} showDate last={i === filtered.length - 1} />
                    ))}
                </Card>
            )}
            {!loading && filtered.length === 0 && <div className="text-center text-zinc-500 py-10">沒有符合條件的交易紀錄</div>}

            <button
                onClick={() => openNew(accountId || undefined)}
                aria-label="新增交易"
                className="fixed bottom-24 right-4 w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black hover:scale-105 transition-transform z-40"
            >
                <Plus size={24} />
            </button>
        </div>
    );
}
