import React, { useState, useMemo } from 'react';
import {
  Search, Settings, Plus, X, ChevronLeft, ChevronRight,
  PieChart as ChartIcon, BarChart3, LayoutGrid, List, Wallet,
  Car, Train, Umbrella, ShoppingBag, Coffee, MoreHorizontal,
  Trash2, Edit2, Check, DollarSign, Euro, PoundSterling, JapaneseYen,
  ArrowRightLeft, Minus, Filter, MapPin, Calendar, Clock, MoreVertical,
  CreditCard, Banknote, Repeat, Flag
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- Mock Data & Constants ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_CATEGORIES = [
  { id: 'cat-1', name: '假期', icon: 'Umbrella', color: '#ef4444', bgColor: 'bg-red-500/20', textColor: 'text-red-500' },
  { id: 'cat-2', name: '汽車', icon: 'Car', color: '#3b82f6', bgColor: 'bg-blue-500/20', textColor: 'text-blue-500' },
  { id: 'cat-3', name: '悠遊卡', icon: 'Train', color: '#10b981', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-500' },
  { id: 'cat-4', name: '購物', icon: 'ShoppingBag', color: '#a855f7', bgColor: 'bg-purple-500/20', textColor: 'text-purple-500' },
  { id: 'cat-5', name: '餐飲', icon: 'Coffee', color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-500' },
];

const CURRENCIES = [
  { code: 'TWD', name: '新台幣', symbol: 'NT$' },
  { code: 'USD', name: '美元', symbol: '$' },
  { code: 'EUR', name: '歐元', symbol: '€' },
  { code: 'JPY', name: '日圓', symbol: '¥' },
  { code: 'GBP', name: '英鎊', symbol: '£' },
  { code: 'CNY', name: '人民幣', symbol: '¥' },
  { code: 'KRW', name: '韓元', symbol: '₩' },
  { code: 'HKD', name: '港幣', symbol: 'HK$' },
  { code: 'AUD', name: '澳幣', symbol: 'A$' },
  { code: 'CAD', name: '加幣', symbol: 'C$' },
  { code: 'SGD', name: '新加坡幣', symbol: 'S$' },
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

const INITIAL_PAYMENT_METHODS = [
  { id: 'pay-1', name: '現金', icon: 'Banknote' },
  { id: 'pay-2', name: '刷卡', icon: 'CreditCard' },
];

const generateMockTransactions = (categories: any[]) => {
  const txs = [];
  for (let m = 1; m <= 12; m++) {
    const numTx = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < numTx; i++) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      txs.push({
        id: generateId(),
        amount: Math.floor(Math.random() * 5000) + 100,
        category_id: cat.id,
        date: `2026-${String(m).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        note: `Mock ${cat.name}`,
        currency: 'TWD',
        location: '台北市',
        time: '12:00',
        payment_method: 'pay-1'
      });
    }
  }
  txs.push({ id: generateId(), amount: 86576, category_id: 'cat-1', date: '2026-01-15', note: '日本行', currency: 'TWD', location: '東京', time: '09:30', payment_method: 'pay-2' });
  txs.push({ id: generateId(), amount: 39557, category_id: 'cat-2', date: '2026-02-10', note: '保養', currency: 'TWD', location: '修車廠', time: '14:00', payment_method: 'pay-2' });
  return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const formatCurrency = (amount: number, currencyCode: string = 'TWD') => {
  const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const IconMap: Record<string, React.ReactNode> = {
  Umbrella: <Umbrella size={24} />,
  Car: <Car size={24} />,
  Train: <Train size={24} />,
  ShoppingBag: <ShoppingBag size={24} />,
  Coffee: <Coffee size={24} />,
  Wallet: <Wallet size={24} />,
  Banknote: <Banknote size={24} />,
  CreditCard: <CreditCard size={24} />,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [paymentMethods, setPaymentMethods] = useState(INITIAL_PAYMENT_METHODS);
  const [transactions, setTransactions] = useState(() => generateMockTransactions(INITIAL_CATEGORIES));
  const [budgets, setBudgets] = useState<{id: string, amount: number, category_id: string, repeat: string}[]>([]);
  const [currentYear, setCurrentYear] = useState(2026);
  
  // UI States
  const [isYearSelectorOpen, setIsYearSelectorOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New Tx State
  const [isNewTxOpen, setIsNewTxOpen] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState('expense');
  const [newCatId, setNewCatId] = useState(categories[0].id);
  const [newNote, setNewNote] = useState('');
  const [newCurrency, setNewCurrency] = useState('TWD');
  const [isCurrencySelectOpen, setIsCurrencySelectOpen] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('12:00');
  const [isTimeEnabled, setIsTimeEnabled] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState(INITIAL_PAYMENT_METHODS[0].id);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('');
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // Budget State
  const [isNewBudgetOpen, setIsNewBudgetOpen] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [newBudgetCatId, setNewBudgetCatId] = useState('');
  const [newBudgetRepeat, setNewBudgetRepeat] = useState('每月');
  const [newBudgetNote, setNewBudgetNote] = useState('');

  // Transaction Detail State
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Category Selection/Edit State
  const [isCatSelectOpen, setIsCatSelectOpen] = useState(false);
  const [isCatEditMode, setIsCatEditMode] = useState(false);
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const handleSaveTx = () => {
    if (!newAmount) return;
    
    const txData = {
      amount: Number(newAmount),
      category_id: newCatId,
      date: newDate,
      note: newNote,
      currency: newCurrency,
      location: newLocation,
      time: isTimeEnabled ? newTime : undefined,
      payment_method: newPaymentMethod
    };

    if (editingTxId) {
      setTransactions(transactions.map(t => t.id === editingTxId ? { ...t, ...txData } : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setEditingTxId(null);
    } else {
      const tx = {
        id: generateId(),
        ...txData
      };
      setTransactions([tx, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
    
    setIsNewTxOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setNewAmount('');
    setNewNote('');
    setNewCurrency('TWD');
    setNewLocation('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewTime('12:00');
    setIsTimeEnabled(false);
    setNewPaymentMethod(paymentMethods[0].id);
    setEditingTxId(null);
  };

  const handleEditTx = (tx: any) => {
    setEditingTxId(tx.id);
    setNewAmount(String(tx.amount));
    setNewCatId(tx.category_id);
    setNewDate(tx.date);
    setNewNote(tx.note || '');
    setNewCurrency(tx.currency || 'TWD');
    setNewLocation(tx.location || '');
    setNewPaymentMethod(tx.payment_method || paymentMethods[0].id);
    if (tx.time) {
      setNewTime(tx.time);
      setIsTimeEnabled(true);
    } else {
      setIsTimeEnabled(false);
    }
    setSelectedTx(null);
    setIsNewTxOpen(true);
  };

  const handleAddPaymentMethod = () => {
    if (!newPaymentMethodName) return;
    const newMethod = {
      id: generateId(),
      name: newPaymentMethodName,
      icon: 'CreditCard'
    };
    setPaymentMethods([...paymentMethods, newMethod]);
    setNewPaymentMethod(newMethod.id);
    setNewPaymentMethodName('');
    setIsAddPaymentOpen(false);
  };

  const handleSaveBudget = () => {
    if (!newBudgetAmount || !newBudgetCatId) return;
    const newBudget = {
      id: generateId(),
      amount: Number(newBudgetAmount),
      category_id: newBudgetCatId,
      repeat: newBudgetRepeat,
      note: newBudgetNote
    };
    setBudgets([...budgets, newBudget]);
    setIsNewBudgetOpen(false);
    setNewBudgetAmount('');
    setNewBudgetCatId('');
    setNewBudgetNote('');
  };

  const handleDeleteTx = () => {
    if (selectedTx) {
      setTransactions(transactions.filter(t => t.id !== selectedTx.id));
      setSelectedTx(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCatName) return;
    const newCat = {
      id: generateId(),
      name: newCatName,
      icon: 'Wallet', // Default icon
      color: '#9ca3af', // Default gray
      bgColor: 'bg-gray-500/20',
      textColor: 'text-gray-500'
    };
    setCategories([...categories, newCat]);
    setNewCatName('');
    setIsAddCatOpen(false);
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(categories.filter(c => c.id !== id));
    if (newCatId === id) {
      setNewCatId(categories[0]?.id || '');
    }
  };

  // Overview Data
  const yearTransactions = useMemo(() => 
    transactions.filter(tx => tx.date.startsWith(String(currentYear))), 
  [transactions, currentYear]);

  const totalExpense = useMemo(() => yearTransactions.reduce((sum, tx) => sum + tx.amount, 0), [yearTransactions]);
  
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    yearTransactions.forEach(tx => {
      if (categories.find(c => c.id === tx.category_id)) {
        stats[tx.category_id] = (stats[tx.category_id] || 0) + tx.amount;
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

  // Search Logic
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return [];
    return transactions.filter(tx => {
      const cat = categories.find(c => c.id === tx.category_id);
      return (
        tx.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(tx.amount).includes(searchQuery)
      );
    });
  }, [transactions, searchQuery, categories]);

  const TransactionsView = () => {
    // Filter transactions
    const filteredTxs = useMemo(() => {
      return yearTransactions.filter(tx => {
        const matchDate = !filterDate || tx.date === filterDate;
        const matchCat = !filterCategory || tx.category_id === filterCategory;
        return matchDate && matchCat;
      });
    }, [yearTransactions, filterDate, filterCategory]);

    // Group transactions by date
    const groupedTransactions = useMemo(() => {
      const groups: Record<string, typeof transactions> = {};
      filteredTxs.forEach(tx => {
        if (!groups[tx.date]) {
          groups[tx.date] = [];
        }
        groups[tx.date].push(tx);
      });
      return groups;
    }, [filteredTxs]);

    // Sort dates descending
    const sortedDates = useMemo(() => {
      return Object.keys(groupedTransactions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [groupedTransactions]);

    const getDayOfWeek = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
      return days[date.getDay()];
    };

    const formatDateHeader = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return `${y}年${m}月${d}日 ${getDayOfWeek(dateStr)}`;
    };

    return (
      <div className="pb-24 animate-in fade-in duration-300 pt-20 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">交易</h1>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-2 rounded-full transition-colors ${isFilterOpen || filterDate || filterCategory ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}
          >
            <Filter size={20} />
          </button>
        </div>

        {isFilterOpen && (
          <div className="bg-zinc-900 rounded-2xl p-4 mb-6 animate-in slide-in-from-top-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">日期</label>
                <input 
                  type="date" 
                  value={filterDate} 
                  onChange={e => setFilterDate(e.target.value)}
                  className="w-full bg-zinc-800 text-white p-2 rounded-xl outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">分類</label>
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  className="w-full bg-zinc-800 text-white p-2 rounded-xl outline-none text-sm appearance-none"
                >
                  <option value="">全部</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {(filterDate || filterCategory) && (
              <button 
                onClick={() => { setFilterDate(''); setFilterCategory(''); }}
                className="mt-3 text-xs text-red-400 font-medium"
              >
                清除篩選
              </button>
            )}
          </div>
        )}

        {/* Expense Summary Card */}
        <div className="mb-8">
           <div className="bg-zinc-900 rounded-3xl p-5 flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm mb-1">支出</p>
                <p className="text-3xl font-bold text-red-500">-{formatCurrency(totalExpense)}</p>
              </div>
           </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-8">
          {sortedDates.map(date => {
            const dailyTxs = groupedTransactions[date];
            const dailyTotal = dailyTxs.reduce((sum, tx) => sum + tx.amount, 0);

            return (
              <div key={date}>
                <h3 className="text-white font-bold text-lg mb-3 ml-1">
                  {formatDateHeader(date)}
                </h3>
                <div className="bg-zinc-900 rounded-3xl overflow-hidden">
                  {dailyTxs.map((tx, idx) => {
                    const cat = categories.find(c => c.id === tx.category_id);
                    const payMethod = paymentMethods.find(p => p.id === tx.payment_method);
                    return (
                      <div 
                        key={tx.id} 
                        onClick={() => setSelectedTx(tx)}
                        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors ${idx !== dailyTxs.length - 1 ? 'border-b border-zinc-800' : ''}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat?.bgColor || 'bg-zinc-800'} ${cat?.textColor || 'text-zinc-400'}`}>
                            {IconMap[cat?.icon || 'Wallet'] || <Wallet size={20} />}
                          </div>
                          <div>
                            <p className="text-white font-medium text-base">{tx.note || cat?.name}</p>
                            <div className="flex items-center text-zinc-500 text-xs mt-0.5">
                               <span>{cat?.name}</span>
                               {tx.time && <span className="mx-1">• {tx.time}</span>}
                               {payMethod && <span className="mx-1">• {payMethod.name}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="text-red-500 font-bold">-{formatCurrency(tx.amount, tx.currency)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Daily Total */}
                <div className="mt-2 text-right px-2">
                   <span className="text-zinc-500 text-sm mr-2">總計:</span>
                   <span className="text-red-500 font-bold">-{formatCurrency(dailyTotal)}</span>
                </div>
              </div>
            );
          })}
          
          {sortedDates.length === 0 && (
            <div className="text-center text-zinc-500 py-10">
              沒有符合條件的交易紀錄
            </div>
          )}
        </div>
      </div>
    );
  };

  const Overview = () => {
    const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

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
                <button onClick={() => setChartType('bar')} className={`p-1.5 rounded-full ${chartType === 'bar' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-400'}`}>
                  <BarChart3 size={18} />
                </button>
                <button onClick={() => setChartType('pie')} className={`p-1.5 rounded-full ${chartType === 'pie' ? 'bg-zinc-700 text-emerald-400' : 'text-zinc-400'}`}>
                  <ChartIcon size={18} />
                </button>
              </div>
            </div>
          </div>

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
                <p className="text-zinc-400 text-xs">平均每日值</p>
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

        {/* Category List */}
        <div className="px-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">總支出</h2>
            <span className="text-emerald-400 text-sm font-medium">分組</span>
          </div>
          <div className="bg-zinc-900 rounded-3xl p-2">
            {categoryStats.map((cat, idx) => (
              <div key={cat.id} className="flex items-center p-3 border-b border-zinc-800 last:border-0">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${cat.bgColor} ${cat.textColor} mr-4`}>
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
  };

  const BudgetView = () => {
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = totalExpense; // Simplified: using total expense for now
    const remaining = totalBudget - totalSpent;

    return (
      <div className="pb-24 animate-in fade-in duration-300 pt-20 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">預算</h1>
          <button onClick={() => setIsNewBudgetOpen(true)} className="bg-zinc-800 p-2 rounded-full text-white">
             <Plus size={24} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-900 p-4 rounded-3xl">
             <div className="flex justify-between items-start mb-2">
               <span className="text-zinc-400 text-sm">計劃中</span>
               <div className="bg-zinc-800 p-1 rounded-full text-zinc-400"><Minus size={16}/></div>
             </div>
             <p className="text-emerald-400 text-xl font-bold">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="bg-zinc-900 p-4 rounded-3xl">
             <div className="flex justify-between items-start mb-2">
               <span className="text-zinc-400 text-sm">剩餘</span>
               <div className="bg-zinc-800 p-1 rounded-full text-zinc-400"><Check size={16}/></div>
             </div>
             <p className="text-emerald-400 text-xl font-bold">{formatCurrency(remaining)}</p>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-4 mb-8 flex items-center space-x-2">
           <span className="text-2xl">🎉</span>
           <span className="text-white font-medium">您在預算內！</span>
        </div>

        <h2 className="text-white font-bold text-lg mb-4">每月</h2>
        <div className="space-y-4">
           {budgets.map(budget => {
             const cat = categories.find(c => c.id === budget.category_id);
             // Calculate spent for this category (simplified for demo)
             const spent = yearTransactions
               .filter(tx => tx.category_id === budget.category_id)
               .reduce((sum, tx) => sum + tx.amount, 0);
             const percent = Math.min((spent / budget.amount) * 100, 100);

             return (
               <div key={budget.id} className="bg-zinc-900 rounded-3xl p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat?.bgColor || 'bg-zinc-800'} ${cat?.textColor || 'text-zinc-400'}`}>
                          {IconMap[cat?.icon || 'Wallet'] || <Wallet size={20} />}
                       </div>
                       <div>
                         <p className="text-white font-medium">{cat?.name || '未分類'}</p>
                         <p className="text-zinc-400 text-xs">剩餘</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-zinc-500 text-xs mb-1">1月01日 - 12月31日</p>
                       <div className="flex items-center justify-end text-emerald-400 font-bold">
                         {formatCurrency(budget.amount - spent)} <ChevronRight size={16} className="ml-1 text-zinc-600"/>
                       </div>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 mb-2">
                    <div className="h-2 rounded-full bg-zinc-600" style={{ width: `${percent}%` }}></div>
                  </div>
                  <p className="text-emerald-400 text-sm font-bold">總計: {formatCurrency(budget.amount)}</p>
               </div>
             );
           })}
           {budgets.length === 0 && (
             <div className="text-center text-zinc-500 py-8">
               尚無預算設定
             </div>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-emerald-500/30">
      
      {/* Global Header (Floating) */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-8 pb-2 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none">
        <div className="flex justify-between items-center pointer-events-auto max-w-md mx-auto">
          <button 
            onClick={() => setIsYearSelectorOpen(true)}
            className="bg-zinc-800 text-zinc-300 px-4 py-1.5 rounded-full text-sm font-medium flex items-center hover:bg-zinc-700 transition-colors"
          >
            年 {currentYear} <ChevronRight size={14} className="ml-1 rotate-90" />
          </button>
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="bg-zinc-800 text-zinc-300 p-2 rounded-full hover:bg-zinc-700 transition-colors"
          >
            <Search size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto relative min-h-screen">
        {activeTab === 'overview' && <Overview />}
        {activeTab === 'transactions' && <TransactionsView />}
        {activeTab === 'budget' && <BudgetView />}
        {activeTab === 'settings' && <div className="pt-24 text-center text-zinc-500">設定 (開發中)</div>}

        {/* FAB */}
        <button 
          onClick={() => setIsNewTxOpen(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-400 rounded-full flex items-center justify-center text-black shadow-lg shadow-emerald-400/20 z-40 hover:scale-105 transition-transform"
        >
          <Plus size={32} />
        </button>

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
                className={`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all ${
                  isActive ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500'
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
            <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="ml-3 text-emerald-400 font-medium">
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat?.bgColor || 'bg-zinc-800'} ${cat?.textColor || 'text-zinc-400'}`}>
                      {IconMap[cat?.icon || 'Wallet'] || <Wallet size={20} />}
                    </div>
                    <div>
                      <p className="text-white font-medium">{tx.note || cat?.name}</p>
                      <p className="text-xs text-zinc-500">{tx.date}</p>
                    </div>
                  </div>
                  <span className="text-red-400 font-medium">-{formatCurrency(tx.amount, tx.currency)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Transaction Modal */}
      {isNewTxOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300 max-w-md mx-auto">
          <div className="flex justify-between items-center px-4 pt-8 pb-4">
            <button onClick={() => { setIsNewTxOpen(false); resetForm(); }} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-white">{editingTxId ? '編輯支出' : '新支出'}</h2>
            <button onClick={handleSaveTx} className="bg-emerald-400 text-black px-4 py-1.5 rounded-full font-bold text-sm">
              儲存
            </button>
          </div>

          <div className="px-4 flex-1 overflow-y-auto pb-8">
            {/* Amount Input */}
            <div className="flex justify-between items-center mb-6 mt-4">
              <div className="flex items-center text-5xl font-bold text-white">
                <span className="mr-1">-</span>
                <span>{CURRENCIES.find(c => c.code === newCurrency)?.symbol}</span>
                <input 
                  type="number" 
                  value={newAmount} 
                  onChange={e => setNewAmount(e.target.value)}
                  placeholder="0"
                  className="bg-transparent outline-none w-full placeholder-zinc-700 ml-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  autoFocus
                />
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setIsCurrencySelectOpen(true)}
                  className="bg-zinc-800 text-emerald-400 px-3 py-1.5 rounded-full text-sm font-bold flex items-center hover:bg-zinc-700"
                >
                  {newCurrency} <ChevronRight size={16} className="ml-1"/>
                </button>
              </div>
            </div>

            {/* Type Toggle */}
            <div className="bg-zinc-900 rounded-full p-1 flex mb-8">
              <button 
                onClick={() => setNewType('expense')} 
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${newType === 'expense' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
              >
                支出
              </button>
              <button 
                onClick={() => setNewType('transfer')} 
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${newType === 'transfer' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
              >
                轉帳
              </button>
            </div>

            {/* Category */}
            <h3 className="text-white font-bold mb-3 px-1">分類</h3>
            <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
              <button 
                onClick={() => setIsCatSelectOpen(true)}
                className="w-full flex items-center justify-between p-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-500/20 text-blue-500 p-2 rounded-xl">
                    <LayoutGrid size={20} />
                  </div>
                  <span className="text-white font-medium">分類</span>
                </div>
                <div className="flex items-center text-zinc-400">
                  <span className="mr-2">{categories.find(c => c.id === newCatId)?.name || '無'}</span>
                  <ChevronRight size={18} />
                </div>
              </button>
            </div>

            {/* Payment Method */}
            <h3 className="text-white font-bold mb-3 px-1">支付方式</h3>
            <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
               <div className="relative">
                 <select 
                   value={newPaymentMethod}
                   onChange={(e) => {
                     if (e.target.value === 'add_new') {
                       setIsAddPaymentOpen(true);
                     } else {
                       setNewPaymentMethod(e.target.value);
                     }
                   }}
                   className="w-full bg-transparent text-white p-3 outline-none appearance-none relative z-10"
                 >
                   {paymentMethods.map(pm => (
                     <option key={pm.id} value={pm.id} className="bg-zinc-900 text-white">{pm.name}</option>
                   ))}
                   <option value="add_new" className="bg-zinc-900 text-emerald-400 font-bold">+ 新增支付方式</option>
                 </select>
                 <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 z-0">
                   <ChevronRight size={18} className="rotate-90" />
                 </div>
                 <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-500 z-0 pointer-events-none">
                    <CreditCard size={20} />
                 </div>
                 <div className="absolute left-12 top-1/2 transform -translate-y-1/2 text-white font-medium pointer-events-none">
                    {/* Visual Label Overlay if needed, but select text works */}
                 </div>
               </div>
            </div>

            {/* Date & Time */}
            <h3 className="text-white font-bold mb-3 px-1">日期與時間</h3>
            <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
              <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-500/20 text-orange-500 p-2 rounded-xl">
                    <Calendar size={20} />
                  </div>
                  <span className="text-white font-medium">日期</span>
                </div>
                <input 
                  type="date" 
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="bg-transparent text-white text-right outline-none"
                />
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-500/20 text-purple-500 p-2 rounded-xl">
                    <Clock size={20} />
                  </div>
                  <span className="text-white font-medium">時間</span>
                </div>
                <div className="flex items-center space-x-3">
                  {isTimeEnabled && (
                    <input 
                      type="time" 
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                      className="bg-transparent text-white text-right outline-none"
                    />
                  )}
                  <button 
                    onClick={() => setIsTimeEnabled(!isTimeEnabled)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${isTimeEnabled ? 'bg-emerald-400' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isTimeEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>
            </div>

            {/* Location */}
            <h3 className="text-white font-bold mb-3 px-1">地點</h3>
            <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-red-500/20 text-red-500 p-2 rounded-xl">
                    <MapPin size={20} />
                  </div>
                  <input 
                    type="text" 
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    placeholder="輸入地點..."
                    className="bg-transparent outline-none text-white w-full placeholder-zinc-500"
                  />
                </div>
              </div>
            </div>

            {/* Note */}
            <h3 className="text-white font-bold mb-3 px-1">備註</h3>
            <div className="bg-zinc-900 rounded-3xl p-4 mb-6">
              <textarea 
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                className="w-full bg-transparent outline-none text-white resize-none h-24 placeholder-zinc-600"
                placeholder="輸入備註..."
              ></textarea>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-10">
          <div className="flex justify-between items-center px-4 pt-8 pb-4">
            <button onClick={() => setSelectedTx(null)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-white">交易詳情</h2>
            <div className="relative group">
              <button className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
                <MoreHorizontal size={20} />
              </button>
              <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-800 rounded-xl shadow-xl overflow-hidden hidden group-hover:block group-focus-within:block">
                <button 
                  onClick={() => handleEditTx(selectedTx)}
                  className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 flex items-center"
                >
                  <Edit2 size={16} className="mr-2" /> 編輯
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full text-left px-4 py-3 text-red-400 hover:bg-zinc-700 flex items-center"
                >
                  <Trash2 size={16} className="mr-2" /> 刪除
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 flex flex-col items-center">
             <div className="text-5xl font-bold text-red-500 mb-2">
               -{formatCurrency(selectedTx.amount, selectedTx.currency)}
             </div>
             <div className="text-zinc-400 mb-8">{selectedTx.note || '無備註'}</div>

             <div className="w-full bg-zinc-900 rounded-3xl overflow-hidden">
                <div className="flex items-center p-4 border-b border-zinc-800">
                  <div className="bg-blue-500/20 text-blue-500 p-2 rounded-xl mr-4">
                    <LayoutGrid size={20} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">分類</p>
                    <p className="text-white font-medium">{categories.find(c => c.id === selectedTx.category_id)?.name}</p>
                  </div>
                </div>
                <div className="flex items-center p-4 border-b border-zinc-800">
                  <div className="bg-orange-500/20 text-orange-500 p-2 rounded-xl mr-4">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">日期</p>
                    <p className="text-white font-medium">{selectedTx.date} {selectedTx.time}</p>
                  </div>
                </div>
                <div className="flex items-center p-4">
                  <div className="bg-red-500/20 text-red-500 p-2 rounded-xl mr-4">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">地點</p>
                    <p className="text-white font-medium">{selectedTx.location || '未設定'}</p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-xs p-6 text-center">
            <h3 className="text-white font-bold text-lg mb-2">確定要刪除這筆交易嗎？</h3>
            <p className="text-zinc-400 text-sm mb-6">此動作無法復原。</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-medium"
              >
                取消
              </button>
              <button 
                onClick={handleDeleteTx}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold"
              >
                刪除交易
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Currency Selection Modal */}
      {isCurrencySelectOpen && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col animate-in slide-in-from-bottom-full max-w-md mx-auto">
          <div className="flex justify-between items-center px-4 pt-8 pb-4">
            <button onClick={() => setIsCurrencySelectOpen(false)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-white">選擇幣別</h2>
            <div className="w-10"></div>
          </div>
          <div className="px-4 flex-1 overflow-y-auto">
             <div className="bg-zinc-900 rounded-3xl overflow-hidden">
               {CURRENCIES.map(curr => (
                 <button
                   key={curr.code}
                   onClick={() => { setNewCurrency(curr.code); setIsCurrencySelectOpen(false); }}
                   className="w-full flex items-center justify-between p-4 border-b border-zinc-800 last:border-0 hover:bg-zinc-800 transition-colors"
                 >
                   <div className="flex items-center">
                     <span className="w-8 font-bold text-emerald-400">{curr.symbol}</span>
                     <span className="text-white font-medium">{curr.code}</span>
                     <span className="text-zinc-500 ml-2 text-sm">{curr.name}</span>
                   </div>
                   {newCurrency === curr.code && <Check size={18} className="text-emerald-400" />}
                 </button>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-xs p-6">
            <h3 className="text-white font-bold text-lg mb-4">新增支付方式</h3>
            <input 
              type="text" 
              value={newPaymentMethodName}
              onChange={(e) => setNewPaymentMethodName(e.target.value)}
              placeholder="名稱 (例如: 悠遊卡)"
              className="w-full bg-zinc-800 text-white p-3 rounded-xl outline-none mb-4 placeholder-zinc-500"
              autoFocus
            />
            <div className="flex space-x-3">
              <button 
                onClick={() => setIsAddPaymentOpen(false)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 font-medium"
              >
                取消
              </button>
              <button 
                onClick={handleAddPaymentMethod}
                className="flex-1 py-3 rounded-xl bg-emerald-400 text-black font-bold"
              >
                新增
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Budget Modal */}
      {isNewBudgetOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300 max-w-md mx-auto">
          <div className="flex justify-between items-center px-4 pt-8 pb-4">
            <button onClick={() => setIsNewBudgetOpen(false)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-white">新預算</h2>
            <button onClick={handleSaveBudget} className="bg-zinc-800 text-zinc-400 px-4 py-1.5 rounded-full font-bold text-sm hover:bg-emerald-400 hover:text-black transition-colors">
              儲存
            </button>
          </div>

          <div className="px-4 flex-1 overflow-y-auto pb-8">
             {/* Amount */}
             <div className="bg-zinc-900 rounded-3xl p-4 mb-6 mt-4">
               <div className="flex items-center text-3xl font-bold text-white">
                 <span className="mr-1">$</span>
                 <input 
                   type="number" 
                   value={newBudgetAmount} 
                   onChange={e => setNewBudgetAmount(e.target.value)}
                   placeholder="0"
                   className="bg-transparent outline-none w-full placeholder-zinc-700"
                   autoFocus
                 />
               </div>
             </div>

             {/* Allocation */}
             <h3 className="text-white font-bold mb-3 px-1">分配</h3>
             <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
                <div className="flex items-center justify-between p-3">
                   <div className="flex items-center space-x-3">
                      <div className="bg-blue-500/20 text-blue-500 p-2 rounded-xl">
                         <LayoutGrid size={20} />
                      </div>
                      <span className="text-white font-medium">分類</span>
                   </div>
                   <select 
                      value={newBudgetCatId}
                      onChange={e => setNewBudgetCatId(e.target.value)}
                      className="bg-transparent text-right text-white outline-none appearance-none pr-6 relative z-10"
                   >
                      <option value="" disabled>選擇分類</option>
                      {categories.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                   </select>
                   <span className="text-red-400 text-sm font-bold absolute right-12 pointer-events-none">必填</span>
                   <ChevronRight size={18} className="text-zinc-600 absolute right-8 pointer-events-none"/>
                </div>
             </div>

             {/* Interval */}
             <h3 className="text-white font-bold mb-3 px-1">間隔</h3>
             <div className="bg-zinc-900 rounded-3xl p-2 mb-2">
                <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                   <div className="flex items-center space-x-3">
                      <div className="bg-purple-500/20 text-purple-500 p-2 rounded-xl">
                         <Repeat size={20} />
                      </div>
                      <span className="text-white font-medium">重複</span>
                   </div>
                   <div className="flex items-center text-zinc-400">
                      <span className="mr-2">每月</span>
                      <ChevronRight size={18} />
                   </div>
                </div>
                <div className="flex items-center justify-between p-3">
                   <div className="flex items-center space-x-3">
                      <div className="bg-zinc-700/50 text-zinc-400 p-2 rounded-xl">
                         <Flag size={20} />
                      </div>
                      <span className="text-white font-medium">結束</span>
                   </div>
                   <div className={`w-12 h-6 rounded-full relative bg-zinc-700`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white`}></div>
                   </div>
                </div>
             </div>
             <p className="text-zinc-500 text-xs px-2 mb-6">該間隔決定預算重複的頻率，顯示的可用金額會根據所選時間段自動調整 <span className="text-emerald-400">了解更多</span></p>

             {/* Note */}
             <h3 className="text-white font-bold mb-3 px-1">備註</h3>
             <div className="bg-zinc-900 rounded-3xl p-4 mb-6">
               <textarea 
                 value={newBudgetNote}
                 onChange={e => setNewBudgetNote(e.target.value)}
                 className="w-full bg-transparent outline-none text-white resize-none h-24 placeholder-zinc-600"
                 placeholder=""
               ></textarea>
             </div>
          </div>
        </div>
      )}

      {/* Category Selection Modal */}
      {isCatSelectOpen && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col animate-in slide-in-from-right max-w-md mx-auto">
          <div className="flex justify-between items-center px-4 pt-8 pb-4">
            <button onClick={() => setIsCatSelectOpen(false)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-bold text-white">分類</h2>
            <div className="flex space-x-3 text-white">
              <button 
                onClick={() => setIsAddCatOpen(true)}
                className="bg-zinc-800 p-2 rounded-full hover:bg-zinc-700"
              >
                <Plus size={20} />
              </button>
              <button 
                onClick={() => setIsCatEditMode(!isCatEditMode)}
                className={`p-2 rounded-full transition-colors ${isCatEditMode ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
              >
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          <div className="px-4 flex-1 overflow-y-auto">
            <h3 className="text-white font-bold mb-3 px-1 mt-4">常用</h3>
            <div className="bg-zinc-900 rounded-3xl p-2">
              {categories.map((cat) => (
                <div 
                  key={cat.id}
                  className="w-full flex items-center p-3 border-b border-zinc-800 last:border-0 rounded-xl relative group"
                >
                  <button 
                    onClick={() => { 
                      if (!isCatEditMode) {
                        setNewCatId(cat.id); 
                        setIsCatSelectOpen(false); 
                      }
                    }}
                    className="flex-1 flex items-center"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.bgColor} ${cat.textColor} mr-4`}>
                      {IconMap[cat.icon] || <Wallet size={20} />}
                    </div>
                    <span className="text-white font-medium">{cat.name}</span>
                  </button>
                  
                  {isCatEditMode && (
                    <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-right-4">
                      <button 
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="bg-red-500/20 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isAddCatOpen && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-xs p-6">
            <h3 className="text-white font-bold text-lg mb-4">新增分類</h3>
            <input 
              type="text" 
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="分類名稱"
              className="w-full bg-zinc-800 text-white p-3 rounded-xl outline-none mb-4 placeholder-zinc-500"
              autoFocus
            />
            <div className="flex space-x-3">
              <button 
                onClick={() => setIsAddCatOpen(false)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 font-medium"
              >
                取消
              </button>
              <button 
                onClick={handleAddCategory}
                className="flex-1 py-3 rounded-xl bg-emerald-400 text-black font-bold"
              >
                新增
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}