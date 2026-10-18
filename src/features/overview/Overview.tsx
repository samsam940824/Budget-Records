import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BarChart3, PieChart as ChartIcon, ChevronRight, ArrowUp, ArrowDown, Plus, SlidersHorizontal } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { TimeFilter } from '../../App';
import { DashboardWidget, DashboardWidgetId } from '../../types/database.types';
import { formatCurrency, formatShortDate } from '../../utils/helpers';
import { periodTotals } from '../../lib/balances';
import { addDays, daysBetweenInclusive, todayString } from '../../lib/dates';
import { describeSchedule } from '../../lib/recurring';
import { resolveWidgets, WIDGET_LABELS } from '../../lib/dashboard';
import { IconTile } from '../../components/AppIcon';
import { Card, Segmented, Sheet, Toggle } from '../../components/ui';
import RecordRow, { buildLookup } from '../records/RecordRow';
import { useRecordUI } from '../records/RecordUI';
import { useAccountBalances } from '../accounts/AccountsView';
import { useBudgetProgress } from '../budgets/BudgetView';

interface OverviewProps {
    timeFilter: TimeFilter;
    setActiveTab: (tab: string) => void;
    onCategorySelect?: (categoryId: string) => void;
}

/** 1500 -> "1.5k", 12000 -> "12k"; keeps neighbouring ticks distinct. */
const compactTick = (v: number) => {
    if (Math.abs(v) < 1000) return String(v);
    const k = v / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
};

const tooltipStyle = {
    contentStyle: { backgroundColor: 'var(--color-zinc-800)', border: 'none', borderRadius: '8px', color: 'var(--color-white)' },
    itemStyle: { color: 'var(--color-white)' },
    labelStyle: { color: 'var(--color-zinc-400)' },
};

function WidgetHeader({ title, action }: { title: string; action?: React.ReactNode }) {
    return (
        <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {action}
        </div>
    );
}

const linkButton = (label: string, onClick: () => void) => (
    <button onClick={onClick} className="text-emerald-400 text-sm font-medium flex items-center">{label}<ChevronRight size={14} /></button>
);

export default function Overview({ timeFilter, setActiveTab, onCategorySelect }: OverviewProps) {
    const { records, categories, paymentMethods, recurring, settings, updateSettings } = useData();
    const { openNew, openDetail } = useRecordUI();
    const { balances, total } = useAccountBalances();
    const budgetProgress = useBudgetProgress();
    const lookup = useMemo(() => buildLookup(categories, paymentMethods), [categories, paymentMethods]);

    const widgets = resolveWidgets(settings?.dashboard_widgets);
    const [editing, setEditing] = useState<DashboardWidget[] | null>(null);
    const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
    const [categoryKind, setCategoryKind] = useState<'expense' | 'income'>('expense');

    const inRange = useMemo(
        () => records.filter(r => r.date >= timeFilter.start && r.date <= timeFilter.end),
        [records, timeFilter.start, timeFilter.end],
    );
    const totals = useMemo(() => periodTotals(inRange), [inRange]);
    const rangeDays = daysBetweenInclusive(timeFilter.start, timeFilter.end);

    const categoryStats = useMemo(() => {
        const list = inRange.filter(r => r.type === categoryKind);
        const sum = list.reduce((s, r) => s + Number(r.amount), 0);
        const byCat = new Map<string, number>();
        for (const r of list) {
            const key = r.category_id ?? '';
            byCat.set(key, (byCat.get(key) ?? 0) + Number(r.amount));
        }
        return {
            sum,
            count: list.length,
            items: [...byCat.entries()]
                .map(([id, value]) => {
                    const c = id ? lookup.categoryById.get(id) : undefined;
                    return { id, name: c?.name ?? '未分類', icon: c?.icon ?? 'Tag', color: c?.color ?? '#71717a', value, percentage: sum ? (value / sum) * 100 : 0 };
                })
                .sort((a, b) => b.value - a.value),
        };
    }, [inRange, categoryKind, lookup]);

    // Daily bars for ranges up to two months, monthly bars beyond that.
    const trend = useMemo(() => {
        const expenses = inRange.filter(r => r.type === 'expense');
        if (rangeDays <= 62) {
            const byDay = new Map<string, number>();
            for (const r of expenses) byDay.set(r.date, (byDay.get(r.date) ?? 0) + Number(r.amount));
            return Array.from({ length: rangeDays }, (_, i) => {
                const d = addDays(timeFilter.start, i);
                return { name: String(Number(d.slice(8))), value: byDay.get(d) ?? 0 };
            });
        }
        const byMonth = new Map<string, number>();
        for (const r of expenses) byMonth.set(r.date.slice(0, 7), (byMonth.get(r.date.slice(0, 7)) ?? 0) + Number(r.amount));
        const months: { name: string; value: number }[] = [];
        let cursor = timeFilter.start.slice(0, 7);
        const last = timeFilter.end.slice(0, 7);
        while (cursor <= last && months.length < 120) {
            months.push({ name: `${Number(cursor.slice(5))}月`, value: byMonth.get(cursor) ?? 0 });
            const [y, m] = cursor.split('-').map(Number);
            cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
        }
        return months;
    }, [inRange, rangeDays, timeFilter.start, timeFilter.end]);

    const upcoming = useMemo(() => {
        const horizon = addDays(todayString(), 30);
        return recurring
            .filter(r => r.active && r.next_date <= horizon && (!r.end_date || r.next_date <= r.end_date))
            .sort((a, b) => a.next_date.localeCompare(b.next_date))
            .slice(0, 5);
    }, [recurring]);

    const saveLayout = async () => {
        if (!editing) return;
        const layout = editing;
        setEditing(null);
        await updateSettings({ dashboard_widgets: layout });
    };

    const move = (index: number, delta: number) => {
        setEditing(prev => {
            if (!prev) return prev;
            const next = [...prev];
            const target = index + delta;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const render: { [K in DashboardWidgetId]: () => React.ReactNode } = {
        summary: () => (
            <Card className="p-5">
                <p className="text-zinc-400 text-sm mb-1">結餘（{timeFilter.label}）</p>
                <p className={`text-3xl font-bold mb-4 ${totals.net < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(totals.net)}</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-zinc-500 text-xs">收入</p><p className="text-emerald-400 font-medium truncate">{formatCurrency(totals.income)}</p></div>
                    <div><p className="text-zinc-500 text-xs">支出</p><p className="text-red-400 font-medium truncate">{formatCurrency(totals.expense)}</p></div>
                    <div className="text-right"><p className="text-zinc-500 text-xs">日均支出</p><p className="text-white font-medium truncate">{formatCurrency(Math.round(totals.expense / rangeDays))}</p></div>
                </div>
            </Card>
        ),
        accounts: () => (
            <>
                <WidgetHeader title="帳戶" action={linkButton('全部', () => setActiveTab('accounts'))} />
                <Card className="overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                        <span className="text-zinc-400 text-sm">淨資產</span>
                        <span className={`font-bold ${total < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(total)}</span>
                    </div>
                    {paymentMethods.filter(a => !a.archived).slice(0, 4).map((a, i, arr) => {
                        const b = balances.get(a.id) ?? 0;
                        return (
                            <div key={a.id} className={`flex items-center gap-3 p-3 ${i < arr.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                                <IconTile icon={a.icon} color={a.color} size={32} />
                                <span className="flex-1 text-white truncate">{a.name}</span>
                                <span className={`font-medium ${b < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(b, a.currency_code)}</span>
                            </div>
                        );
                    })}
                </Card>
            </>
        ),
        categories: () => (
            <>
                <Card className="p-5 mb-4">
                    <div className="flex justify-between items-start mb-4 gap-2">
                        <div className="min-w-0">
                            <p className="text-zinc-400 text-sm mb-1">{categoryKind === 'expense' ? '總支出' : '總收入'}</p>
                            <p className="text-3xl font-bold text-white truncate">{formatCurrency(categoryStats.sum)}</p>
                        </div>
                        <div className="bg-zinc-800 rounded-full p-1 flex shrink-0">
                            <button onClick={() => setChartType('bar')} aria-label="長條圖" className={`p-1.5 rounded-full ${chartType === 'bar' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-400'}`}><BarChart3 size={18} /></button>
                            <button onClick={() => setChartType('pie')} aria-label="圓餅圖" className={`p-1.5 rounded-full ${chartType === 'pie' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-400'}`}><ChartIcon size={18} /></button>
                        </div>
                    </div>
                    <div className="mb-4">
                        <Segmented<'expense' | 'income'> value={categoryKind} onChange={setCategoryKind} options={[{ value: 'expense', label: '支出' }, { value: 'income', label: '收入' }]} />
                    </div>
                    {categoryStats.items.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-zinc-500 text-sm">這段期間沒有{categoryKind === 'expense' ? '支出' : '收入'}</div>
                    ) : chartType === 'pie' ? (
                        <div className="relative h-56">
                            <div className="absolute top-0 left-0"><p className="text-zinc-400 text-xs">交易</p><p className="text-white font-medium">{categoryStats.count}</p></div>
                            <div className="absolute top-0 right-0 text-right"><p className="text-zinc-400 text-xs">類別</p><p className="text-white font-medium">{categoryStats.items.length}</p></div>
                            <div className="absolute bottom-0 left-0"><p className="text-white font-medium">{formatCurrency(Math.round(categoryStats.sum / (categoryStats.count || 1)))}</p><p className="text-zinc-400 text-xs">平均每筆</p></div>
                            <div className="absolute bottom-0 right-0 text-right"><p className="text-white font-medium">{formatCurrency(Math.round(categoryStats.sum / rangeDays))}</p><p className="text-zinc-400 text-xs">平均每日</p></div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={categoryStats.items} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" stroke="none">
                                        {categoryStats.items.map(e => <Cell key={e.id || 'none'} fill={e.color} />)}
                                    </Pie>
                                    <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryStats.items} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={64} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-zinc-400)', fontSize: 12 }} />
                                    <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--color-zinc-800)' }} formatter={(v: number) => formatCurrency(v)} />
                                    <Bar dataKey="value" name="金額" radius={[0, 6, 6, 0]}>
                                        {categoryStats.items.map(e => <Cell key={e.id || 'none'} fill={e.color} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Card>
                {categoryStats.items.length > 0 && (
                    <Card className="p-2">
                        {categoryStats.items.map(cat => (
                            <button
                                key={cat.id || 'none'}
                                onClick={() => (cat.id && onCategorySelect ? onCategorySelect(cat.id) : setActiveTab('transactions'))}
                                className="w-full text-left flex items-center p-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800 transition-colors rounded-2xl"
                            >
                                <IconTile icon={cat.icon} color={cat.color} size={44} />
                                <div className="flex-1 ml-4 min-w-0">
                                    <p className="text-white font-medium mb-1 truncate">{cat.name}</p>
                                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                        <div className="h-1.5 rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                                    </div>
                                </div>
                                <div className="text-right ml-4">
                                    <p className="text-zinc-400 text-sm mb-0.5">{cat.percentage.toFixed(0)} %</p>
                                    <p className={`${categoryKind === 'expense' ? 'text-red-400' : 'text-emerald-400'} font-medium`}>{categoryKind === 'expense' ? '-' : '+'}{formatCurrency(cat.value)}</p>
                                </div>
                                <ChevronRight size={16} className="text-zinc-600 ml-2" />
                            </button>
                        ))}
                    </Card>
                )}
            </>
        ),
        trend: () => (
            <>
                <WidgetHeader title="支出趨勢" />
                <Card className="p-4 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trend} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-zinc-800)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} tick={{ fill: 'var(--color-zinc-400)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-zinc-400)', fontSize: 11 }} tickFormatter={compactTick} />
                            <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--color-zinc-800)' }} formatter={(v: number) => [formatCurrency(v), '支出']} />
                            <Bar dataKey="value" fill="#f87171" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </>
        ),
        budgets: () => (
            <>
                <WidgetHeader title="預算" action={linkButton('全部', () => setActiveTab('budget'))} />
                <Card className="p-4 space-y-4">
                    {budgetProgress.length === 0 && <p className="text-zinc-500 text-sm text-center py-2">尚未設定預算</p>}
                    {budgetProgress.slice(0, 4).map(p => (
                        <div key={p.budget.id}>
                            <div className="flex justify-between text-sm mb-1.5">
                                <span className="text-white">{p.budget.category_id ? p.category?.name ?? '未分類' : '全部支出'}</span>
                                <span className={p.remaining < 0 ? 'text-red-400' : 'text-zinc-400'}>剩 {formatCurrency(p.remaining)}</span>
                            </div>
                            <div className="w-full bg-zinc-800 rounded-full h-2">
                                <div className="h-2 rounded-full" style={{ width: `${Math.min(p.percent, 100)}%`, backgroundColor: p.remaining < 0 ? '#f87171' : p.percent >= 80 ? '#fbbf24' : '#34d399' }} />
                            </div>
                        </div>
                    ))}
                </Card>
            </>
        ),
        upcoming: () => (
            <>
                <WidgetHeader title="即將到來" />
                <Card className="overflow-hidden">
                    {upcoming.length === 0 && <p className="text-zinc-500 text-sm text-center p-4">未來 30 天沒有定期交易</p>}
                    {upcoming.map((r, i) => {
                        const c = r.category_id ? lookup.categoryById.get(r.category_id) : undefined;
                        return (
                            <div key={r.id} className={`flex items-center gap-3 p-3 ${i < upcoming.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                                <IconTile icon={r.type === 'transfer' ? 'ArrowLeftRight' : c?.icon} color={r.type === 'transfer' ? '#38bdf8' : c?.color} size={36} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white truncate">{r.description || c?.name || (r.type === 'transfer' ? '轉帳' : '定期交易')}</p>
                                    <p className="text-zinc-500 text-xs">{formatShortDate(r.next_date)} · {describeSchedule(r)}</p>
                                </div>
                                <span className={`font-medium ${r.type === 'expense' ? 'text-red-400' : r.type === 'income' ? 'text-emerald-400' : 'text-sky-400'}`}>{formatCurrency(r.amount, r.currency_code)}</span>
                            </div>
                        );
                    })}
                </Card>
            </>
        ),
        recent: () => (
            <>
                <WidgetHeader title="最近交易" action={linkButton('全部', () => setActiveTab('transactions'))} />
                <Card className="overflow-hidden">
                    {records.length === 0 && <p className="text-zinc-500 text-sm text-center p-4">還沒有交易，按右下角 ＋ 新增第一筆</p>}
                    {records.slice(0, 5).map((r, i, arr) => (
                        <RecordRow key={r.id} record={r} lookup={lookup} onClick={() => openDetail(r)} showDate last={i === arr.length - 1} />
                    ))}
                </Card>
            </>
        ),
    };

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20">
            <div className="flex justify-between items-center px-4 mb-6">
                <h1 className="text-3xl font-bold text-white">概覽</h1>
                <button onClick={() => setEditing(widgets)} aria-label="自訂概覽" className="bg-zinc-800 p-2 rounded-full text-zinc-300"><SlidersHorizontal size={20} /></button>
            </div>

            <div className="px-4 space-y-8">
                {widgets.filter(w => w.visible).map(w => <section key={w.id} aria-label={WIDGET_LABELS[w.id]}>{render[w.id]()}</section>)}
                {widgets.every(w => !w.visible) && <p className="text-center text-zinc-500 py-10">所有小工具都已隱藏，按右上角按鈕調整。</p>}
            </div>

            <button
                onClick={() => openNew()}
                aria-label="新增交易"
                className="fixed bottom-24 right-4 w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black hover:scale-105 transition-transform z-40"
            >
                <Plus size={24} />
            </button>

            {editing && (
                <Sheet title="自訂概覽" onClose={() => setEditing(null)} action={{ label: '完成', onClick: saveLayout }}>
                    <p className="text-zinc-500 text-sm mb-4 px-1">開關決定是否顯示，箭頭調整順序。設定會同步到你的其他裝置。</p>
                    <Card className="overflow-hidden">
                        {editing.map((w, i) => (
                            <div key={w.id} className={`flex items-center gap-2 p-3 ${i < editing.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                                <div className="flex flex-col">
                                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`上移 ${WIDGET_LABELS[w.id]}`} className="text-zinc-400 disabled:opacity-20 p-0.5"><ArrowUp size={16} /></button>
                                    <button onClick={() => move(i, 1)} disabled={i === editing.length - 1} aria-label={`下移 ${WIDGET_LABELS[w.id]}`} className="text-zinc-400 disabled:opacity-20 p-0.5"><ArrowDown size={16} /></button>
                                </div>
                                <span className={`flex-1 ${w.visible ? 'text-white' : 'text-zinc-500'}`}>{WIDGET_LABELS[w.id]}</span>
                                <Toggle
                                    checked={w.visible}
                                    label={`顯示 ${WIDGET_LABELS[w.id]}`}
                                    onChange={v => setEditing(prev => prev && prev.map(x => (x.id === w.id ? { ...x, visible: v } : x)))}
                                />
                            </div>
                        ))}
                    </Card>
                    <button onClick={() => setEditing(resolveWidgets(null))} className="mt-4 text-sm text-zinc-400 px-1">恢復預設</button>
                </Sheet>
            )}
        </div>
    );
}
