import React from 'react';
import { ChevronRight } from 'lucide-react';
import { AutoEntryMode } from '../../types/database.types';
import { useData } from '../../data/DataContext';
import { Card, Segmented, SectionTitle } from '../../components/ui';

const NOTIFY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify`;

export default function AutoEntrySettings({ onBack, onOpenQuickEntry }: { onBack: () => void; onOpenQuickEntry: () => void }) {
    const { settings, updateSettings, pendingEvents } = useData();
    const mode = settings?.auto_entry_mode ?? 'auto';

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex items-center space-x-3 mb-6">
                <button onClick={onBack} aria-label="返回" className="bg-zinc-800 p-2 rounded-full text-white"><ChevronRight className="rotate-180" size={24} /></button>
                <h1 className="text-2xl font-bold text-white">自動記帳</h1>
            </div>

            <SectionTitle>入帳方式</SectionTitle>
            <Card className="p-4 mb-6 space-y-3">
                <Segmented<AutoEntryMode> value={mode} onChange={v => updateSettings({ auto_entry_mode: v })} options={[
                    { value: 'auto', label: '判斷得出來就入帳' },
                    { value: 'review', label: '全部先待確認' },
                ]} />
                <p className="text-zinc-400 text-sm">
                    {mode === 'auto'
                        ? '知道帳戶的消費通知會直接記帳；不知道帳戶、帳戶異動（提款、轉帳）、看不懂或可能重複的通知會放進待確認。'
                        : '每一則通知都先放進待確認，由你決定才記帳。'}
                </p>
                <p className="text-zinc-500 text-xs">目前待確認：{pendingEvents.length} 筆（右上角鈴鐺）</p>
            </Card>

            <SectionTitle>避免重複記帳</SectionTitle>
            <Card className="p-4 mb-6">
                <ul className="text-zinc-400 text-sm space-y-2 list-disc pl-5">
                    <li>同一個來源的兩則通知一定是兩筆消費，例如連刷兩杯咖啡，不會被合併。</li>
                    <li>不同來源描述同一筆消費（LINE Pay＋刷卡通知、先手動記再收到通知）會合成一筆。</li>
                    <li>合併錯了可以在交易詳情按「拆開」；故意重複的記錄，編輯時打開「這是另一筆」就不會被合併。</li>
                </ul>
            </Card>

            <SectionTitle>捷徑連線</SectionTitle>
            <Card className="p-4 mb-6 space-y-2">
                <p className="text-zinc-400 text-sm">通知捷徑使用跟快速記帳相同的 token。</p>
                <p className="text-zinc-500 text-xs break-all">網址：{NOTIFY_URL}</p>
                <button onClick={onOpenQuickEntry} className="w-full mt-2 py-3 rounded-2xl bg-zinc-800 text-white font-medium">管理 token</button>
            </Card>
        </div>
    );
}
