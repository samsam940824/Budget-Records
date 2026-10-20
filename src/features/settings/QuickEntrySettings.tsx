import React, { useEffect, useState } from 'react';
import { ChevronRight, Copy, Check } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { QUICK_ENTRY_URL, QuickEntryService, QuickEntryTokenInfo } from '../../data/quickEntry';
import { Card, ConfirmDialog, FieldRow } from '../../components/ui';

const GUIDE_URL = 'https://github.com/samsam940824/Budget-Records/blob/main/docs/QUICK_ENTRY.md';

const message = (err: unknown) => (err instanceof Error ? err.message : '操作失敗，請稍後再試');
const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-TW', { hour12: false }) : '尚未使用');

function CopyField({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Clipboard access can be denied; the value stays selectable below.
            if (err instanceof DOMException) setFailed(true);
            else throw err;
        }
    };
    return (
        <div className="p-3 border-b border-zinc-800 last:border-0">
            <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-400 text-sm">{label}</span>
                <button onClick={copy} className="text-emerald-400 text-sm flex items-center gap-1" aria-label={`複製${label}`}>
                    {copied ? <><Check size={14} /> 已複製</> : <><Copy size={14} /> 複製</>}
                </button>
            </div>
            <p className="text-white text-sm font-mono break-all select-all">{value}</p>
            {failed && <p className="text-amber-400 text-xs mt-1">無法自動複製，請長按上方文字手動複製。</p>}
        </div>
    );
}

export default function QuickEntrySettings({ onBack }: { onBack: () => void }) {
    const { user } = useData();
    const [info, setInfo] = useState<QuickEntryTokenInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newToken, setNewToken] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<'replace' | 'revoke' | null>(null);

    useEffect(() => {
        QuickEntryService.getToken(user.id)
            .then(setInfo)
            .catch(err => setError(message(err)))
            .finally(() => setLoading(false));
    }, [user.id]);

    const run = async (action: () => Promise<void>) => {
        setConfirm(null);
        setBusy(true);
        setError(null);
        try { await action(); }
        catch (err) { setError(message(err)); }
        finally { setBusy(false); }
    };

    const create = () => run(async () => {
        setNewToken(await QuickEntryService.createToken(user.id));
        setInfo(await QuickEntryService.getToken(user.id));
    });
    const revoke = () => run(async () => {
        await QuickEntryService.revokeToken(user.id);
        setInfo(null);
        setNewToken(null);
    });

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex items-center space-x-3 mb-6">
                <button onClick={onBack} aria-label="返回" className="bg-zinc-800 p-2 rounded-full text-white"><ChevronRight className="rotate-180" size={24} /></button>
                <h1 className="text-2xl font-bold text-white">快速記帳捷徑</h1>
            </div>

            <p className="text-zinc-500 text-sm mb-4 px-1">
                iPhone 捷徑會讀取這裡的帳戶與分類讓你選擇，選完輸入金額就直接記帳。帳戶或分類有變動，捷徑會自動同步。
            </p>
            {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}

            {loading ? (
                <p className="text-zinc-500 text-sm px-1">載入中…</p>
            ) : (
                <>
                    <Card className="p-2 mb-4">
                        <FieldRow label="狀態">
                            <span className={info ? 'text-emerald-400' : 'text-zinc-500'}>{info ? '已啟用' : '尚未設定'}</span>
                        </FieldRow>
                        {info && (
                            <>
                                <FieldRow label="建立時間"><span className="text-zinc-400 text-sm">{formatTime(info.created_at)}</span></FieldRow>
                                <FieldRow label="最後使用" last><span className="text-zinc-400 text-sm">{formatTime(info.last_used_at)}</span></FieldRow>
                            </>
                        )}
                    </Card>

                    {newToken && (
                        <Card className="mb-4 border border-amber-500/40">
                            <p className="text-amber-400 text-sm p-3 pb-0">這組 token 只會顯示這一次，請現在貼到捷徑裡。不要分享給任何人。</p>
                            <CopyField label="Token" value={newToken} />
                            <CopyField label="網址" value={QUICK_ENTRY_URL} />
                        </Card>
                    )}

                    <div className="space-y-3">
                        <button
                            onClick={() => (info ? setConfirm('replace') : create())}
                            disabled={busy}
                            className="w-full py-3 rounded-2xl bg-emerald-500 text-black font-bold disabled:opacity-40"
                        >
                            {info ? '重新產生 token' : '產生 token'}
                        </button>
                        {info && (
                            <button onClick={() => setConfirm('revoke')} disabled={busy} className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 font-medium disabled:opacity-40">
                                停用捷徑
                            </button>
                        )}
                        <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className="block text-center text-emerald-400 text-sm py-2">
                            捷徑設定教學
                        </a>
                    </div>
                </>
            )}

            {confirm === 'replace' && (
                <ConfirmDialog title="重新產生 token？" message="舊的 token 會立刻失效，要把新的貼到捷徑裡才能繼續記帳。" confirmLabel="重新產生" onConfirm={create} onCancel={() => setConfirm(null)} />
            )}
            {confirm === 'revoke' && (
                <ConfirmDialog title="停用捷徑？" message="目前的 token 會立刻失效，捷徑將無法記帳。" confirmLabel="停用" onConfirm={revoke} onCancel={() => setConfirm(null)} />
            )}
        </div>
    );
}
