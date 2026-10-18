import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PaymentMethod } from '../../types/database.types';
import { useData } from '../../data/DataContext';
import { IconPicker, IconTile } from '../../components/AppIcon';
import { Card, ConfirmDialog, FieldRow, SectionTitle, Sheet, Toggle, selectClass } from '../../components/ui';
import { CURRENCIES } from '../../utils/helpers';

export default function AccountForm({ account, onClose }: { account: PaymentMethod | null; onClose: () => void }) {
    const { paymentMethods, settings, records, addAccount, updateAccount, deleteAccount } = useData();
    const [name, setName] = useState(account?.name ?? '');
    const [icon, setIcon] = useState(account?.icon ?? 'Wallet');
    const [color, setColor] = useState(account?.color ?? '#3b82f6');
    const [initialBalance, setInitialBalance] = useState(account ? String(account.initial_balance ?? 0) : '');
    const [currency, setCurrency] = useState(account?.currency_code ?? settings?.default_currency ?? 'TWD');
    const [includeInTotal, setIncludeInTotal] = useState(account?.include_in_total ?? true);
    const [archived, setArchived] = useState(account?.archived ?? false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const usage = account ? records.filter(r => r.payment_method_id === account.id || r.to_payment_method_id === account.id).length : 0;

    const save = async () => {
        const trimmed = name.trim();
        if (!trimmed) { setError('請輸入帳戶名稱'); return; }
        if (paymentMethods.some(p => p.id !== account?.id && p.name.trim() === trimmed)) { setError('已有同名帳戶'); return; }
        const balance = initialBalance === '' ? 0 : Number(initialBalance);
        if (!Number.isFinite(balance)) { setError('期初餘額格式不正確'); return; }
        setSaving(true);
        setError(null);
        const fields = {
            name: trimmed, icon, color, initial_balance: balance, currency_code: currency,
            include_in_total: includeInTotal, archived,
        };
        try {
            if (account) await updateAccount(account.id, fields);
            else await addAccount({ ...fields, sort_order: paymentMethods.length + 1 });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '儲存失敗');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet title={account ? '編輯帳戶' : '新帳戶'} onClose={onClose} action={{ label: saving ? '儲存中…' : '儲存', onClick: save, disabled: saving }}>
            <div className="flex flex-col items-center my-4">
                <IconTile icon={icon} color={color} size={72} />
            </div>
            {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}

            <Card className="p-2 mb-6">
                <FieldRow label="名稱">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="例如：玉山銀行" className="bg-transparent text-white text-right w-full outline-none placeholder-zinc-600" aria-label="帳戶名稱" autoFocus={!account} />
                </FieldRow>
                <FieldRow label="期初餘額">
                    <input type="number" inputMode="decimal" step="any" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="0" className="bg-transparent text-white text-right w-full outline-none placeholder-zinc-600" aria-label="期初餘額" />
                </FieldRow>
                <FieldRow label="幣別" last>
                    <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectClass} aria-label="幣別">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code} className="bg-zinc-900">{c.code} {c.name}</option>)}
                    </select>
                </FieldRow>
            </Card>
            <p className="text-xs text-zinc-500 -mt-4 mb-6 px-1">信用卡可輸入負數表示目前欠款。</p>

            <Card className="p-2 mb-6">
                <FieldRow label="計入淨資產">
                    <Toggle checked={includeInTotal} onChange={setIncludeInTotal} label="計入淨資產" />
                </FieldRow>
                <FieldRow label="封存（停用）" last>
                    <Toggle checked={archived} onChange={setArchived} label="封存帳戶" />
                </FieldRow>
            </Card>

            <SectionTitle>外觀</SectionTitle>
            <Card className="p-4 mb-6">
                <IconPicker icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
            </Card>

            {account && (
                <button onClick={() => setConfirmDelete(true)} className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 font-medium flex items-center justify-center gap-2">
                    <Trash2 size={18} /> 刪除帳戶
                </button>
            )}
            {confirmDelete && account && (
                <ConfirmDialog
                    title={`刪除「${account.name}」？`}
                    message={usage > 0 ? `有 ${usage} 筆交易使用這個帳戶，刪除後這些交易會變成「未指定帳戶」。若只是不再使用，建議改用封存。` : '此動作無法復原。'}
                    confirmLabel="刪除"
                    onCancel={() => setConfirmDelete(false)}
                    onConfirm={async () => {
                        setConfirmDelete(false);
                        try { await deleteAccount(account.id); onClose(); }
                        catch (err) { setError(err instanceof Error ? err.message : '刪除失敗'); }
                    }}
                />
            )}
        </Sheet>
    );
}
