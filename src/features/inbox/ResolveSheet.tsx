import React, { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Clock, LayoutGrid, Wallet } from 'lucide-react';
import { NotificationEvent, NotificationKind, Record as DbRecord, RecordType } from '../../types/database.types';
import { useData } from '../../data/DataContext';
import { eventDateTime, reasonLabel, sourceLabel } from '../../data/inbox';
import { Card, FieldRow, Segmented, SectionTitle, Sheet, Toggle, selectClass } from '../../components/ui';
import RecordRow, { buildLookup } from '../records/RecordRow';
import { formatCurrency } from '../../utils/helpers';

type Mode = 'record' | 'merge';

/** Days either side of the notification searched for an existing record. */
const MERGE_SEARCH_DAYS = 1;
const DAY_MS = 86_400_000;

/** A bank debit is most often a card payment, so it starts as a transfer. */
const DEFAULT_TYPE: { [K in NotificationKind]: RecordType } = {
    expense: 'expense', income: 'income', transfer_out: 'transfer', transfer_in: 'income',
};

const canRemember = (e: NotificationEvent) => !!e.kind && e.source !== 'unknown' && !e.source.startsWith('app:');

function useMergeCandidates(event: NotificationEvent, date: string): DbRecord[] {
    const { records } = useData();
    return useMemo(() => {
        if (event.amount === null) return [];
        const at = Date.parse(date);
        return records
            .filter(r => Number(r.amount) === Number(event.amount) && Math.abs(Date.parse(r.date) - at) <= MERGE_SEARCH_DAYS * DAY_MS)
            .sort((a, b) => Math.abs(Date.parse(a.date) - at) - Math.abs(Date.parse(b.date) - at));
    }, [records, event.amount, date]);
}

/** Files one pending notification as a new record, into an existing one, or away. */
export default function ResolveSheet({ event, onClose }: { event: NotificationEvent; onClose: () => void }) {
    const { categories, paymentMethods, recordFromEvent, mergeEvent, ignoreEvent } = useData();
    const accounts = paymentMethods.filter(a => !a.archived);
    const lookup = useMemo(() => buildLookup(categories, paymentMethods), [categories, paymentMethods]);
    const initial = eventDateTime(event);

    const [mode, setMode] = useState<Mode>('record');
    const [type, setType] = useState<RecordType>(event.kind ? DEFAULT_TYPE[event.kind] : 'expense');
    const [amount, setAmount] = useState(event.amount === null ? '' : String(Number(event.amount)));
    const [accountId, setAccountId] = useState(() => accounts.find(a => event.last4 && a.match_last4?.includes(event.last4))?.id ?? '');
    const [toAccountId, setToAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState(event.merchant ?? '');
    const [date, setDate] = useState(initial.date);
    const [time, setTime] = useState(initial.time);
    const [remember, setRemember] = useState(canRemember(event));
    const [mergeTarget, setMergeTarget] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const candidates = useMergeCandidates(event, initial.date);
    const typeCategories = categories.filter(c => c.type === (type === 'income' ? 'income' : 'expense'));
    const numericAmount = Number(amount);

    const problem = mode === 'merge'
        ? (mergeTarget ? null : '請選擇要合併的記錄')
        : !amount || !Number.isFinite(numericAmount) || numericAmount <= 0 ? '請輸入金額'
        : !accountId ? '請選擇帳戶'
        : type === 'transfer' && (!toAccountId || toAccountId === accountId) ? '請選擇不同的轉入帳戶'
        : null;

    const run = async (action: () => Promise<void>) => {
        setSaving(true);
        setError(null);
        try {
            await action();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '儲存失敗');
        } finally {
            setSaving(false);
        }
    };

    const submit = () => {
        if (problem) { setError(problem); return; }
        if (mode === 'merge') {
            const target = candidates.find(r => r.id === mergeTarget)!;
            return run(() => mergeEvent(event, target, remember));
        }
        return run(() => recordFromEvent(event, {
            remember,
            record: {
                type,
                amount: numericAmount,
                category_id: type === 'transfer' ? null : categoryId || null,
                payment_method_id: accountId,
                to_payment_method_id: type === 'transfer' ? toAccountId : null,
                description: description.trim(),
                location: '',
                currency_code: event.currency_code,
                date,
                time,
            },
        }));
    };

    return (
        <Sheet title="處理通知" onClose={onClose} zIndex={60} action={{ label: saving ? '儲存中…' : mode === 'merge' ? '合併' : '新增', onClick: submit, disabled: saving }}>
            <Card className="p-4 mb-4">
                <p className="text-3xl font-bold text-white">{event.amount === null ? '金額未知' : formatCurrency(Number(event.amount))}</p>
                <p className="text-zinc-400 text-sm mt-1">{sourceLabel(event.source)} • {initial.date} {initial.time}</p>
                <p className="text-amber-400 text-sm mt-1">{reasonLabel(event.review_reason)}</p>
                {event.raw_text && <p className="text-zinc-500 text-xs mt-3 whitespace-pre-wrap bg-zinc-800 rounded-xl p-3">{event.raw_text}</p>}
            </Card>

            <div className="mb-4">
                <Segmented<Mode> value={mode} onChange={setMode} options={[
                    { value: 'record', label: '新增記錄' },
                    { value: 'merge', label: `合併到既有記錄（${candidates.length}）` },
                ]} />
            </div>
            {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}

            {mode === 'record' ? (
                <>
                    <div className="mb-4">
                        <Segmented<RecordType> value={type} onChange={setType} options={[
                            { value: 'expense', label: '支出' }, { value: 'income', label: '收入' }, { value: 'transfer', label: '轉帳' },
                        ]} />
                    </div>
                    {type === 'transfer' && <p className="text-xs text-zinc-500 -mt-2 mb-4 px-1">繳卡費請選「轉帳」：從銀行帳戶轉到信用卡。</p>}
                    <Card className="p-2 mb-4">
                        <FieldRow label="金額">
                            <input type="number" inputMode="decimal" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" aria-label="金額" className="bg-transparent text-white text-right w-full outline-none placeholder-zinc-600" />
                        </FieldRow>
                        <FieldRow icon={<Wallet size={20} className="text-emerald-500" />} label={type === 'transfer' ? '轉出' : '帳戶'}>
                            <select value={accountId} onChange={e => setAccountId(e.target.value)} className={selectClass} aria-label="帳戶">
                                <option value="" className="bg-zinc-900">請選擇</option>
                                {accounts.map(a => <option key={a.id} value={a.id} className="bg-zinc-900">{a.name}</option>)}
                            </select>
                        </FieldRow>
                        {type === 'transfer' ? (
                            <FieldRow icon={<ArrowRight size={20} className="text-sky-400" />} label="轉入">
                                <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={selectClass} aria-label="轉入帳戶">
                                    <option value="" className="bg-zinc-900">請選擇</option>
                                    {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id} className="bg-zinc-900">{a.name}</option>)}
                                </select>
                            </FieldRow>
                        ) : (
                            <FieldRow icon={<LayoutGrid size={20} className="text-blue-500" />} label="分類">
                                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={selectClass} aria-label="分類">
                                    <option value="" className="bg-zinc-900">未分類</option>
                                    {typeCategories.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                                </select>
                            </FieldRow>
                        )}
                        <FieldRow icon={<Calendar size={20} className="text-orange-500" />} label="日期">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-white text-right outline-none" aria-label="日期" />
                        </FieldRow>
                        <FieldRow icon={<Clock size={20} className="text-purple-500" />} label="時間">
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-transparent text-white text-right outline-none" aria-label="時間" />
                        </FieldRow>
                        <div className="p-3">
                            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="備註（例如商店名稱）" aria-label="備註" className="w-full bg-transparent outline-none text-white placeholder-zinc-600" />
                        </div>
                    </Card>
                </>
            ) : (
                <>
                    <SectionTitle>同金額、前後一天內的記錄</SectionTitle>
                    {candidates.length === 0 ? (
                        <p className="text-sm text-zinc-500 px-1 mb-4">找不到可以合併的記錄。</p>
                    ) : (
                        <Card className="overflow-hidden mb-4">
                            {candidates.map((r, i) => (
                                <div key={r.id} className={mergeTarget === r.id ? 'ring-1 ring-inset ring-emerald-400' : ''}>
                                    <RecordRow record={r} lookup={lookup} onClick={() => setMergeTarget(r.id)} showDate last={i === candidates.length - 1} />
                                </div>
                            ))}
                        </Card>
                    )}
                </>
            )}

            {canRemember(event) && (
                <Card className="p-2 mb-2">
                    <FieldRow label="記住這個選擇" last>
                        <Toggle checked={remember} onChange={setRemember} label="記住這個選擇" />
                    </FieldRow>
                </Card>
            )}
            {canRemember(event) && (
                <p className="text-xs text-zinc-500 mb-6 px-1">
                    {event.merchant ? `下次「${event.merchant}」的通知會自動記到同一個帳戶和分類。` : `下次${sourceLabel(event.source)}會自動記到同一個帳戶。`}
                    {event.kind === 'transfer_out' || event.kind === 'transfer_in' ? '帳戶異動的用途每次不同，仍會請你確認用途。' : ''}
                </p>
            )}

            <button onClick={() => run(() => ignoreEvent(event))} disabled={saving} className="w-full py-3 rounded-2xl bg-zinc-800 text-zinc-300 font-medium disabled:opacity-40">
                忽略這則通知
            </button>
        </Sheet>
    );
}
