import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BarChart3, PieChart as ChartIcon, ChevronRight, Wallet } from 'lucide-react';
import { useTransactions } from '../../hooks/useTransactions';
import { useOptions } from '../../hooks/useOptions';
import { formatCurrency, IconMap } from '../../utils/helpers';

interface OverviewProps {
    currentYear: number;
    setActiveTab: (tab: string) => void;
}

export default function Overview({ currentYear, setActiveTab }: OverviewProps) {
    const { transactions } = useTransactions();
    const { categories } = useOptions();

    const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
    const [isPending, startTransition] = React.useTransition();

    const yearTransactions = useMemo(() =>
        transactions.filter(tx => tx.date.startsWith(String(currentYear))),
        [transactions, currentYear]
    );

    const totalExpense = useMemo(() =>
        yearTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        [yearTransactions]
    );

    const categoryStats = useMemo(() => {
        const stats: Record<string, number> = {};
        yearTransactions.forEach(tx => {
            const catId = tx.category_id || (categories[0]?.id);
            if (catId && categories.find(c => c.id === catId)) {
                stats[catId] = (stats[catId] || 0) + tx.amount;
            }
        });
        return categories.map(c => ({
            ...c,
            value: stats[c.id] || 0,
            percentage: totalExpense ? ((stats[c.id] || 0) / totalExpense) * 100 : 0
        })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);
    }, [yearTransactions, totalExpense, categories]);

    const monthlyData = useMemo(() => {
        const data: any[] = [];
        for (let i = 1; i <= 12; i++) {
            const monthPrefix = `${currentYear}-${String(i).padStart(2, '0')}`;
            const monthTxs = yearTransactions.filter(tx => tx.date.startsWith(monthPrefix));
            const monthObj: any = { name: `${i}月` };
            categories.forEach(c => {
                monthObj[c.id] = monthTxs.filter(tx => tx.category_id === c.id).reduce((s, t) => s + t.amount, 0);
            });
            data.push(monthObj);
        }
        return data;
    }, [yearTransactions, categories, currentYear]);

    const handleChartTypeChange = (type: 'pie' | 'bar') => {
        startTransition(() => {
            setChartType(type);
        });
    };

    return (
        <div className="pb-24 animate-in fade-in duration-300 pt-20">
            <h1 className="text-3xl font-bold text-white px-4 mb-6">概覽</h1>

            {/* Chart Card */}
            <div className="mx-4 bg-zinc-900 rounded-3xl p-5 mb-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-zinc-400 text-sm mb-1">總支出 ({currentYear}年)</p>
                        <p className="text-3xl font-bold text-white">{formatCurrency(totalExpense)}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="bg-zinc-800 rounded-full p-1 flex">
                            <button onClick={() => handleChartTypeChange('bar')} className={`p-1.5 rounded-full transition-colors ${chartType === 'bar' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-400'}`}>
                                <BarChart3 size={18} />
                            </button>
                            <button onClick={() => handleChartTypeChange('pie')} className={`p-1.5 rounded-full transition-colors ${chartType === 'pie' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-400'}`}>
                                <ChartIcon size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`transition-opacity duration-300 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
                    {chartType === 'pie' ? (
                        <div className="relative h-64">
                            <div className="absolute top-0 left-0">
                                <p className="text-zinc-400 text-xs">交易</p>
                                <p className="text-white font-medium">{yearTransactions.length}</p>
                            </div>
                            <div className="absolute top-0 right-0 text-right">
                                <p className="text-zinc-400 text-xs">類別</p>
                                <p className="text-white font-medium">{categoryStats.length}</p>
                            </div>
                            <div className="absolute bottom-0 left-0">
                                <p className="text-white font-medium">{formatCurrency(totalExpense / (yearTransactions.length || 1))}</p>
                                <p className="text-zinc-400 text-xs">平均每筆交易</p>
                            </div>
                            <div className="absolute bottom-0 right-0 text-right">
                                <p className="text-white font-medium">{formatCurrency(totalExpense / 365)}</p>
                                <p className="text-zinc-400 text-xs">平均每日額</p>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={categoryStats} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none">
                                        {categoryStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} formatter={(value: number) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(val) => val === 0 ? '0' : val.toLocaleString()} />
                                    <Tooltip cursor={{ fill: '#27272a' }} contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                                    {categories.map(c => (
                                        <Bar key={c.id} dataKey={c.id} stackId="a" fill={c.color} radius={[0, 0, 0, 0]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Category List */}
            <div className="px-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white">總支出</h2>
                    <span className="text-emerald-400 text-sm font-medium">分組</span>
                </div>
                <div className="bg-zinc-900 rounded-3xl p-2">
                    {categoryStats.map((cat) => (
                        <div
                            key={cat.id}
                            onClick={() => {
                                setActiveTab('transactions');
                            }}
                            className="flex items-center p-3 border-b border-zinc-800 last:border-0 cursor-pointer hover:bg-zinc-800 transition-colors rounded-2xl"
                        >
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-zinc-800 text-white mr-4" style={{ color: cat.color ? cat.color : undefined }}>
                                {IconMap[cat.icon] || <Wallet size={24} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-medium mb-1">{cat.name}</p>
                                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}></div>
                                </div>
                            </div>
                            <div className="text-right ml-4">
                                <p className="text-zinc-400 text-sm mb-0.5">{cat.percentage.toFixed(0)} %</p>
                                <p className="text-red-400 font-medium">-{formatCurrency(cat.value)}</p>
                            </div>
                            <ChevronRight size={16} className="text-zinc-600 ml-2" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
