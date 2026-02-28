import React, { useState, useMemo } from 'react';
import { Filter, Wallet, MoreHorizontal, X, Edit2, Trash2, LayoutGrid, Calendar, MapPin, Plus } from 'lucide-react';
import { useTransactions } from '../../hooks/useTransactions';
import { useOptions } from '../../hooks/useOptions';
import { formatCurrency, IconMap } from '../../utils/helpers';
import RecordForm from './RecordForm';
import { Record } from '../../types/database.types';

export default function RecordList() {
    const { transactions, deleteTransaction, addTransaction, updateTransaction } = useTransactions();
    const { categories, paymentMethods, loading: optionsLoading } = useOptions();

    const [isNewTxOpen, setIsNewTxOpen] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Record | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isTxMenuOpen, setIsTxMenuOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<Record | null>(null);

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    // Derived state
    const totalExpense = useMemo(() => {
        return transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    }, [transactions]);

    const filteredTxs = useMemo(() => {
        return transactions.filter(tx => {
            const matchStartDate = !filterStartDate || tx.date >= filterStartDate;
            const matchEndDate = !filterEndDate || tx.date <= filterEndDate;
            const matchCat = !filterCategory || tx.category_id === filterCategory;
            return matchStartDate && matchEndDate && matchCat;
        });
    }, [transactions, filterStartDate, filterEndDate, filterCategory]);

    const groupedTransactions = useMemo(() => {
        const groups: Record<string, typeof transactions> = {};
        filteredTxs.forEach(tx => {
            if (!groups[tx.date]) groups[tx.date] = [];
            groups[tx.date].push(tx);
        });
        return groups;
    }, [filteredTxs]);

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

    const handleSave = async (record: Omit<Record, 'id' | 'user_id'>) => {
        if (editingTx) {
            await updateTransaction(editingTx.id, record);
        } else {
            await addTransaction(record);
        }
    };

    return (
        <div className="pb-24 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">交易</h1>
                <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`p-2 rounded-full transition-colors ${isFilterOpen || filterStartDate || filterEndDate || filterCategory ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}
                >
                    <Filter size={20} />
                </button>
            </div>

            {isFilterOpen && (
                <div className="bg-zinc-900 rounded-2xl p-4 mb-6 animate-in slide-in-from-top-4">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">開始日期</label>
                                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full bg-zinc-800 text-white p-2 rounded-xl outline-none text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">結束日期</label>
                                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full bg-zinc-800 text-white p-2 rounded-xl outline-none text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">分類</label>
                            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full bg-zinc-800 text-white p-2 rounded-xl outline-none text-sm appearance-none">
                                <option value="">全部</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    {(filterStartDate || filterEndDate || filterCategory) && (
                        <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterCategory(''); }} className="mt-3 text-xs text-red-400 font-medium">
                            清除篩選
                        </button>
                    )}
                </div>
            )}

            {/* Expense Summary Card */}
            <div className="mb-8">
                <div className="bg-zinc-900 rounded-3xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-zinc-400 text-sm mb-1">總支出</p>
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
                            <h3 className="text-white font-bold text-lg mb-3 ml-1">{formatDateHeader(date)}</h3>
                            <div className="bg-zinc-900 rounded-3xl overflow-hidden">
                                {dailyTxs.map((tx, idx) => {
                                    const cat = categories.find(c => c.id === tx.category_id);
                                    const payMethod = paymentMethods.find(p => p.id === tx.payment_method_id);
                                    return (
                                        <div
                                            key={tx.id}
                                            onClick={() => setSelectedTx(tx)}
                                            className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors ${idx !== dailyTxs.length - 1 ? 'border-b border-zinc-800' : ''}`}
                                        >
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800 text-zinc-400" style={{ color: cat?.color }}>
                                                    {IconMap[cat?.icon || 'Wallet'] || <Wallet size={20} />}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium text-base">{tx.description || cat?.name || '未分類'}</p>
                                                    <div className="flex items-center text-zinc-500 text-xs mt-0.5">
                                                        <span>{cat?.name || '無類別'}</span>
                                                        {tx.time && <span className="mx-1">• {tx.time}</span>}
                                                        {payMethod && <span className="mx-1">• {payMethod.name}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={tx.type === 'expense' ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>
                                                    {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount, tx.currency_code)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 text-right px-2">
                                <span className="text-zinc-500 text-sm mr-2">總計:</span>
                                <span className="text-red-500 font-bold">-{formatCurrency(dailyTotal)}</span>
                            </div>
                        </div>
                    );
                })}
                {sortedDates.length === 0 && <div className="text-center text-zinc-500 py-10">沒有符合條件的交易紀錄</div>}
            </div>

            {/* Floating Add Button */}
            <button
                onClick={() => {
                    setEditingTx(null);
                    setIsNewTxOpen(true);
                }}
                className="fixed bottom-24 right-4 w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black hover:scale-105 transition-transform z-40"
            >
                <Plus size={24} />
            </button>

            <RecordForm
                isOpen={isNewTxOpen}
                onClose={() => setIsNewTxOpen(false)}
                categories={categories}
                paymentMethods={paymentMethods}
                editingRecord={editingTx}
                onSave={handleSave}
            />

            {/* Transaction Detail Modal */}
            {selectedTx && (
                <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-10">
                    <div className="flex justify-between items-center px-4 pt-8 pb-4">
                        <button onClick={() => setSelectedTx(null)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
                            <X size={20} />
                        </button>
                        <h2 className="text-lg font-bold text-white">交易詳情</h2>
                        <div className="relative">
                            <button onClick={() => setIsTxMenuOpen(!isTxMenuOpen)} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
                                <MoreHorizontal size={20} />
                            </button>
                            {isTxMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsTxMenuOpen(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <button onClick={() => { setEditingTx(selectedTx); setIsNewTxOpen(true); setSelectedTx(null); setIsTxMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 flex items-center">
                                            <Edit2 size={16} className="mr-2" /> 編輯
                                        </button>
                                        <button onClick={() => { setShowDeleteConfirm(true); setIsTxMenuOpen(false); }} className="w-full text-left px-4 py-3 text-red-400 hover:bg-zinc-700 flex items-center">
                                            <Trash2 size={16} className="mr-2" /> 刪除
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="p-6 flex flex-col items-center">
                        <div className={selectedTx.type === 'expense' ? 'text-red-500 text-5xl font-bold mb-2' : 'text-emerald-500 text-5xl font-bold mb-2'}>
                            {selectedTx.type === 'expense' ? '-' : '+'}{formatCurrency(selectedTx.amount, selectedTx.currency_code)}
                        </div>
                        <div className="text-zinc-400 mb-8">{selectedTx.description || '無備註'}</div>
                        <div className="w-full bg-zinc-900 rounded-3xl overflow-hidden">
                            <div className="flex items-center p-4 border-b border-zinc-800">
                                <div className="bg-blue-500/20 text-blue-500 p-2 rounded-xl mr-4"><LayoutGrid size={20} /></div>
                                <div><p className="text-zinc-500 text-xs">分類</p><p className="text-white font-medium">{categories.find(c => c.id === selectedTx.category_id)?.name}</p></div>
                            </div>
                            <div className="flex items-center p-4 border-b border-zinc-800">
                                <div className="bg-orange-500/20 text-orange-500 p-2 rounded-xl mr-4"><Calendar size={20} /></div>
                                <div><p className="text-zinc-500 text-xs">日期</p><p className="text-white font-medium">{selectedTx.date} {selectedTx.time}</p></div>
                            </div>
                            <div className="flex items-center p-4">
                                <div className="bg-red-500/20 text-red-500 p-2 rounded-xl mr-4"><MapPin size={20} /></div>
                                <div><p className="text-zinc-500 text-xs">地點</p><p className="text-white font-medium">{selectedTx.location || '未設定'}</p></div>
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
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-medium">取消</button>
                            <button onClick={() => { deleteTransaction(selectedTx!.id); setShowDeleteConfirm(false); setSelectedTx(null); }} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">刪除交易</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
