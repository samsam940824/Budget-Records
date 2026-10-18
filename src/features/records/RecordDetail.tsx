import React, { useState } from 'react';
import { Calendar, LayoutGrid, MapPin, MoreHorizontal, Edit2, Trash2, Wallet, ArrowRight, Repeat, X } from 'lucide-react';
import { Record as DbRecord } from '../../types/database.types';
import { useData } from '../../data/DataContext';
import { amountColor, formatDateHeader, formatSigned } from '../../utils/helpers';
import { ConfirmDialog } from '../../components/ui';
import { buildLookup } from './RecordRow';
import { describeSchedule } from '../../lib/recurring';

export default function RecordDetail({ record, onClose, onEdit }: { record: DbRecord; onClose: () => void; onEdit: (r: DbRecord) => void }) {
    const { categories, paymentMethods, recurring, deleteRecord } = useData();
    const lookup = buildLookup(categories, paymentMethods);
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cat = record.category_id ? lookup.categoryById.get(record.category_id) : undefined;
    const from = record.payment_method_id ? lookup.accountById.get(record.payment_method_id) : undefined;
    const to = record.to_payment_method_id ? lookup.accountById.get(record.to_payment_method_id) : undefined;
    const rule = record.recurring_id ? recurring.find(r => r.id === record.recurring_id) : undefined;

    const rows: { icon: React.ReactNode; tint: string; label: string; value: string }[] = [
        ...(record.type === 'transfer'
            ? [
                { icon: <Wallet size={20} />, tint: 'bg-emerald-500/20 text-emerald-500', label: '轉出帳戶', value: from?.name ?? '未指定' },
                { icon: <ArrowRight size={20} />, tint: 'bg-sky-500/20 text-sky-400', label: '轉入帳戶', value: to?.name ?? '未指定' },
            ]
            : [
                { icon: <LayoutGrid size={20} />, tint: 'bg-blue-500/20 text-blue-500', label: '分類', value: cat?.name ?? '未分類' },
                { icon: <Wallet size={20} />, tint: 'bg-emerald-500/20 text-emerald-500', label: '帳戶', value: from?.name ?? '未指定' },
            ]),
        { icon: <Calendar size={20} />, tint: 'bg-orange-500/20 text-orange-500', label: '日期', value: `${formatDateHeader(record.date)}${record.time ? ` ${record.time.slice(0, 5)}` : ''}` },
        { icon: <MapPin size={20} />, tint: 'bg-red-500/20 text-red-500', label: '地點', value: record.location || '未設定' },
        ...(record.recurring_id
            ? [{ icon: <Repeat size={20} />, tint: 'bg-pink-500/20 text-pink-500', label: '定期交易', value: rule ? describeSchedule(rule) : '規則已刪除' }]
            : []),
    ];

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom-10 max-w-md mx-auto" role="dialog" aria-label="交易詳情">
            <div className="flex justify-between items-center px-4 pt-8 pb-4">
                <button onClick={onClose} aria-label="關閉" className="bg-zinc-800 text-zinc-300 p-2 rounded-full"><X size={20} /></button>
                <h2 className="text-lg font-bold text-white">交易詳情</h2>
                <div className="relative">
                    <button onClick={() => setMenuOpen(o => !o)} aria-label="更多動作" className="bg-zinc-800 text-zinc-300 p-2 rounded-full"><MoreHorizontal size={20} /></button>
                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                                <button onClick={() => { setMenuOpen(false); onEdit(record); }} className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 flex items-center"><Edit2 size={16} className="mr-2" /> 編輯</button>
                                <button onClick={() => { setMenuOpen(false); setConfirm(true); }} className="w-full text-left px-4 py-3 text-red-400 hover:bg-zinc-700 flex items-center"><Trash2 size={16} className="mr-2" /> 刪除</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className="p-6 flex flex-col items-center overflow-y-auto">
                <div className={`${amountColor(record.type)} text-5xl font-bold mb-2 text-center break-all`}>
                    {formatSigned(record.amount, record.type, record.currency_code)}
                </div>
                <div className="text-zinc-400 mb-8 text-center whitespace-pre-wrap">{record.description || '無備註'}</div>
                {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
                <div className="w-full bg-zinc-900 rounded-3xl overflow-hidden">
                    {rows.map((row, i) => (
                        <div key={row.label} className={`flex items-center p-4 ${i < rows.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                            <div className={`${row.tint} p-2 rounded-xl mr-4`}>{row.icon}</div>
                            <div><p className="text-zinc-500 text-xs">{row.label}</p><p className="text-white font-medium">{row.value}</p></div>
                        </div>
                    ))}
                </div>
            </div>
            {confirm && (
                <ConfirmDialog
                    title="確定要刪除這筆交易嗎？"
                    message={record.recurring_id ? '只會刪除這一筆，定期規則不受影響。' : '此動作無法復原。'}
                    confirmLabel="刪除交易"
                    onCancel={() => setConfirm(false)}
                    onConfirm={async () => {
                        setConfirm(false);
                        try {
                            await deleteRecord(record.id);
                            onClose();
                        } catch (err) {
                            setError(err instanceof Error ? err.message : '刪除失敗');
                        }
                    }}
                />
            )}
        </div>
    );
}
