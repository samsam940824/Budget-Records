import React, { useState } from 'react';
import { LogOut, User, Wallet, ChevronRight, LayoutGrid, Calendar, Coins, Repeat, FileSpreadsheet, Lock, SunMoon } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { supabase } from '../../lib/supabaseClient';
import { getLockConfig } from '../../lib/lock';
import { getThemePreference, setThemePreference, ThemePreference } from '../../lib/theme';
import { CURRENCIES } from '../../utils/helpers';
import CategoryManager from './CategoryManager';
import RecurringManager from './RecurringManager';
import ImportExport from './ImportExport';
import PasscodeSettings from './PasscodeSettings';

type Section = 'main' | 'categories' | 'recurring' | 'data' | 'lock';

function NavRow({ icon, tint, label, detail, onClick }: { icon: React.ReactNode; tint: string; label: string; detail?: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="w-full bg-zinc-900 p-4 rounded-3xl flex items-center justify-between hover:bg-zinc-800 transition-colors">
            <div className="flex items-center space-x-4">
                <div className={`${tint} p-2 rounded-xl`}>{icon}</div>
                <span className="text-white font-medium">{label}</span>
            </div>
            <div className="flex items-center space-x-2 text-zinc-500">
                {detail && <span className="text-sm">{detail}</span>}
                <ChevronRight size={18} />
            </div>
        </button>
    );
}

function SelectRow({ icon, tint, label, children }: { icon: React.ReactNode; tint: string; label: string; children: React.ReactNode }) {
    return (
        <div className="bg-zinc-900 p-4 rounded-3xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <div className={`${tint} p-2 rounded-xl`}>{icon}</div>
                <span className="text-white font-medium">{label}</span>
            </div>
            {children}
        </div>
    );
}

export default function SettingsView({ onOpenAccounts }: { onOpenAccounts: () => void }) {
    const { user, settings, updateSettings, categories, paymentMethods, recurring, records } = useData();
    const [section, setSection] = useState<Section>('main');
    const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
    const back = () => setSection('main');

    if (section === 'categories') return <CategoryManager onBack={back} />;
    if (section === 'recurring') return <RecurringManager onBack={back} />;
    if (section === 'data') return <ImportExport onBack={back} />;
    if (section === 'lock') return <PasscodeSettings onBack={back} />;

    const selectClass = 'bg-zinc-800 text-white p-2 rounded-xl text-sm outline-none cursor-pointer';

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <h1 className="text-3xl font-bold text-white mb-6">設定</h1>

            <div className="bg-zinc-900 rounded-3xl p-4 mb-6 flex items-center space-x-4">
                <div className="bg-zinc-800 p-3 rounded-full text-zinc-400"><User size={24} /></div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-zinc-500 text-sm">已登入</p>
                    <p className="text-white font-medium truncate">{user.email}</p>
                </div>
                <button onClick={() => supabase.auth.signOut()} aria-label="登出" className="bg-red-500/10 text-red-400 p-2 flex items-center justify-center rounded-xl hover:bg-red-500/20 transition-colors">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="space-y-4">
                <h2 className="text-zinc-400 font-bold ml-2">資料管理</h2>
                <NavRow icon={<LayoutGrid size={20} />} tint="bg-emerald-500/20 text-emerald-500" label="分類" detail={`${categories.length} 個`} onClick={() => setSection('categories')} />
                <NavRow icon={<Wallet size={20} />} tint="bg-blue-500/20 text-blue-500" label="帳戶" detail={`${paymentMethods.length} 個`} onClick={onOpenAccounts} />
                <NavRow icon={<Repeat size={20} />} tint="bg-pink-500/20 text-pink-500" label="定期交易" detail={`${recurring.filter(r => r.active).length} 個進行中`} onClick={() => setSection('recurring')} />
                <NavRow icon={<FileSpreadsheet size={20} />} tint="bg-teal-500/20 text-teal-500" label="匯入與匯出 CSV" detail={`${records.length} 筆`} onClick={() => setSection('data')} />

                <h2 className="text-zinc-400 font-bold ml-2 pt-4">偏好設定</h2>
                <SelectRow icon={<Coins size={20} />} tint="bg-purple-500/20 text-purple-500" label="預設幣別">
                    <select value={settings?.default_currency || 'TWD'} onChange={e => updateSettings({ default_currency: e.target.value })} className={selectClass} aria-label="預設幣別">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}
                    </select>
                </SelectRow>
                <SelectRow icon={<Calendar size={20} />} tint="bg-yellow-500/20 text-yellow-500" label="預算重置日">
                    <select value={settings?.budget_reset_day || 1} onChange={e => updateSettings({ budget_reset_day: Number(e.target.value) })} className={selectClass} aria-label="預算重置日">
                        {[...Array(31)].map((_, i) => <option key={i} value={i + 1}>{i + 1}日</option>)}
                    </select>
                </SelectRow>
                <SelectRow icon={<SunMoon size={20} />} tint="bg-orange-500/20 text-orange-500" label="外觀">
                    <select value={theme} onChange={e => { const v = e.target.value as ThemePreference; setTheme(v); setThemePreference(v); }} className={selectClass} aria-label="外觀">
                        <option value="system">跟隨系統</option>
                        <option value="dark">深色</option>
                        <option value="light">淺色</option>
                    </select>
                </SelectRow>
                <NavRow icon={<Lock size={20} />} tint="bg-red-500/20 text-red-500" label="密碼鎖" detail={getLockConfig() ? '已開啟' : '關閉'} onClick={() => setSection('lock')} />
            </div>
        </div>
    );
}
