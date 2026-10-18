import React, { useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Search, Settings, X, ChevronRight, LayoutGrid, List, PiggyBank, Wallet, AlertTriangle } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import Login from './features/auth/Login';
import RecordList from './features/records/RecordList';
import BudgetView from './features/budgets/BudgetView';
import SettingsView from './features/settings/SettingsView';
import Overview from './features/overview/Overview';
import AccountsView from './features/accounts/AccountsView';
import LockScreen from './features/security/LockScreen';
import { DataProvider, useData } from './data/DataContext';
import { RecordUIProvider, useRecordUI } from './features/records/RecordUI';
import RecordRow, { buildLookup } from './features/records/RecordRow';
import { filterRecords } from './features/records/filterRecords';
import { getLockConfig } from './lib/lock';
import { formatCurrency } from './utils/helpers';

export type TimeFilterMode = 'month' | 'year' | 'custom';
export interface TimeFilter {
    mode: TimeFilterMode;
    start: string;
    end: string;
    label: string;
}

type Tab = 'overview' | 'transactions' | 'accounts' | 'budget' | 'settings';

const getMonthRange = (year: number, month: number) => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
    return { start, end };
};

export default function App() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }
    if (!user) return <Login />;

    return (
        <DataProvider key={user.id} user={user}>
            <RecordUIProvider>
                <LockGate>
                    <MainApp />
                </LockGate>
            </RecordUIProvider>
        </DataProvider>
    );
}

/** Shows the passcode screen at start and after the app was hidden longer than the timeout. */
function LockGate({ children }: { children: React.ReactNode }) {
    const [locked, setLocked] = useState(() => !!getLockConfig());

    useEffect(() => {
        let hiddenAt: number | null = null;
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now();
                return;
            }
            const cfg = getLockConfig();
            if (cfg && hiddenAt !== null && Date.now() - hiddenAt >= cfg.timeoutMinutes * 60_000) setLocked(true);
            hiddenAt = null;
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    return (
        <>
            {children}
            {locked && <LockScreen onUnlock={() => setLocked(false)} />}
        </>
    );
}

/** Supabase reports a missing table or column when 0001 has not been run yet. */
const looksLikeMissingMigration = (msg: string | null) =>
    !!msg && /(does not exist|schema cache|Could not find the .* column|recurring_transactions)/i.test(msg);

function MainApp() {
    const { records, categories, paymentMethods, error } = useData();
    const { openNew, openDetail } = useRecordUI();
    const lookup = useMemo(() => buildLookup(categories, paymentMethods), [categories, paymentMethods]);

    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>(() => {
        const now = new Date();
        const range = getMonthRange(now.getFullYear(), now.getMonth() + 1);
        return { mode: 'month', ...range, label: `${now.getFullYear()}年${now.getMonth() + 1}月` };
    });

    const [isTimeSelectorOpen, setIsTimeSelectorOpen] = useState(false);
    const [timeSelectorTab, setTimeSelectorTab] = useState<TimeFilterMode>('month');
    const [tempYear, setTempYear] = useState(new Date().getFullYear());
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');

    // Home-screen shortcut: ?action=new opens the new-transaction form once.
    useEffect(() => {
        const url = new URL(window.location.href);
        if (url.searchParams.get('action') === 'new') {
            url.searchParams.delete('action');
            window.history.replaceState(null, '', url.toString());
            openNew();
        }
    }, [openNew]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (isTimeSelectorOpen) setIsTimeSelectorOpen(false);
            else if (isSearchOpen) { setIsSearchOpen(false); setSearchQuery(''); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isTimeSelectorOpen, isSearchOpen]);

    const years = useMemo(() => {
        const current = new Date().getFullYear();
        const oldest = records.reduce((min, r) => Math.min(min, Number(r.date.slice(0, 4)) || current), current);
        const from = Math.min(oldest, current - 2);
        return Array.from({ length: current + 1 - from + 1 }, (_, i) => current + 1 - i);
    }, [records]);

    const expenseBetween = (start: string, end: string) =>
        records.filter(r => r.type === 'expense' && r.date >= start && r.date <= end).reduce((s, r) => s + Number(r.amount), 0);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return filterRecords(records, {
            start: '0000-01-01', end: '9999-12-31', query: searchQuery,
            type: '', categoryId: '', accountId: '', minAmount: '', maxAmount: '',
        }, categories).slice(0, 200);
    }, [records, categories, searchQuery]);

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: '概覽', icon: <LayoutGrid size={22} /> },
        { id: 'transactions', label: '交易', icon: <List size={22} /> },
        { id: 'accounts', label: '帳戶', icon: <Wallet size={22} /> },
        { id: 'budget', label: '預算', icon: <PiggyBank size={22} /> },
        { id: 'settings', label: '設定', icon: <Settings size={22} /> },
    ];
    const showTimeFilter = activeTab === 'overview' || activeTab === 'transactions';

    return (
        <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-emerald-500/30">
            <div className="fixed top-0 left-0 right-0 z-30 px-4 pt-8 pb-2 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none">
                <div className="flex justify-between items-center pointer-events-auto max-w-md mx-auto">
                    {showTimeFilter ? (
                        <button
                            onClick={() => {
                                setTempYear(Number(timeFilter.start.slice(0, 4)));
                                setTimeSelectorTab(timeFilter.mode);
                                setIsTimeSelectorOpen(true);
                            }}
                            className="bg-zinc-800 text-zinc-300 px-4 py-1.5 rounded-full text-sm font-medium flex items-center hover:bg-zinc-700 active:scale-95 transition-all"
                        >
                            {timeFilter.label} <ChevronRight size={14} className="ml-1 rotate-90" />
                        </button>
                    ) : <span />}
                    <button onClick={() => setIsSearchOpen(true)} aria-label="搜尋" className="bg-zinc-800 text-zinc-300 p-2 rounded-full hover:bg-zinc-700 active:scale-95 transition-all">
                        <Search size={20} />
                    </button>
                </div>
            </div>

            <main className="max-w-md mx-auto relative min-h-screen">
                {error && (
                    <div className="mx-4 mt-20 -mb-14 bg-red-500/10 border border-red-500/30 rounded-2xl p-3 text-sm text-red-300 flex gap-2 relative z-10" role="alert">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <span>
                            {looksLikeMissingMigration(error)
                                ? '資料庫尚未升級。請到 Supabase 的 SQL Editor 執行 supabase/migrations/0001_accounts_recurring_dashboard.sql，再重新整理頁面。'
                                : `載入資料時發生錯誤：${error}`}
                        </span>
                    </div>
                )}

                {activeTab === 'overview' && (
                    <Overview
                        timeFilter={timeFilter}
                        setActiveTab={t => setActiveTab(t as Tab)}
                        onCategorySelect={id => { setSelectedCategoryId(id); setActiveTab('transactions'); }}
                    />
                )}
                {activeTab === 'transactions' && <RecordList timeFilter={timeFilter} filterCategory={selectedCategoryId} onFilterCategoryChange={setSelectedCategoryId} />}
                {activeTab === 'accounts' && <AccountsView />}
                {activeTab === 'budget' && <BudgetView />}
                {activeTab === 'settings' && <SettingsView onOpenAccounts={() => setActiveTab('accounts')} />}

                <nav className="fixed bottom-0 w-full max-w-md bg-black/90 backdrop-blur-md border-t border-zinc-900 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex justify-between items-center z-30">
                    {tabs.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all ${isActive ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500'}`}
                            >
                                {item.icon}
                                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </main>

            {isTimeSelectorOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in" role="dialog" aria-label="選擇時間">
                    <div className="bg-zinc-900 rounded-3xl w-full max-w-xs overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
                            <h3 className="text-white font-bold">選擇時間</h3>
                            <button onClick={() => setIsTimeSelectorOpen(false)} aria-label="關閉"><X size={20} className="text-zinc-400" /></button>
                        </div>
                        <div className="flex p-2 bg-zinc-800/50 shrink-0">
                            {(['month', 'year', 'custom'] as TimeFilterMode[]).map(tab => (
                                <button key={tab} onClick={() => setTimeSelectorTab(tab)} className={`flex-1 py-1.5 text-sm font-medium rounded-xl transition-colors ${timeSelectorTab === tab ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}>
                                    {tab === 'month' ? '月' : tab === 'year' ? '年' : '日期'}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 overflow-y-auto w-full">
                            {timeSelectorTab === 'month' && (
                                <div>
                                    <div className="flex justify-between items-center p-4 sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10">
                                        <button onClick={() => setTempYear(y => y - 1)} aria-label="上一年" className="p-1"><ChevronRight size={20} className="rotate-180 text-zinc-400" /></button>
                                        <span className="text-white font-bold">{tempYear}年</span>
                                        <button onClick={() => setTempYear(y => y + 1)} aria-label="下一年" className="p-1"><ChevronRight size={20} className="text-zinc-400" /></button>
                                    </div>
                                    <div className="p-2">
                                        {Array.from({ length: 12 }).map((_, i) => {
                                            const m = i + 1;
                                            const { start, end } = getMonthRange(tempYear, m);
                                            const total = expenseBetween(start, end);
                                            const isSelected = timeFilter.mode === 'month' && timeFilter.start === start;
                                            return (
                                                <button
                                                    key={m}
                                                    onClick={() => { setTimeFilter({ mode: 'month', start, end, label: `${tempYear}年${m}月` }); setIsTimeSelectorOpen(false); }}
                                                    className={`w-full p-3 text-left font-medium flex justify-between items-center rounded-2xl transition-colors ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'}`}
                                                >
                                                    <span>{m}月</span>
                                                    <span className="text-sm font-normal text-zinc-500">{total > 0 ? `-${formatCurrency(total)}` : ''}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {timeSelectorTab === 'year' && (
                                <div className="p-2">
                                    {years.map(y => {
                                        const start = `${y}-01-01`;
                                        const end = `${y}-12-31`;
                                        const total = expenseBetween(start, end);
                                        const isSelected = timeFilter.mode === 'year' && timeFilter.start === start;
                                        return (
                                            <button
                                                key={y}
                                                onClick={() => { setTimeFilter({ mode: 'year', start, end, label: `${y}年` }); setIsTimeSelectorOpen(false); }}
                                                className={`w-full p-4 text-left font-medium flex justify-between items-center rounded-2xl transition-colors ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'}`}
                                            >
                                                <span>{y}年</span>
                                                <span className="text-sm font-normal text-zinc-500">{total > 0 ? `-${formatCurrency(total)}` : ''}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {timeSelectorTab === 'custom' && (
                                <div className="p-6 space-y-4">
                                    <label className="block">
                                        <span className="text-xs text-zinc-500 mb-2 block">開始日期</span>
                                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full bg-zinc-800 text-white p-3 rounded-xl outline-none" />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs text-zinc-500 mb-2 block">結束日期</span>
                                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full bg-zinc-800 text-white p-3 rounded-xl outline-none" />
                                    </label>
                                    <button
                                        onClick={() => {
                                            setTimeFilter({ mode: 'custom', start: customStart, end: customEnd, label: `${customStart.slice(5)} ~ ${customEnd.slice(5)}` });
                                            setIsTimeSelectorOpen(false);
                                        }}
                                        className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl mt-4 disabled:opacity-50"
                                        disabled={!customStart || !customEnd || customStart > customEnd}
                                    >
                                        套用區間
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isSearchOpen && (
                <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-10 max-w-md mx-auto" role="dialog" aria-label="搜尋">
                    <div className="flex items-center px-4 pt-8 pb-4 border-b border-zinc-900">
                        <div className="flex-1 bg-zinc-900 rounded-xl flex items-center px-3 py-2">
                            <Search size={18} className="text-zinc-500 mr-2" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="搜尋分類、備註、地點或金額…"
                                aria-label="搜尋交易"
                                className="bg-transparent outline-none text-white w-full placeholder-zinc-600"
                                autoFocus
                            />
                        </div>
                        <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="ml-3 text-emerald-400 font-medium">取消</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {searchQuery && <p className="text-xs text-zinc-500 mb-3 px-1">在所有期間找到 {searchResults.length} 筆</p>}
                        {searchQuery && searchResults.length === 0 && <div className="text-center text-zinc-500 mt-10">找不到相關結果</div>}
                        {searchResults.length > 0 && (
                            <div className="bg-zinc-900 rounded-3xl overflow-hidden">
                                {searchResults.map((r, i) => (
                                    <RecordRow key={r.id} record={r} lookup={lookup} onClick={() => openDetail(r)} showDate last={i === searchResults.length - 1} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export type { User };
