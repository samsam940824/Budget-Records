import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { useOptions } from '../../hooks/useOptions';
import { LogOut, User, Wallet, CreditCard, ChevronRight, Plus, Trash2, Edit2, Settings as SettingsIcon, LayoutGrid, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { IconMap } from '../../utils/helpers';


export default function SettingsView() {
    const { user } = useAuth();
    const { settings, updateSettings } = useSettings();
    const { categories, addCategory, deleteCategory, paymentMethods, addPaymentMethod, deletePaymentMethod } = useOptions();

    const [activeSection, setActiveSection] = useState<'main' | 'categories' | 'payments'>('main');

    const [newCatName, setNewCatName] = useState('');
    const [newPaymentName, setNewPaymentName] = useState('');

    const [isCatEditMode, setIsCatEditMode] = useState(false);
    const [isPaymentEditMode, setIsPaymentEditMode] = useState(false);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleAddCategory = async () => {
        if (!newCatName.trim()) return;
        await addCategory({
            name: newCatName.trim(),
            icon: 'Wallet',
            color: '#9ca3af',
            sort_order: categories.length + 1
        });
        setNewCatName('');
    };

    const handleAddPayment = async () => {
        if (!newPaymentName.trim()) return;
        await addPaymentMethod({
            name: newPaymentName.trim(),
            icon: 'CreditCard',
            sort_order: paymentMethods.length + 1
        });
        setNewPaymentName('');
    };

    if (activeSection === 'categories') {
        return (
            <div className="pb-24 animate-in fade-in duration-300 pt-20 px-4">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-3">
                        <button onClick={() => setActiveSection('main')} className="bg-zinc-800 p-2 rounded-full text-white hover:bg-zinc-700">
                            <ChevronRight className="rotate-180" size={24} />
                        </button>
                        <h1 className="text-2xl font-bold text-white">分類管理</h1>
                    </div>
                    <button onClick={() => setIsCatEditMode(!isCatEditMode)} className={`p-2 rounded-full transition-colors ${isCatEditMode ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-white'}`}>
                        <Edit2 size={20} />
                    </button>
                </div>

                <div className="bg-zinc-900 flex rounded-3xl p-2 mb-6 shadow-sm">
                    <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="新分類名稱"
                        className="flex-1 bg-transparent px-4 py-2 text-white outline-none"
                    />
                    <button onClick={handleAddCategory} className="bg-emerald-400 text-black px-4 py-2 rounded-2xl font-bold">
                        新增
                    </button>
                </div>

                <div className="bg-zinc-900 rounded-3xl p-2">
                    {categories.map(cat => (
                        <div key={cat.id} className="w-full flex items-center justify-between p-3 border-b border-zinc-800 last:border-0 rounded-xl">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800 text-white" style={{ color: cat.color ? cat.color : undefined }}>
                                    {IconMap[cat.icon] || <Wallet size={20} />}
                                </div>
                                <span className="text-white font-medium">{cat.name}</span>
                            </div>
                            {isCatEditMode && (
                                <button
                                    onClick={() => deleteCategory(cat.id)}
                                    className="bg-red-500/20 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-colors animate-in fade-in"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (activeSection === 'payments') {
        return (
            <div className="pb-24 animate-in fade-in duration-300 pt-20 px-4">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-3">
                        <button onClick={() => setActiveSection('main')} className="bg-zinc-800 p-2 rounded-full text-white hover:bg-zinc-700">
                            <ChevronRight className="rotate-180" size={24} />
                        </button>
                        <h1 className="text-2xl font-bold text-white">付款方式管理</h1>
                    </div>
                    <button onClick={() => setIsPaymentEditMode(!isPaymentEditMode)} className={`p-2 rounded-full transition-colors ${isPaymentEditMode ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-white'}`}>
                        <Edit2 size={20} />
                    </button>
                </div>

                <div className="bg-zinc-900 flex rounded-3xl p-2 mb-6 shadow-sm">
                    <input
                        type="text"
                        value={newPaymentName}
                        onChange={(e) => setNewPaymentName(e.target.value)}
                        placeholder="新付款方式"
                        className="flex-1 bg-transparent px-4 py-2 text-white outline-none"
                    />
                    <button onClick={handleAddPayment} className="bg-emerald-400 text-black px-4 py-2 rounded-2xl font-bold">
                        新增
                    </button>
                </div>

                <div className="bg-zinc-900 rounded-3xl p-2">
                    {paymentMethods.map(method => (
                        <div key={method.id} className="w-full flex items-center justify-between p-4 border-b border-zinc-800 last:border-0 rounded-xl">
                            <div className="flex items-center space-x-4">
                                <div className="bg-blue-500/20 text-blue-500 p-2 rounded-xl">
                                    {IconMap[method.icon] || <CreditCard size={20} />}
                                </div>
                                <span className="text-white font-medium">{method.name}</span>
                            </div>
                            {isPaymentEditMode && (
                                <button
                                    onClick={() => deletePaymentMethod(method.id)}
                                    className="bg-red-500/20 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-colors animate-in fade-in"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24 animate-in fade-in duration-300 pt-20 px-4">
            <h1 className="text-3xl font-bold text-white mb-6">設定</h1>

            <div className="bg-zinc-900 rounded-3xl p-4 mb-6 flex items-center space-x-4">
                <div className="bg-zinc-800 p-3 rounded-full text-zinc-400">
                    <User size={24} />
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-zinc-500 text-sm">已登入</p>
                    <p className="text-white font-medium truncate">{user?.email}</p>
                </div>
                <button
                    onClick={handleSignOut}
                    className="bg-red-500/10 text-red-400 p-2 flex items-center justify-center rounded-xl hover:bg-red-500/20 transition-colors"
                >
                    <LogOut size={20} />
                </button>
            </div>

            <div className="space-y-4">
                <h2 className="text-zinc-400 font-bold ml-2">資料管理</h2>

                <button
                    onClick={() => setActiveSection('categories')}
                    className="w-full bg-zinc-900 p-4 rounded-3xl flex items-center justify-between hover:bg-zinc-800 transition-colors"
                >
                    <div className="flex items-center space-x-4">
                        <div className="bg-emerald-500/20 text-emerald-500 p-2 rounded-xl">
                            <LayoutGrid size={20} />
                        </div>
                        <span className="text-white font-medium">分類</span>
                    </div>
                    <div className="flex items-center space-x-2 text-zinc-500">
                        <span className="text-sm">{categories.length} 個</span>
                        <ChevronRight size={18} />
                    </div>
                </button>

                <button
                    onClick={() => setActiveSection('payments')}
                    className="w-full bg-zinc-900 p-4 rounded-3xl flex items-center justify-between hover:bg-zinc-800 transition-colors"
                >
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-500/20 text-blue-500 p-2 rounded-xl">
                            <CreditCard size={20} />
                        </div>
                        <span className="text-white font-medium">付款方式</span>
                    </div>
                    <div className="flex items-center space-x-2 text-zinc-500">
                        <span className="text-sm">{paymentMethods.length} 個</span>
                        <ChevronRight size={18} />
                    </div>
                </button>

                <h2 className="text-zinc-400 font-bold ml-2 mt-8">偏好設定</h2>

                <div className="bg-zinc-900 p-4 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="bg-purple-500/20 text-purple-500 p-2 rounded-xl">
                            <SettingsIcon size={20} />
                        </div>
                        <span className="text-white font-medium">預設幣別</span>
                    </div>
                    <select
                        value={settings?.default_currency || 'TWD'}
                        onChange={e => updateSettings({ default_currency: e.target.value })}
                        className="bg-zinc-800 text-white p-2 rounded-xl text-sm outline-none cursor-pointer"
                    >
                        <option value="TWD">TWD ($)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="JPY">JPY (¥)</option>
                    </select>
                </div>

                <div className="bg-zinc-900 p-4 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="bg-yellow-500/20 text-yellow-500 p-2 rounded-xl">
                            <Calendar size={20} />
                        </div>
                        <span className="text-white font-medium">預算重置日</span>
                    </div>
                    <select
                        value={settings?.budget_reset_day || 1}
                        onChange={e => updateSettings({ budget_reset_day: Number(e.target.value) })}
                        className="bg-zinc-800 text-white p-2 rounded-xl text-sm outline-none cursor-pointer"
                    >
                        {[...Array(31)].map((_, i) => (
                            <option key={i} value={i + 1}>{i + 1}日</option>
                        ))}
                    </select>
                </div>

            </div>
        </div>
    );
}
