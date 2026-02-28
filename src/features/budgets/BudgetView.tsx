import React, { useState, useMemo } from 'react';
import { Plus, MoreHorizontal, Calendar, Edit2, Trash2, Minus, Check, Wallet, X, LayoutGrid, Repeat, BarChart3, ChevronRight, Flag } from 'lucide-react';
import { useBudgets } from '../../hooks/useBudgets';
import { useTransactions } from '../../hooks/useTransactions';
import { useOptions } from '../../hooks/useOptions';
import { useSettings } from '../../hooks/useSettings';
import { formatCurrency, IconMap } from '../../utils/helpers';
import { Budget } from '../../types/database.types';

export default function BudgetView() {
    const { budgets, addBudget, updateBudget, deleteBudget } = useBudgets();
    const { transactions } = useTransactions();
    const { categories } = useOptions();
    const { settings, updateSettings } = useSettings();

    const resetDay = settings?.budget_reset_day || 1;
    const currentYear = new Date().getFullYear();

    // State
    const [isBudgetHeaderMenuOpen, setIsBudgetHeaderMenuOpen] = useState(false);
    const [isResetDayOpen, setIsResetDayOpen] = useState(false);
    const [isNewBudgetOpen, setIsNewBudgetOpen] = useState(false);

    const [newBudgetAmount, setNewBudgetAmount] = useState('');
    const [newBudgetCatId, setNewBudgetCatId] = useState('');
    const [newBudgetRepeat, setNewBudgetRepeat] = useState('每月');
    const [newBudgetEnd, setNewBudgetEnd] = useState(false);
    const [newBudgetEndDate, setNewBudgetEndDate] = useState('');
    const [newBudgetNote, setNewBudgetNote] = useState('');
    const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [isBudgetMenuOpen, setIsBudgetMenuOpen] = useState(false);

    // Derived
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);

    const yearTransactions = useMemo(() =>
        transactions.filter(tx => tx.date.startsWith(String(currentYear))),
        [transactions, currentYear]
    );

    const remaining = useMemo(() => {
        if (budgets.length === 0) return 0;
        let totalRem = 0;
        budgets.forEach(budget => {
            const spent = yearTransactions
                .filter(tx => {
                    if (tx.category_id !== budget.category_id) return false;
                    if (budget.end_date) {
                        return new Date(tx.date) <= new Date(budget.end_date);
                    }
                    return true;
                })
                .reduce((sum, tx) => sum + tx.amount, 0);
            totalRem += (budget.amount - spent);
        });
        return totalRem;
    }, [budgets, yearTransactions]);

    const isOverBudget = remaining < 0;

    // Handlers
    const handleSaveBudget = async () => {
        if (!newBudgetAmount || !newBudgetCatId) return;

        const budgetData = {
            amount: Number(newBudgetAmount),
            category_id: newBudgetCatId,
            repeat: newBudgetRepeat,
            end_date: newBudgetEnd ? newBudgetEndDate : null,
            note: newBudgetNote,
            currency_code: 'TWD',
            start_date: new Date().toISOString().split('T')[0]
        };

        if (editingBudgetId) {
            await updateBudget(editingBudgetId, budgetData);
        } else {
            await addBudget(budgetData);
        }

        setIsNewBudgetOpen(false);
        setEditingBudgetId(null);
        setNewBudgetAmount('');
        setNewBudgetCatId('');
        setNewBudgetNote('');
        setNewBudgetEnd(false);
        setNewBudgetEndDate('');
    };

    const handleDeleteBudget = async (id: string) => {
        await deleteBudget(id);
        setSelectedBudget(null);
    };

    const handleEditBudget = (budget: Budget) => {
        setEditingBudgetId(budget.id);
        setNewBudgetAmount(String(budget.amount));
        setNewBudgetCatId(budget.category_id);
        setNewBudgetRepeat(budget.repeat || '每月');
        setNewBudgetEnd(!!budget.end_date);
        setNewBudgetEndDate(budget.end_date || '');
        setNewBudgetNote(budget.note || '');

        setIsNewBudgetOpen(true);
        setSelectedBudget(null);
    };

    return (
        <div className="pb-24 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">預算</h1>
                <div className="flex space-x-3">
                    <div className="relative">
                        <button
                            onClick={() => setIsBudgetHeaderMenuOpen(!isBudgetHeaderMenuOpen)}
                            className="bg-zinc-800 p-2 rounded-full text-white hover:bg-zinc-700 transition-colors"
                        >
                            <MoreHorizontal size={24} />
                        </button>
                        {isBudgetHeaderMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsBudgetHeaderMenuOpen(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                        onClick={() => { setIsResetDayOpen(true); setIsBudgetHeaderMenuOpen(false); }}
                                        className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 flex items-center text-sm"
                                    >
                                        <Calendar size={16} className="mr-2" /> 重置日設定
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <button onClick={() => { setEditingBudgetId(null); setIsNewBudgetOpen(true); }} className="bg-zinc-800 p-2 rounded-full text-white hover:bg-zinc-700 transition-colors">
                        <Plus size={24} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-zinc-900 p-4 rounded-3xl">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-zinc-400 text-sm">計劃中</span>
                        <div className="bg-zinc-800 p-1 rounded-full text-zinc-400"><Minus size={16} /></div>
                    </div>
                    <p className="text-emerald-400 text-xl font-bold">{formatCurrency(totalBudget)}</p>
                </div>
                <div className="bg-zinc-900 p-4 rounded-3xl">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-zinc-400 text-sm">剩餘</span>
                        <div className="bg-zinc-800 p-1 rounded-full text-zinc-400"><Check size={16} /></div>
                    </div>
                    <p className={`${remaining < 0 ? 'text-red-400' : 'text-emerald-400'} text-xl font-bold`}>{formatCurrency(remaining)}</p>
                </div>
            </div>

            {budgets.length > 0 && (
                <div className={`bg-zinc-900 rounded-3xl p-4 mb-8 flex items-center space-x-2 ${isOverBudget ? 'border border-red-500/30' : ''}`}>
                    <span className="text-2xl">{isOverBudget ? '⚠️' : '🎉'}</span>
                    <span className={`${isOverBudget ? 'text-red-400' : 'text-white'} font-medium`}>
                        {isOverBudget ? '您已超出預算！' : '您在預算內！'}
                    </span>
                </div>
            )}

            <h2 className="text-white font-bold text-lg mb-4">預算清單</h2>
            <div className="space-y-4">
                {budgets.map(budget => {
                    const cat = categories.find(c => c.id === budget.category_id);
                    const spent = yearTransactions
                        .filter(tx => {
                            if (tx.category_id !== budget.category_id) return false;
                            if (budget.end_date) {
                                return new Date(tx.date) <= new Date(budget.end_date);
                            }
                            return true;
                        })
                        .reduce((sum, tx) => sum + tx.amount, 0);
                    const percent = Math.min((spent / budget.amount) * 100, 100);
                    const isOver = budget.amount - spent < 0;

                    return (
                        <div
                            key={budget.id}
                            onClick={() => setSelectedBudget(budget)}
                            className="bg-zinc-900 rounded-3xl p-4 cursor-pointer hover:bg-zinc-800 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat?.color ? '' : 'bg-zinc-800'} text-white`}>
                                        {IconMap[cat?.icon || 'Wallet'] || <Wallet size={20} />}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{cat?.name || '未分類'}</p>
                                        <p className="text-zinc-400 text-xs">剩餘</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-zinc-500 text-xs mb-1">
                                        1月{String(resetDay).padStart(2, '0')}日 - {budget.end_date ? new Date(budget.end_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : '12月31日'}
                                    </p>
                                    <div className={`flex items-center justify-end font-bold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {formatCurrency(budget.amount - spent)} <ChevronRight size={16} className="ml-1 text-zinc-600" />
                                    </div>
                                </div>
                            </div>
                            <div className="w-full bg-zinc-800 rounded-full h-2 mb-2">
                                <div className="h-2 rounded-full" style={{ width: `${percent}%`, backgroundColor: isOver ? '#f87171' : '#34d399' }}></div>
                            </div>
                            <p className="text-emerald-400 text-sm font-bold">總計: {formatCurrency(budget.amount)}</p>
                        </div>
                    );
                })}
                {budgets.length === 0 && (
                    <div className="text-center text-zinc-500 py-12">
                        <Wallet size={48} className="mx-auto mb-4 opacity-20" />
                        <p>尚無預算設定</p>
                    </div>
                )}
            </div>

            {/* New Budget Modal */}
            {isNewBudgetOpen && (
                <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300 max-w-md mx-auto">
                    <div className="flex justify-between items-center px-4 pt-8 pb-4">
                        <button onClick={() => setIsNewBudgetOpen(false)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
                            <X size={20} />
                        </button>
                        <h2 className="text-lg font-bold text-white">{editingBudgetId ? '編輯預算' : '新預算'}</h2>
                        <button onClick={handleSaveBudget} className="bg-zinc-800 text-zinc-400 px-4 py-1.5 rounded-full font-bold text-sm hover:bg-emerald-400 hover:text-black transition-colors">
                            儲存
                        </button>
                    </div>

                    <div className="px-4 flex-1 overflow-y-auto pb-8">
                        <div className="bg-zinc-900 rounded-3xl p-4 mb-6 mt-4">
                            <div className="flex items-center text-3xl font-bold text-white">
                                <span className="mr-1">$</span>
                                <input
                                    type="number"
                                    value={newBudgetAmount}
                                    onChange={e => setNewBudgetAmount(e.target.value)}
                                    placeholder="0"
                                    className="bg-transparent outline-none w-full placeholder-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <h3 className="text-white font-bold mb-3 px-1">分配</h3>
                        <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
                            <div className="flex items-center justify-between p-3 relative">
                                <div className="flex items-center space-x-3">
                                    <div className="bg-blue-500/20 text-blue-500 p-2 rounded-xl"><LayoutGrid size={20} /></div>
                                    <span className="text-white font-medium">分類</span>
                                </div>
                                <div className="flex items-center">
                                    {!newBudgetCatId && <span className="text-red-400 text-sm font-bold mr-2">必填</span>}
                                    <select
                                        value={newBudgetCatId}
                                        onChange={e => setNewBudgetCatId(e.target.value)}
                                        className="bg-transparent text-right text-white outline-none appearance-none pr-6 relative z-10"
                                    >
                                        <option value="" disabled>選擇分類</option>
                                        {categories.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                                    </select>
                                    <ChevronRight size={18} className="text-zinc-600 absolute right-3 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <h3 className="text-white font-bold mb-3 px-1">間隔</h3>
                        <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
                            <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                                <div className="flex items-center space-x-3">
                                    <div className="bg-purple-500/20 text-purple-500 p-2 rounded-xl"><Repeat size={20} /></div>
                                    <span className="text-white font-medium">重複</span>
                                </div>
                                <div className="flex items-center text-zinc-400 relative">
                                    <select
                                        value={newBudgetRepeat}
                                        onChange={e => setNewBudgetRepeat(e.target.value)}
                                        className="bg-transparent text-right text-white outline-none appearance-none pr-6"
                                    >
                                        <option value="每日" className="bg-zinc-900">每日</option>
                                        <option value="每週" className="bg-zinc-900">每週</option>
                                        <option value="每月" className="bg-zinc-900">每月</option>
                                        <option value="每年" className="bg-zinc-900">每年</option>
                                    </select>
                                    <ChevronRight size={18} className="absolute right-0 pointer-events-none" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3">
                                <div className="flex items-center space-x-3">
                                    <div className={`bg-zinc-700/50 ${newBudgetEnd ? 'text-emerald-400' : 'text-zinc-400'} p-2 rounded-xl`}><Flag size={20} /></div>
                                    <span className="text-white font-medium">結束</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    {newBudgetEnd && (
                                        <input type="date" value={newBudgetEndDate} onChange={e => setNewBudgetEndDate(e.target.value)} className="bg-transparent text-white text-right outline-none text-sm" />
                                    )}
                                    <button onClick={() => setNewBudgetEnd(!newBudgetEnd)} className={`w-12 h-6 rounded-full relative transition-colors ${newBudgetEnd ? 'bg-emerald-400' : 'bg-zinc-700'}`}>
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${newBudgetEnd ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>

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

            {/* Budget Detail Modal */}
            {selectedBudget && (
                <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-10">
                    <div className="flex justify-between items-center px-4 pt-8 pb-4">
                        <button onClick={() => setSelectedBudget(null)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full"><X size={20} /></button>
                        <h2 className="text-lg font-bold text-white">預算詳情</h2>
                        <div className="relative">
                            <button onClick={() => setIsBudgetMenuOpen(!isBudgetMenuOpen)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full"><MoreHorizontal size={20} /></button>
                            {isBudgetMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsBudgetMenuOpen(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <button onClick={() => { handleEditBudget(selectedBudget); setIsBudgetMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 flex items-center"><Edit2 size={16} className="mr-2" /> 編輯</button>
                                        <button onClick={() => { handleDeleteBudget(selectedBudget.id); setIsBudgetMenuOpen(false); }} className="w-full text-left px-4 py-3 text-red-400 hover:bg-zinc-700 flex items-center"><Trash2 size={16} className="mr-2" /> 刪除</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="p-6 flex flex-col items-center">
                        {(() => {
                            const cat = categories.find(c => c.id === selectedBudget.category_id);
                            const spent = yearTransactions
                                .filter(tx => {
                                    if (tx.category_id !== selectedBudget.category_id) return false;
                                    if (selectedBudget.end_date) {
                                        return new Date(tx.date) <= new Date(selectedBudget.end_date);
                                    }
                                    return true;
                                })
                                .reduce((sum, tx) => sum + tx.amount, 0);
                            const remainingBudget = selectedBudget.amount - spent;
                            const isOver = remainingBudget < 0;

                            return (
                                <>
                                    <div className="text-5xl font-bold text-white mb-2">{formatCurrency(selectedBudget.amount)}</div>
                                    <div className="text-zinc-400 mb-8">{selectedBudget.note || '無備註'}</div>

                                    <div className="w-full bg-zinc-900 rounded-3xl overflow-hidden">
                                        <div className="flex items-center p-4 border-b border-zinc-800">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat?.color ? '' : 'bg-zinc-800'} text-white mr-4`}>{IconMap[cat?.icon || 'Wallet'] || <Wallet size={20} />}</div>
                                            <div><p className="text-zinc-500 text-xs">分類</p><p className="text-white font-medium">{cat?.name || '未分類'}</p></div>
                                        </div>
                                        <div className="flex items-center p-4 border-b border-zinc-800">
                                            <div className="bg-emerald-500/20 text-emerald-500 p-2 rounded-xl mr-4"><Repeat size={20} /></div>
                                            <div><p className="text-zinc-500 text-xs">間隔</p><p className="text-white font-medium">{selectedBudget.repeat || '每月'}</p></div>
                                        </div>
                                        <div className="flex items-center p-4 border-b border-zinc-800">
                                            <div className="bg-red-500/20 text-red-500 p-2 rounded-xl mr-4"><BarChart3 size={20} /></div>
                                            <div><p className="text-zinc-500 text-xs">已支出</p><p className="text-white font-medium">{formatCurrency(spent)}</p></div>
                                        </div>
                                        <div className="flex items-center p-4">
                                            <div className={`${isOver ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'} p-2 rounded-xl mr-4`}><Check size={20} /></div>
                                            <div><p className="text-zinc-500 text-xs">剩餘</p><p className={`${isOver ? 'text-red-400' : 'text-emerald-400'} font-medium`}>{formatCurrency(remainingBudget)}</p></div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Reset Day Modal */}
            {isResetDayOpen && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-900 rounded-3xl w-full max-w-xs p-6">
                        <h3 className="text-white font-bold text-lg mb-4">重置日設定</h3>
                        <p className="text-zinc-400 text-sm mb-4">請選擇每個月預算重置的日期</p>
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
                        <button onClick={() => setIsResetDayOpen(false)} className="w-full py-3 rounded-xl bg-emerald-400 text-black font-bold">
                            完成
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
