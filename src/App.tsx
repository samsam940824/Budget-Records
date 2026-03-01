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

const YEARS = [2024, 2025, 2026, 2027, 2028];

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
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // UI States
  const [isYearSelectorOpen, setIsYearSelectorOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // Search Logic
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return [];
    return transactions.filter(tx => {
      const cat = categories.find(c => c.id === tx.category_id);
      return (
        (tx.note && tx.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        cat?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(tx.amount).includes(searchQuery)
      );
    });
  }, [transactions, searchQuery, categories]); return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-emerald-500/30">

      {/* Global Header (Floating) */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-8 pb-2 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none">
        <div className="flex justify-between items-center pointer-events-auto max-w-md mx-auto">
          <button
            onClick={() => setIsYearSelectorOpen(true)}
            className="bg-zinc-800 text-zinc-300 px-4 py-1.5 rounded-full text-sm font-medium flex items-center hover:bg-zinc-700 active:scale-95 transition-all"
          >
            年 {currentYear} <ChevronRight size={14} className="ml-1 rotate-90" />
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
        {activeTab === 'overview' && <Overview currentYear={currentYear} setActiveTab={setActiveTab} onCategorySelect={(id) => { setSelectedCategoryId(id); setActiveTab('transactions'); }} />}
        {activeTab === 'transactions' && <RecordList searchQuery={searchQuery} currentYear={currentYear} filterCategory={selectedCategoryId} onFilterCategoryChange={setSelectedCategoryId} />}
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

      {/* Year Selector Modal */}
      {isYearSelectorOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-xs overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-white font-bold">選擇年份</h3>
              <button onClick={() => setIsYearSelectorOpen(false)}><X size={20} className="text-zinc-400" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {YEARS.map(year => (
                <button
                  key={year}
                  onClick={() => { setCurrentYear(year); setIsYearSelectorOpen(false); }}
                  className={`w-full p-4 text-left font-medium flex justify-between items-center hover:bg-zinc-800 transition-colors ${currentYear === year ? 'text-emerald-400' : 'text-white'}`}
                >
                  {year}
                  {currentYear === year && <Check size={18} />}
                </button>
              ))}
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