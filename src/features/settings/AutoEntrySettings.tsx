import React, { useEffect, useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { AutoEntryMode } from '../../types/database.types';
import { useData } from '../../data/DataContext';
import { InboxService, sourceLabel } from '../../data/inbox';
import { AutoEntryRule, ruleKeyLabel } from '../../lib/autoEntryRules';
import { Card, ConfirmDialog, Segmented, SectionTitle } from '../../components/ui';

const NOTIFY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify`;

/** Remembered choices, each removable so the next matching notification asks again. */
function RememberedRules() {
    const { user, paymentMethods, categories } = useData();
    const [rules, setRules] = useState<AutoEntryRule[] | null>(null);
    const [deleting, setDeleting] = useState<AutoEntryRule | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        InboxService.listRules(user.id)
            .then(list => { if (active) setRules(list); })
            .catch(err => { if (active) setError(err instanceof Error ? err.message : '讀取失敗'); });
        return () => { active = false; };
    }, [user.id]);

    const nameOf = (list: { id: string; name: string }[], id: string | null) => list.find(item => item.id === id)?.name;

    const remove = async (rule: AutoEntryRule) => {
        setDeleting(null);
        setError(null);
        try {
            await InboxService.deleteRule(user.id, rule.id);
            setRules(prev => prev?.filter(r => r.id !== rule.id) ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : '刪除失敗');
        }
    };

    return (
        <>
            <SectionTitle>已記住的選擇</SectionTitle>
            <Card className="mb-2 overflow-hidden">
                {error && <p className="text-red-400 text-sm p-4" role="alert">{error}</p>}
                {!error && rules === null && <p className="text-zinc-500 text-sm p-4">讀取中…</p>}
                {rules?.length === 0 && <p className="text-zinc-500 text-sm p-4">還沒有記住任何選擇。在待確認裡打開「記住這個選擇」就會出現在這裡。</p>}
                {rules?.map(rule => {
                    const category = nameOf(categories, rule.category_id);
                    return (
                        <div key={rule.id} className="flex items-center justify-between p-4 border-b border-zinc-800 last:border-b-0">
                            <div className="min-w-0">
                                <p className="text-white text-sm truncate">{sourceLabel(rule.source)}・{ruleKeyLabel(rule.match_key)}</p>
                                <p className="text-zinc-500 text-xs">
                                    帳戶：{nameOf(paymentMethods, rule.payment_method_id) ?? '（已刪除）'}{category ? `・分類：${category}` : ''}
                                </p>
                            </div>
                            <button onClick={() => setDeleting(rule)} aria-label="刪除這個選擇" className="shrink-0 text-red-400 p-2 rounded-lg bg-red-500/10">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    );
                })}
            </Card>
            <p className="text-zinc-500 text-xs mb-6 px-1">刪除後，下次同樣的通知會再放進待確認問你。已經記好的帳不會被改動。</p>
            {deleting && (
                <ConfirmDialog
                    title="刪除這個選擇？"
                    message={`${sourceLabel(deleting.source)}・${ruleKeyLabel(deleting.match_key)}`}
                    confirmLabel="刪除"
                    onCancel={() => setDeleting(null)}
                    onConfirm={() => remove(deleting)}
                />
            )}
        </>
    );
}

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

            <RememberedRules />

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
