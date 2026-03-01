import React, { useState, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './features/auth/Login';
import RecordList from './features/records/RecordList';
import BudgetView from './features/budgets/BudgetView';
import SettingsView from './features/settings/SettingsView';
import Overview from './features/overview/Overview';
import { useTransactions } from './hooks/useTransactions';
import { useOptions } from './hooks/useOptions';
import {
  Search, Settings, X, ChevronRight,
  LayoutGrid, List, Wallet, Check
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { formatCurrency, IconMap } from './utils/helpers';

export type TimeFilterMode = 'month' | 'year' | 'custom';
export interface TimeFilter {
  mode: TimeFilterMode;
  start: string;
  end: string;
  label: string;
}

const YEARS = [2024, 2025, 2026, 2027, 2028];

// Helper to get fresh month start/end
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
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <MainApp user={user} />;
}

function MainApp({ user }: { user: any }) {
  const { transactions } = useTransactions();
  const { categories } = useOptions();

  const [activeTab, setActiveTab] = useState('overview');

  // Time Filter State
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(() => {
    const defaultInitDate = new Date();
    const range = getMonthRange(defaultInitDate.getFullYear(), defaultInitDate.getMonth() + 1);
    return {
      mode: 'month',
      start: range.start,
      end: range.end,
      label: `${defaultInitDate.getFullYear()}年${defaultInitDate.getMonth() + 1}月`
    };
  });

  // UI States
  const [isTimeSelectorOpen, setIsTimeSelectorOpen] = useState(false);
  const [timeSelectorTab, setTimeSelectorTab] = useState<TimeFilterMode>('month');
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // 1. Time Filter
      const matchTime = tx.date >= timeFilter.start && tx.date <= timeFilter.end;

      // 2. Search Logic
      let matchSearch = true;
      if (searchQuery) {
        const cat = categories.find(c => c.id === tx.category_id);
        matchSearch =
          (tx.note && tx.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (cat?.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          String(tx.amount).includes(searchQuery);
      }

      return matchTime && matchSearch;
    });
  }, [transactions, searchQuery, categories, timeFilter]); return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-emerald-500/30">

      {/* Global Header (Floating) */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-8 pb-2 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none">
        <div className="flex justify-between items-center pointer-events-auto max-w-md mx-auto">
          <button
            onClick={() => {
              setTempYear(new Date(timeFilter.start).getFullYear());
              setTimeSelectorTab(timeFilter.mode);
              setIsTimeSelectorOpen(true);
            }}
            className="bg-zinc-800 text-zinc-300 px-4 py-1.5 rounded-full text-sm font-medium flex items-center hover:bg-zinc-700 active:scale-95 transition-all"
          >
            {timeFilter.label} <ChevronRight size={14} className="ml-1 rotate-90" />
          </button>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="bg-zinc-800 text-zinc-300 p-2 rounded-full hover:bg-zinc-700 active:scale-95 transition-all"
          >
            <Search size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto relative min-h-screen">
        {activeTab === 'overview' && <Overview timeFilter={timeFilter} setActiveTab={setActiveTab} onCategorySelect={(id) => { setSelectedCategoryId(id); setActiveTab('transactions'); }} />}
        {activeTab === 'transactions' && <RecordList timeFilter={timeFilter} searchQuery={searchQuery} filterCategory={selectedCategoryId} onFilterCategoryChange={setSelectedCategoryId} />}
        {activeTab === 'budget' && <BudgetView />}
        {activeTab === 'settings' && <SettingsView />}

        {/* Tab Bar */}
        <nav className="fixed bottom-0 w-full max-w-md bg-black/90 backdrop-blur-md border-t border-zinc-900 px-6 py-4 flex justify-between items-center z-30 pb-safe">
          {[
            { id: 'overview', label: '概覽', icon: <LayoutGrid size={24} /> },
            { id: 'transactions', label: '交易', icon: <List size={24} /> },
            { id: 'budget', label: '預算', icon: <Wallet size={24} /> },
            { id: 'settings', label: '設定', icon: <Settings size={24} /> }
          ].map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all ${isActive ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500'
                  }`}
              >
                {item.icon}
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </main>

      {/* Time Selector Modal */}
      {isTimeSelectorOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-xs overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <h3 className="text-white font-bold">選擇時間</h3>
              <button onClick={() => setIsTimeSelectorOpen(false)}><X size={20} className="text-zinc-400" /></button>
            </div>

            <div className="flex p-2 bg-zinc-800/50 shrink-0">
              {(['month', 'year', 'custom'] as TimeFilterMode[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setTimeSelectorTab(tab)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-xl transition-colors ${timeSelectorTab === tab ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
                >
                  {tab === 'month' ? '月' : tab === 'year' ? '年' : '日期'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto w-full">
              {timeSelectorTab === 'month' && (
                <div>
                  <div className="flex justify-between items-center p-4 sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10">
                    <button onClick={() => setTempYear(prev => prev - 1)} className="p-1"><ChevronRight size={20} className="rotate-180 text-zinc-400" /></button>
                    <span className="text-white font-bold">{tempYear}年</span>
                    <button onClick={() => setTempYear(prev => prev + 1)} className="p-1"><ChevronRight size={20} className="text-zinc-400" /></button>
                  </div>
                  <div className="p-2">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const m = i + 1;
                      const { start, end } = getMonthRange(tempYear, m);
                      const monthTotal = transactions
                        .filter(tx => tx.date >= start && tx.date <= end && tx.type === 'expense')
                        .reduce((sum, tx) => sum + tx.amount, 0);

                      const isSelected = timeFilter.mode === 'month' && timeFilter.start === start;

                      return (
                        <button
                          key={m}
                          onClick={() => {
                            setTimeFilter({ mode: 'month', start, end, label: `${tempYear}年${m}月` });
                            setIsTimeSelectorOpen(false);
                          }}
                          className={`w-full p-3 text-left font-medium flex justify-between items-center rounded-2xl transition-colors ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'}`}
                        >
                          <span>{m}月</span>
                          <span className="text-sm font-normal text-zinc-500">{monthTotal > 0 ? `-${formatCurrency(monthTotal)}` : ''}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {timeSelectorTab === 'year' && (
                <div className="p-2">
                  {YEARS.map(y => {
                    const start = `${y}-01-01`;
                    const end = `${y}-12-31`;
                    const yearTotal = transactions
                      .filter(tx => tx.date >= start && tx.date <= end && tx.type === 'expense')
                      .reduce((sum, tx) => sum + tx.amount, 0);

                    const isSelected = timeFilter.mode === 'year' && timeFilter.start === start;

                    return (
                      <button
                        key={y}
                        onClick={() => {
                          setTimeFilter({ mode: 'year', start, end, label: `${y}年` });
                          setIsTimeSelectorOpen(false);
                        }}
                        className={`w-full p-4 text-left font-medium flex justify-between items-center rounded-2xl transition-colors ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'}`}
                      >
                        <span>{y}年</span>
                        <span className="text-sm font-normal text-zinc-500">{yearTotal > 0 ? `-${formatCurrency(yearTotal)}` : ''}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {timeSelectorTab === 'custom' && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-2 block">開始日期</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full bg-zinc-800 text-white p-3 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-2 block">結束日期</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full bg-zinc-800 text-white p-3 rounded-xl outline-none" />
                  </div>
                  <button
                    onClick={() => {
                      if (customStart && customEnd && customStart <= customEnd) {
                        setTimeFilter({ mode: 'custom', start: customStart, end: customEnd, label: `${customStart.slice(5)} ~ ${customEnd.slice(5)}` });
                        setIsTimeSelectorOpen(false);
                      }
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

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-10">
          <div className="flex items-center px-4 pt-8 pb-4 border-b border-zinc-900">
            <div className="flex-1 bg-zinc-900 rounded-xl flex items-center px-3 py-2">
              <Search size={18} className="text-zinc-500 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋分類、備註或金額..."
                className="bg-transparent outline-none text-white w-full placeholder-zinc-600"
                autoFocus
              />
            </div>
            <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="ml-3 text-emerald-400 font-medium active:scale-95 transition-all">
              取消
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {searchQuery && filteredTransactions.length === 0 && (
              <div className="text-center text-zinc-500 mt-10">找不到相關結果</div>
            )}
            {filteredTransactions.map(tx => {
              const cat = categories.find(c => c.id === tx.category_id);
              return (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800 text-white" style={{ color: cat?.color ? cat.color : undefined }}>
                      {IconMap[cat?.icon || 'Wallet'] || <Wallet size={20} />}
                    </div>
                    <div>
                      <p className="text-white font-medium">{tx.note || cat?.name}</p>
                      <p className="text-xs text-zinc-500">{tx.date}</p>
                    </div>
                  </div>
                  <span className="text-red-400 font-medium">-{formatCurrency(tx.amount, 'TWD')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}




    </div>
  );
}