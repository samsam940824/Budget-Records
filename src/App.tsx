import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  PieChart as ChartIcon,
  Calendar as CalendarIcon,
  Search,
  Settings,
  Plus,
  Trash2,
  Download,
  Wallet,
  CreditCard,
  Coffee,
  Car,
  Film,
  Home,
  ShoppingBag,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Receipt
} from 'lucide-react';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- 模擬資料庫與初始設定 (Mock Supabase Database) ---

const generateId = () => Math.random().toString(36).substr(2, 9);
const todayStr = new Date().toISOString().split('T')[0];

const INITIAL_CATEGORIES = [
  { id: 'cat-1', name: '餐飲', icon: 'Coffee', created_at: new Date().toISOString() },
  { id: 'cat-2', name: '交通', icon: 'Car', created_at: new Date().toISOString() },
  { id: 'cat-3', name: '娛樂', icon: 'Film', created_at: new Date().toISOString() },
  { id: 'cat-4', name: '居住', icon: 'Home', created_at: new Date().toISOString() },
  { id: 'cat-5', name: '購物', icon: 'ShoppingBag', created_at: new Date().toISOString() },
];

const INITIAL_PAYMENT_METHODS = [
  { id: 'pay-1', name: '現金', created_at: new Date().toISOString() },
  { id: 'pay-2', name: '信用卡', created_at: new Date().toISOString() },
  { id: 'pay-3', name: 'LinePay', created_at: new Date().toISOString() },
];

// 產生過去 14 天的假資料以供圖表展示
const generateMockTransactions = () => {
  const txs = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - Math.floor(Math.random() * 14));
    txs.push({
      id: generateId(),
      amount: Math.floor(Math.random() * 800) + 50,
      category_id: INITIAL_CATEGORIES[Math.floor(Math.random() * INITIAL_CATEGORIES.length)].id,
      payment_id: INITIAL_PAYMENT_METHODS[Math.floor(Math.random() * INITIAL_PAYMENT_METHODS.length)].id,
      note: ['午餐', '搭車', '看電影', '買衣服', '買飲料', '晚餐'][Math.floor(Math.random() * 6)],
      date: d.toISOString().split('T')[0],
      created_at: new Date().toISOString()
    });
  }
  return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const INITIAL_TRANSACTIONS = generateMockTransactions();
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// --- 共用輔助函式 ---

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);
};

const IconMap: Record<string, React.ReactNode> = {
  Coffee: <Coffee size={20} />,
  Car: <Car size={20} />,
  Film: <Film size={20} />,
  Home: <Home size={20} />,
  ShoppingBag: <ShoppingBag size={20} />,
  Wallet: <Wallet size={20} />,
  CreditCard: <CreditCard size={20} />,
  Smartphone: <Smartphone size={20} />
};

const getCategoryIcon = (iconName: string) => IconMap[iconName] || <Wallet size={20} />;

// CSV 匯出輔助函式
const exportToCSV = (transactions: any[], categories: any[], paymentMethods: any[], filename = 'transactions.csv') => {
  const headers = ['日期', '類別', '支付方式', '金額', '備註'];
  const rows = transactions.map(tx => {
    const cat = categories.find(c => c.id === tx.category_id)?.name || '未知';
    const pay = paymentMethods.find(p => p.id === tx.payment_id)?.name || '未知';
    return [tx.date, cat, pay, tx.amount, tx.note];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // 加入 BOM 以支援 Excel 顯示中文
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('url');
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};


// --- 主應用程式元件 ---
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // 模擬 Supabase State
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [paymentMethods, setPaymentMethods] = useState(INITIAL_PAYMENT_METHODS);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [budget, setBudget] = useState(20000); // 預設預算

  // --- 資料處理與衍生狀態 (即時更新) ---
  const today = new Date().toISOString().split('T')[0];
  const currentMonthPrefix = today.substring(0, 7); // YYYY-MM

  const monthTransactions = useMemo(() => 
    transactions.filter(tx => tx.date.startsWith(currentMonthPrefix)),
  [transactions, currentMonthPrefix]);

  const monthTotal = useMemo(() => 
    monthTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
  [monthTransactions]);

  const todayTotal = useMemo(() => 
    transactions.filter(tx => tx.date === today).reduce((sum, tx) => sum + Number(tx.amount), 0),
  [transactions, today]);

  const budgetProgress = Math.min((monthTotal / budget) * 100, 100);
  const progressColor = budgetProgress < 70 ? 'bg-emerald-500' : budgetProgress < 90 ? 'bg-amber-500' : 'bg-rose-500';

  // 新增交易
  const handleAddTransaction = (newTx: any) => {
    setTransactions([{ ...newTx, id: generateId(), created_at: new Date().toISOString() }, ...transactions]);
  };

  // 刪除交易
  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter(tx => tx.id !== id));
  };


  // --- 各分頁元件 ---

  // 1. 儀表板 (Dashboard)
  const Dashboard = () => {
    const [amount, setAmount] = useState('');
    const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
    const [paymentId, setPaymentId] = useState(paymentMethods[0]?.id || '');
    const [date, setDate] = useState(today);
    const [note, setNote] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!amount || !categoryId || !paymentId || !date) return;
      handleAddTransaction({ amount: Number(amount), category_id: categoryId, payment_id: paymentId, date, note });
      setAmount('');
      setNote('');
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* 彙整卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 text-sm font-medium mb-1">本月總支出</h3>
            <p className="text-3xl font-bold text-slate-800">{formatCurrency(monthTotal)}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 text-sm font-medium mb-1">今日支出</h3>
            <p className="text-3xl font-bold text-slate-800">{formatCurrency(todayTotal)}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-end mb-2">
              <h3 className="text-slate-500 text-sm font-medium">預算達成率</h3>
              <span className="text-sm font-semibold text-slate-700">{budgetProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1 overflow-hidden">
              <div className={`h-2.5 rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${budgetProgress}%` }}></div>
            </div>
            <p className="text-xs text-slate-400 text-right">上限: {formatCurrency(budget)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 快速輸入表單 */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Plus className="mr-2 w-5 h-5 text-indigo-600" /> 快速記帳</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">金額</label>
                <input type="number" required min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">類別</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">支付方式</label>
                  <select value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">日期</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">備註 (選填)</label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如：午餐便當" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors shadow-sm shadow-indigo-200">
                儲存紀錄
              </button>
            </form>
          </div>

          {/* 近期動態 */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Receipt className="mr-2 w-5 h-5 text-indigo-600" /> 近期動態</h2>
            {transactions.length === 0 ? (
              <div className="text-center text-slate-500 py-10">尚無交易紀錄</div>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 6).map(tx => {
                  const cat = categories.find(c => c.id === tx.category_id);
                  const pay = paymentMethods.find(p => p.id === tx.payment_id);
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                          {cat ? getCategoryIcon(cat.icon) : <Receipt size={20} />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{tx.note || cat?.name || '未分類'}</p>
                          <p className="text-xs text-slate-400">{tx.date} • {pay?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="font-bold text-rose-500">-{formatCurrency(tx.amount)}</span>
                        <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 2. 統計分析 (Statistics)
  const Statistics = () => {
    // 圓餅圖：類別支出比例
    const categoryData = useMemo(() => {
      const data: Record<string, number> = {};
      monthTransactions.forEach(tx => {
        const catName = categories.find(c => c.id === tx.category_id)?.name || '其他';
        data[catName] = (data[catName] || 0) + Number(tx.amount);
      });
      return Object.keys(data).map(key => ({ name: key, value: data[key] })).sort((a,b)=>b.value - a.value);
    }, [monthTransactions, categories]);

    // 環狀圖：支付方式比例
    const paymentData = useMemo(() => {
      const data: Record<string, number> = {};
      monthTransactions.forEach(tx => {
        const payName = paymentMethods.find(p => p.id === tx.payment_id)?.name || '其他';
        data[payName] = (data[payName] || 0) + Number(tx.amount);
      });
      return Object.keys(data).map(key => ({ name: key, value: data[key] }));
    }, [monthTransactions, paymentMethods]);

    // 折線圖：本週 vs 上週
    const trendData = useMemo(() => {
      const data = [];
      const now = new Date();
      // 產生過去 7 天的標籤
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const lastWeekD = new Date(d);
        lastWeekD.setDate(d.getDate() - 7);
        const lastWeekStr = lastWeekD.toISOString().split('T')[0];

        const thisWeekTotal = transactions.filter(t => t.date === dateStr).reduce((s, t) => s + Number(t.amount), 0);
        const lastWeekTotal = transactions.filter(t => t.date === lastWeekStr).reduce((s, t) => s + Number(t.amount), 0);

        data.push({
          name: `${d.getMonth()+1}/${d.getDate()}`,
          '本週支出': thisWeekTotal,
          '上週支出': lastWeekTotal
        });
      }
      return data;
    }, [transactions]);

    // 排行榜
    const topExpenses = useMemo(() => {
      return [...monthTransactions].sort((a, b) => b.amount - a.amount).slice(0, 5);
    }, [monthTransactions]);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">近七日消費趨勢 (本週 vs 上週)</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="本週支出" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="上週支出" stroke="#cbd5e1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6">類別支出比例 (本月)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6">支付方式比例 (本月)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>
                    {paymentData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4">本月前 5 大支出</h2>
          <div className="space-y-3">
            {topExpenses.map((tx, idx) => {
               const cat = categories.find(c => c.id === tx.category_id);
               return (
                 <div key={tx.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0">
                   <div className="flex items-center space-x-4">
                     <span className="text-slate-400 font-bold w-4">{idx + 1}</span>
                     <div>
                       <p className="font-semibold text-slate-800">{tx.note || cat?.name || '未分類'}</p>
                       <p className="text-xs text-slate-400">{tx.date}</p>
                     </div>
                   </div>
                   <span className="font-bold text-rose-500">{formatCurrency(tx.amount)}</span>
                 </div>
               );
            })}
            {topExpenses.length === 0 && <div className="text-center text-slate-400 py-4">無資料</div>}
          </div>
        </div>
      </div>
    );
  };

  // 3. 日曆視圖 (Calendar)
  const CalendarView = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const selectedTransactions = selectedDate 
      ? transactions.filter(tx => tx.date === selectedDate)
      : [];

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">{year}年 {month + 1}月</h2>
            <div className="flex space-x-2">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronLeft size={20}/></button>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronRight size={20}/></button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-semibold text-slate-400">
            <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-24 rounded-xl bg-transparent"></div>;
              
              const fullDate = `${monthStr}-${String(day).padStart(2, '0')}`;
              const dayTotal = transactions.filter(t => t.date === fullDate).reduce((s, t) => s + Number(t.amount), 0);
              const isToday = fullDate === today;
              const isSelected = fullDate === selectedDate;

              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDate(fullDate)}
                  className={`h-20 md:h-24 p-2 rounded-xl border cursor-pointer transition-all flex flex-col justify-between
                    ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:border-indigo-300'}
                    ${isToday ? 'ring-2 ring-indigo-200' : ''}
                  `}
                >
                  <div className={`text-sm font-medium ${isToday ? 'text-indigo-600' : 'text-slate-600'}`}>{day}</div>
                  {dayTotal > 0 && (
                    <div className="text-xs font-bold text-rose-500 text-right truncate">
                      -{dayTotal}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{selectedDate} 詳細清單</h3>
            {selectedTransactions.length === 0 ? (
              <p className="text-slate-500 text-center py-4">本日無支出紀錄</p>
            ) : (
              <div className="space-y-3">
                {selectedTransactions.map(tx => {
                   const cat = categories.find(c => c.id === tx.category_id);
                   return (
                    <div key={tx.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-indigo-500">{getCategoryIcon(cat?.icon || '')}</div>
                        <div>
                          <p className="font-medium text-slate-800">{tx.note || cat?.name}</p>
                          <p className="text-xs text-slate-500">{paymentMethods.find(p=>p.id===tx.payment_id)?.name}</p>
                        </div>
                      </div>
                      <span className="font-bold text-rose-500">-{formatCurrency(tx.amount)}</span>
                    </div>
                   )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 4. 進階搜尋 (Advanced Search)
  const AdvancedSearch = () => {
    const [keyword, setKeyword] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterCat, setFilterCat] = useState('');

    const filtered = useMemo(() => {
      return transactions.filter(tx => {
        const matchKey = !keyword || tx.note?.toLowerCase().includes(keyword.toLowerCase());
        const matchStart = !startDate || tx.date >= startDate;
        const matchEnd = !endDate || tx.date <= endDate;
        const matchCat = !filterCat || tx.category_id === filterCat;
        return matchKey && matchStart && matchEnd && matchCat;
      });
    }, [transactions, keyword, startDate, endDate, filterCat]);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-lg font-bold text-slate-800">進階搜尋過濾</h2>
             <button 
                onClick={() => exportToCSV(filtered, categories, paymentMethods, 'filtered_transactions.csv')}
                className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-medium bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
             >
               <Download size={16} className="mr-1" /> 匯出結果
             </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">關鍵字 (備註)</label>
              <input type="text" value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="搜尋..." className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">開始日期</label>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">結束日期</label>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">指定類別</label>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500">
                <option value="">全部類別</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="p-4">日期</th>
                  <th className="p-4">類別</th>
                  <th className="p-4">項目/備註</th>
                  <th className="p-4">支付方式</th>
                  <th className="p-4 text-right">金額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(tx => {
                  const cat = categories.find(c => c.id === tx.category_id);
                  const pay = paymentMethods.find(p => p.id === tx.payment_id);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">{tx.date}</td>
                      <td className="p-4 flex items-center space-x-2">
                        <span className="text-slate-400">{getCategoryIcon(cat?.icon || '')}</span>
                        <span>{cat?.name}</span>
                      </td>
                      <td className="p-4 text-slate-800">{tx.note || '-'}</td>
                      <td className="p-4">{pay?.name}</td>
                      <td className="p-4 text-right font-semibold text-rose-500">-{formatCurrency(tx.amount)}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan="5" className="p-8 text-center text-slate-400">找不到符合的紀錄</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 5. 系統設定 (Settings)
  const SettingsPage = () => {
    const [newCatName, setNewCatName] = useState('');
    const [newPayName, setNewPayName] = useState('');

    const handleAddCat = (e: React.FormEvent) => {
      e.preventDefault();
      if(!newCatName) return;
      setCategories([...categories, { id: generateId(), name: newCatName, icon: 'Wallet', created_at: new Date().toISOString() }]);
      setNewCatName('');
    };

    const handleAddPay = (e: React.FormEvent) => {
      e.preventDefault();
      if(!newPayName) return;
      setPaymentMethods([...paymentMethods, { id: generateId(), name: newPayName, created_at: new Date().toISOString() }]);
      setNewPayName('');
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
        
        {/* 預算與資料管理 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Wallet className="mr-2 w-5 h-5 text-indigo-500"/> 每月預算設定</h2>
            <div className="flex space-x-3">
              <input type="number" value={budget} onChange={e=>setBudget(Number(e.target.value))} className="flex-1 p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500" />
            </div>
            <p className="text-xs text-slate-400 mt-2">設定每月消費預警上限</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Download className="mr-2 w-5 h-5 text-indigo-500"/> 資料備份</h2>
            <p className="text-sm text-slate-500 mb-4">將所有歷史交易紀錄匯出為 CSV 格式，方便在 Excel 或 Google 試算表檢視。</p>
            <button onClick={() => exportToCSV(transactions, categories, paymentMethods, 'all_transactions_backup.csv')} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center">
              <Download size={18} className="mr-2" /> 匯出所有歷史紀錄
            </button>
          </div>
        </div>

        {/* 分類與支付管理 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 類別管理 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h2 className="text-lg font-bold text-slate-800 mb-4">支出類別管理</h2>
             <form onSubmit={handleAddCat} className="flex space-x-2 mb-4">
               <input type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="新類別名稱..." className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"/>
               <button type="submit" className="bg-indigo-100 text-indigo-700 px-4 rounded-lg hover:bg-indigo-200 font-medium">新增</button>
             </form>
             <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
               {categories.map(cat => (
                 <div key={cat.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <div className="flex items-center space-x-3">
                     <span className="text-slate-400">{getCategoryIcon(cat.icon)}</span>
                     <span className="font-medium text-slate-700">{cat.name}</span>
                   </div>
                   <button onClick={() => setCategories(categories.filter(c => c.id !== cat.id))} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                 </div>
               ))}
             </div>
          </div>

          {/* 支付方式管理 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <h2 className="text-lg font-bold text-slate-800 mb-4">支付方式管理</h2>
             <form onSubmit={handleAddPay} className="flex space-x-2 mb-4">
               <input type="text" value={newPayName} onChange={e=>setNewPayName(e.target.value)} placeholder="新支付方式..." className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"/>
               <button type="submit" className="bg-indigo-100 text-indigo-700 px-4 rounded-lg hover:bg-indigo-200 font-medium">新增</button>
             </form>
             <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
               {paymentMethods.map(pay => (
                 <div key={pay.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                   <span className="font-medium text-slate-700 flex items-center"><CreditCard size={18} className="mr-3 text-slate-400" /> {pay.name}</span>
                   <button onClick={() => setPaymentMethods(paymentMethods.filter(p => p.id !== pay.id))} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    );
  };


  // --- 主版面配置 (Layout) ---
  const NavItems = [
    { id: 'dashboard', label: '首頁', icon: <LayoutDashboard size={22} /> },
    { id: 'stats', label: '統計', icon: <ChartIcon size={22} /> },
    { id: 'calendar', label: '日曆', icon: <CalendarIcon size={22} /> },
    { id: 'search', label: '搜尋', icon: <Search size={22} /> },
    { id: 'settings', label: '設定', icon: <Settings size={22} /> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0 md:pl-64 flex flex-col selection:bg-indigo-100">
      
      {/* 桌面版側邊欄 (Desktop Sidebar) */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-50">
        <div className="p-6 flex items-center space-x-3 text-indigo-600">
          <Wallet size={28} strokeWidth={2.5} />
          <h1 className="text-2xl font-black tracking-tight text-slate-800">智能記帳</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {NavItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${
                activeTab === item.id 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 text-xs text-slate-400 text-center">
          Mock Supabase Demo
        </div>
      </aside>

      {/* 頂部標題列 (Mobile Header) */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 sticky top-0 z-40 flex justify-center items-center">
         <h1 className="text-lg font-bold text-slate-800 flex items-center"><Wallet className="mr-2 text-indigo-600" size={20}/>智能記帳</h1>
      </header>

      {/* 內容區塊 (Main Content) */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'stats' && <Statistics />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'search' && <AdvancedSearch />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      {/* 手機版底部導覽 (Mobile Bottom Tab Bar) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-2 py-2 flex justify-between z-50 pb-safe">
        {NavItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center p-2 min-w-[64px] transition-colors ${
              activeTab === item.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {item.icon}
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}
