import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Calendar, Clock, MapPin, LayoutGrid } from 'lucide-react';
import { Category, PaymentMethod, Record as DbRecord } from '../../types/database.types';

interface RecordFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (record: Omit<DbRecord, 'id' | 'user_id'>) => Promise<void>;
    categories: Category[];
    paymentMethods: PaymentMethod[];
    editingRecord?: DbRecord | null;
}

export default function RecordForm({
    isOpen, onClose, onSave, categories, paymentMethods, editingRecord
}: RecordFormProps) {
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [categoryId, setCategoryId] = useState('');
    const [note, setNote] = useState('');
    const [currency, setCurrency] = useState('TWD');
    const [location, setLocation] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('12:00');
    const [isTimeEnabled, setIsTimeEnabled] = useState(false);
    const [paymentMethodId, setPaymentMethodId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (editingRecord) {
                setAmount(String(editingRecord.amount));
                setType(editingRecord.type);
                setCategoryId(editingRecord.category_id);
                setNote(editingRecord.description || '');
                setCurrency(editingRecord.currency_code || 'TWD');
                setLocation(editingRecord.location || '');
                setDate(editingRecord.date);
                if (editingRecord.time) {
                    setTime(editingRecord.time);
                    setIsTimeEnabled(true);
                } else {
                    setIsTimeEnabled(false);
                }
                setPaymentMethodId(editingRecord.payment_method_id);
            } else {
                // Reset form for new record
                setAmount('');
                setType('expense');
                setCategoryId(categories[0]?.id || '');
                setNote('');
                setCurrency('TWD');
                setLocation('');
                setDate(new Date().toISOString().split('T')[0]);
                setIsTimeEnabled(false);
                setPaymentMethodId(paymentMethods[0]?.id || '');
            }
        }
    }, [isOpen, editingRecord, categories, paymentMethods]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!amount || !categoryId || !paymentMethodId) return;
        setLoading(true);
        await onSave({
            amount: Number(amount),
            type,
            category_id: categoryId,
            description: note,
            currency_code: currency,
            location,
            date,
            time: isTimeEnabled ? time : '',
            payment_method_id: paymentMethodId
        });
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300 max-w-md mx-auto">
            <div className="flex justify-between items-center px-4 pt-8 pb-4">
                <button onClick={onClose} className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
                    <X size={20} />
                </button>
                <h2 className="text-lg font-bold text-white">{editingRecord ? '編輯交易' : '新交易'}</h2>
                <button
                    onClick={handleSubmit}
                    disabled={loading || !amount}
                    className="bg-zinc-800 text-zinc-400 px-4 py-1.5 rounded-full font-bold text-sm hover:bg-emerald-400 hover:text-black transition-colors disabled:opacity-50"
                >
                    {loading ? '儲存中...' : '儲存'}
                </button>
            </div>

            <div className="px-4 flex-1 overflow-y-auto pb-8">
                <div className="bg-zinc-900 rounded-3xl p-4 mb-6 mt-4">
                    <div className="flex items-center text-3xl font-bold text-white">
                        <span className="mr-1">$</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0"
                            className="bg-transparent outline-none w-full placeholder-zinc-700"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Category & Payment Method Selection */}
                <h3 className="text-white font-bold mb-3 px-1">基本資訊</h3>
                <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
                    <div className="flex items-center justify-between p-3 border-b border-zinc-800 relative">
                        <span className="text-white font-medium flex items-center gap-3">
                            <LayoutGrid size={20} className="text-blue-500" /> 分類
                        </span>
                        <select
                            value={categoryId}
                            onChange={e => setCategoryId(e.target.value)}
                            className="bg-transparent text-right text-white outline-none appearance-none pr-6 z-10"
                        >
                            {categories.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                        </select>
                        <ChevronRight size={18} className="absolute right-3 text-zinc-500 pointer-events-none" />
                    </div>

                    <div className="flex items-center justify-between p-3 relative">
                        <span className="text-white font-medium flex items-center gap-3">
                            <LayoutGrid size={20} className="text-emerald-500" /> 支付方式
                        </span>
                        <select
                            value={paymentMethodId}
                            onChange={e => setPaymentMethodId(e.target.value)}
                            className="bg-transparent text-right text-white outline-none appearance-none pr-6 z-10"
                        >
                            {paymentMethods.map(p => <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>)}
                        </select>
                        <ChevronRight size={18} className="absolute right-3 text-zinc-500 pointer-events-none" />
                    </div>
                </div>

                {/* Date & Time */}
                <h3 className="text-white font-bold mb-3 px-1">日期與時間</h3>
                <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
                    <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                        <span className="text-white font-medium flex items-center gap-3">
                            <Calendar size={20} className="text-orange-500" /> 日期
                        </span>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="bg-transparent text-white text-right outline-none"
                        />
                    </div>
                    <div className="flex items-center justify-between p-3">
                        <span className="text-white font-medium flex items-center gap-3">
                            <Clock size={20} className="text-purple-500" /> 時間
                        </span>
                        <div className="flex items-center space-x-3">
                            {isTimeEnabled && (
                                <input
                                    type="time"
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
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

                {/* Location & Comments */}
                <h3 className="text-white font-bold mb-3 px-1">其他</h3>
                <div className="bg-zinc-900 rounded-3xl p-2 mb-6">
                    <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                        <span className="text-white font-medium flex items-center gap-3 w-24">
                            <MapPin size={20} className="text-red-500" /> 地點
                        </span>
                        <input
                            type="text"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            className="bg-transparent text-white w-full outline-none placeholder-zinc-600"
                            placeholder="輸入地點..."
                        />
                    </div>
                    <div className="p-3">
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="w-full bg-transparent outline-none text-white resize-none h-20 placeholder-zinc-600"
                            placeholder="輸入備註..."
                        ></textarea>
                    </div>
                </div>

            </div>
        </div>
    );
}
