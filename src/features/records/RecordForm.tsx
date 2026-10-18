import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Repeat, Flag, Wallet, ArrowRight, Coins } from 'lucide-react';
import { Record as DbRecord, RecordType, RepeatFrequency } from '../../types/database.types';
import { useData } from '../../data/DataContext';
import { NewRecord } from '../../data/records';
import { IconTile } from '../../components/AppIcon';
import { FieldRow, Segmented, Sheet, Toggle, selectClass, Card, SectionTitle } from '../../components/ui';
import { CURRENCIES } from '../../utils/helpers';
import { todayString } from '../../lib/dates';
import { FREQUENCY_LABELS } from '../../lib/recurring';

interface RecordFormProps {
    onClose: () => void;
    editingRecord?: DbRecord | null;
    /** Pre-selected account when opened from an account page. */
    defaultAccountId?: string;
}

type RepeatChoice = 'none' | RepeatFrequency;

export default function RecordForm({ onClose, editingRecord, defaultAccountId }: RecordFormProps) {
    const { categories, paymentMethods, settings, addRecord, updateRecord, addRecurring } = useData();
    const accounts = useMemo(() => paymentMethods.filter(a => !a.archived || a.id === editingRecord?.payment_method_id || a.id === editingRecord?.to_payment_method_id), [paymentMethods, editingRecord]);
    const defaultCurrency = settings?.default_currency || 'TWD';

    const [type, setType] = useState<RecordType>(editingRecord?.type ?? 'expense');
    const [amount, setAmount] = useState(editingRecord ? String(editingRecord.amount) : '');
    const [categoryId, setCategoryId] = useState<string>(editingRecord?.category_id ?? '');
    const [accountId, setAccountId] = useState<string>(editingRecord?.payment_method_id ?? defaultAccountId ?? accounts[0]?.id ?? '');
    const [toAccountId, setToAccountId] = useState<string>(editingRecord?.to_payment_method_id ?? '');
    const [note, setNote] = useState(editingRecord?.description ?? '');
    const [currency, setCurrency] = useState(editingRecord?.currency_code ?? defaultCurrency);
    const [location, setLocation] = useState(editingRecord?.location ?? '');
    const [date, setDate] = useState(editingRecord?.date ?? todayString());
    const [isTimeEnabled, setIsTimeEnabled] = useState(!!editingRecord?.time);
    const [time, setTime] = useState(editingRecord?.time?.slice(0, 5) ?? new Date().toTimeString().slice(0, 5));
    const [repeat, setRepeat] = useState<RepeatChoice>('none');
    const [repeatEvery, setRepeatEvery] = useState(1);
    const [hasEnd, setHasEnd] = useState(false);
    const [endDate, setEndDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const typeCategories = useMemo(
        () => categories.filter(c => (c.type ?? 'expense') === (type === 'income' ? 'income' : 'expense')),
        [categories, type],
    );

    // Keep the category valid for the selected type.
    useEffect(() => {
        if (type === 'transfer') return;
        if (!typeCategories.some(c => c.id === categoryId)) setCategoryId(typeCategories[0]?.id ?? '');
    }, [type, typeCategories, categoryId]);

    useEffect(() => {
        if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
            setToAccountId(accounts.find(a => a.id !== accountId)?.id ?? '');
        }
    }, [type, accountId, toAccountId, accounts]);

    const numericAmount = Number(amount);
    const problem =
        !amount || !Number.isFinite(numericAmount) || numericAmount <= 0 ? '請輸入金額'
        : type === 'transfer' && (!accountId || !toAccountId) ? '轉帳需要兩個帳戶'
        : type === 'transfer' && accountId === toAccountId ? '轉出與轉入帳戶不能相同'
        : hasEnd && repeat !== 'none' && endDate && endDate < date ? '結束日期早於開始日期'
        : null;

    const handleSubmit = async () => {
        if (problem) { setError(problem); return; }
        setSaving(true);
        setError(null);
        const record: NewRecord = {
            type,
            amount: numericAmount,
            category_id: type === 'transfer' ? null : (categoryId || null),
            payment_method_id: accountId || null,
            to_payment_method_id: type === 'transfer' ? toAccountId : null,
            description: note.trim(),
            currency_code: currency,
            location: location.trim(),
            date,
            time: isTimeEnabled ? time : null,
        };
        try {
            if (editingRecord) {
                await updateRecord(editingRecord.id, record);
            } else if (repeat !== 'none') {
                await addRecurring({
                    type: record.type,
                    amount: record.amount,
                    category_id: record.category_id,
                    payment_method_id: record.payment_method_id,
                    to_payment_method_id: record.to_payment_method_id ?? null,
                    description: record.description,
                    location: record.location,
                    currency_code: record.currency_code,
                    frequency: repeat,
                    interval_count: Math.max(1, repeatEvery),
                    start_date: date,
                    end_date: hasEnd && endDate ? endDate : null,
                });
            } else {
                await addRecord(record);
            }
            onClose();
        } catch (err) {
            console.error('Failed to save record:', err);
            setError(err instanceof Error ? err.message : '儲存失敗，請稍後再試');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet
            title={editingRecord ? '編輯交易' : '新交易'}
            onClose={onClose}
            action={{ label: saving ? '儲存中…' : '儲存', onClick: handleSubmit, disabled: saving }}
        >
            <div className="mt-2 mb-4">
                <Segmented<RecordType>
                    value={type}
                    onChange={setType}
                    options={[
                        { value: 'expense', label: '支出' },
                        { value: 'income', label: '收入' },
                        { value: 'transfer', label: '轉帳' },
                    ]}
                />
            </div>

            <Card className="p-4 mb-6">
                <div className={`flex items-center text-3xl font-bold ${type === 'expense' ? 'text-red-400' : type === 'income' ? 'text-emerald-400' : 'text-sky-400'}`}>
                    <span className="mr-1">{type === 'expense' ? '-' : type === 'income' ? '+' : ''}$</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0"
                        aria-label="金額"
                        className="bg-transparent outline-none w-full placeholder-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        autoFocus
                    />
                </div>
            </Card>

            {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}

            {type !== 'transfer' && (
                <>
                    <SectionTitle>分類</SectionTitle>
                    <div className="grid grid-cols-4 gap-2 mb-6">
                        {typeCategories.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setCategoryId(c.id)}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-colors ${categoryId === c.id ? 'bg-zinc-800 ring-1 ring-emerald-400' : 'bg-zinc-900'}`}
                            >
                                <IconTile icon={c.icon} color={c.color} size={36} />
                                <span className="text-xs text-zinc-300 truncate w-full text-center">{c.name}</span>
                            </button>
                        ))}
                        {typeCategories.length === 0 && (
                            <p className="col-span-4 text-sm text-zinc-500 px-1">尚無{type === 'income' ? '收入' : '支出'}分類，可到「設定 → 分類」新增。</p>
                        )}
                    </div>
                </>
            )}

            <SectionTitle>帳戶</SectionTitle>
            <Card className="p-2 mb-6">
                <FieldRow icon={<Wallet size={20} className="text-emerald-500" />} label={type === 'transfer' ? '轉出' : '帳戶'} last={type !== 'transfer'}>
                    <select value={accountId} onChange={e => setAccountId(e.target.value)} className={selectClass} aria-label="帳戶">
                        <option value="" className="bg-zinc-900">未指定</option>
                        {accounts.map(a => <option key={a.id} value={a.id} className="bg-zinc-900">{a.name}</option>)}
                    </select>
                </FieldRow>
                {type === 'transfer' && (
                    <FieldRow icon={<ArrowRight size={20} className="text-sky-400" />} label="轉入" last>
                        <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} className={selectClass} aria-label="轉入帳戶">
                            {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id} className="bg-zinc-900">{a.name}</option>)}
                        </select>
                    </FieldRow>
                )}
            </Card>

            <SectionTitle>日期與時間</SectionTitle>
            <Card className="p-2 mb-6">
                <FieldRow icon={<Calendar size={20} className="text-orange-500" />} label={repeat !== 'none' ? '開始日期' : '日期'}>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-white text-right outline-none" aria-label="日期" />
                </FieldRow>
                <FieldRow icon={<Clock size={20} className="text-purple-500" />} label="時間" last={!!editingRecord}>
                    <div className="flex items-center gap-3">
                        {isTimeEnabled && (
                            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-transparent text-white text-right outline-none" aria-label="時間" />
                        )}
                        <Toggle checked={isTimeEnabled} onChange={setIsTimeEnabled} label="記錄時間" />
                    </div>
                </FieldRow>
                {!editingRecord && (
                    <FieldRow icon={<Repeat size={20} className="text-pink-500" />} label="重複" last={repeat === 'none'}>
                        <div className="flex items-center gap-2">
                            {repeat !== 'none' && (
                                <>
                                    <span className="text-zinc-500 text-sm">每</span>
                                    <input
                                        type="number"
                                        min={1}
                                        value={repeatEvery}
                                        onChange={e => setRepeatEvery(Math.max(1, Number(e.target.value) || 1))}
                                        className="w-12 bg-zinc-800 text-white text-center rounded-lg py-1 outline-none"
                                        aria-label="間隔"
                                    />
                                </>
                            )}
                            <select value={repeat} onChange={e => setRepeat(e.target.value as RepeatChoice)} className="bg-transparent text-right text-white outline-none appearance-none" aria-label="重複頻率">
                                <option value="none" className="bg-zinc-900">不重複</option>
                                {(Object.keys(FREQUENCY_LABELS) as RepeatFrequency[]).map(f => (
                                    <option key={f} value={f} className="bg-zinc-900">
                                        {repeat !== 'none' ? { daily: '天', weekly: '週', monthly: '個月', yearly: '年' }[f] : FREQUENCY_LABELS[f]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </FieldRow>
                )}
                {!editingRecord && repeat !== 'none' && (
                    <FieldRow icon={<Flag size={20} className={hasEnd ? 'text-emerald-400' : 'text-zinc-500'} />} label="結束" last>
                        <div className="flex items-center gap-3">
                            {hasEnd && <input type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-right outline-none text-sm" aria-label="結束日期" />}
                            <Toggle checked={hasEnd} onChange={setHasEnd} label="設定結束日期" />
                        </div>
                    </FieldRow>
                )}
            </Card>
            {!editingRecord && repeat !== 'none' && (
                <p className="text-xs text-zinc-500 -mt-4 mb-6 px-1">從開始日期起，每到期一次就會自動新增一筆交易。可到「設定 → 定期交易」管理。</p>
            )}
            {editingRecord?.recurring_id && (
                <p className="text-xs text-zinc-500 -mt-4 mb-6 px-1">這筆交易由定期規則產生，修改只會影響這一筆。</p>
            )}

            <SectionTitle>其他</SectionTitle>
            <Card className="p-2 mb-6">
                <FieldRow icon={<Coins size={20} className="text-yellow-500" />} label="幣別">
                    <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectClass} aria-label="幣別">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code} className="bg-zinc-900">{c.code} {c.name}</option>)}
                    </select>
                </FieldRow>
                <FieldRow icon={<MapPin size={20} className="text-red-500" />} label="地點">
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="bg-transparent text-white text-right w-full outline-none placeholder-zinc-600" placeholder="輸入地點…" aria-label="地點" />
                </FieldRow>
                <div className="p-3">
                    <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full bg-transparent outline-none text-white resize-none h-20 placeholder-zinc-600" placeholder="輸入備註…" aria-label="備註" />
                </div>
            </Card>
        </Sheet>
    );
}
