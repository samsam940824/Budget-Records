import React, { useRef, useState } from 'react';
import { ChevronRight, Download, Upload, FileText } from 'lucide-react';
import { useData, ImportSummary } from '../../data/DataContext';
import { ImportPreview, previewImport, recordsToCsv } from '../../lib/csv';
import { todayString } from '../../lib/dates';
import { Card } from '../../components/ui';
import { formatCurrency } from '../../utils/helpers';

function download(filename: string, text: string) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ImportExport({ onBack }: { onBack: () => void }) {
    const { records, categories, paymentMethods, importRecords } = useData();
    const fileRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<(ImportPreview & { fileName: string }) | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onFile = async (file: File) => {
        setResult(null);
        setError(null);
        try {
            setPreview({ ...previewImport(await file.text()), fileName: file.name });
        } catch (err) {
            setError(err instanceof Error ? err.message : '無法讀取檔案');
        }
    };

    const runImport = async () => {
        if (!preview || preview.rows.length === 0) return;
        setImporting(true);
        setError(null);
        try {
            setResult(await importRecords(preview.rows));
            setPreview(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : '匯入失敗');
        } finally {
            setImporting(false);
        }
    };

    const previewTotal = preview?.rows.reduce((s, r) => s + (r.type === 'expense' ? -r.amount : r.type === 'income' ? r.amount : 0), 0) ?? 0;

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex items-center space-x-3 mb-6">
                <button onClick={onBack} aria-label="返回" className="bg-zinc-800 p-2 rounded-full text-white"><ChevronRight className="rotate-180" size={24} /></button>
                <h1 className="text-2xl font-bold text-white">匯入與匯出</h1>
            </div>

            <h2 className="text-zinc-400 font-bold ml-2 mb-3">匯出</h2>
            <Card className="p-4 mb-8">
                <p className="text-zinc-400 text-sm mb-4">把全部 {records.length} 筆交易匯出成 CSV，可用 Excel、Numbers 或 Google 試算表開啟，也能再匯入回來。</p>
                <button
                    onClick={() => download(`budget-records-${todayString()}.csv`, recordsToCsv(records, categories, paymentMethods))}
                    disabled={records.length === 0}
                    className="w-full py-3 rounded-2xl bg-emerald-500 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    <Download size={18} /> 下載 CSV
                </button>
            </Card>

            <h2 className="text-zinc-400 font-bold ml-2 mb-3">匯入</h2>
            <Card className="p-4 mb-4">
                <p className="text-zinc-400 text-sm mb-2">CSV 第一列需要欄位名稱，至少要有日期與金額：</p>
                <ul className="text-zinc-500 text-xs space-y-1 mb-4 list-disc pl-5">
                    <li>必要：date／日期、amount／金額</li>
                    <li>選用：type／類型（支出、收入、轉帳）、category／分類、account／帳戶、to_account／轉入帳戶、description／備註、time／時間、currency／幣別、location／地點</li>
                    <li>沒有類型欄時，負數金額視為支出、正數視為收入。</li>
                    <li>找不到的分類與帳戶會自動建立。</li>
                </ul>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
                <button onClick={() => fileRef.current?.click()} className="w-full py-3 rounded-2xl bg-zinc-800 text-white font-medium flex items-center justify-center gap-2">
                    <Upload size={18} /> 選擇 CSV 檔案
                </button>
            </Card>

            {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}

            {preview && (
                <Card className="p-4 mb-4 space-y-3">
                    <p className="text-white font-medium flex items-center gap-2"><FileText size={18} /> {preview.fileName}</p>
                    {preview.missingColumns.length > 0 ? (
                        <p className="text-red-400 text-sm">找不到必要欄位：{preview.missingColumns.map(c => (c === 'date' ? '日期' : '金額')).join('、')}</p>
                    ) : (
                        <>
                            <p className="text-zinc-300 text-sm">可匯入 {preview.rows.length} 筆，收支合計 {formatCurrency(previewTotal)}。</p>
                            {preview.errors.length > 0 && (
                                <div className="text-sm">
                                    <p className="text-amber-400 mb-1">{preview.errors.length} 列會被略過：</p>
                                    <ul className="text-zinc-500 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                                        {preview.errors.slice(0, 50).map(e => <li key={e.line}>第 {e.line} 列：{e.message}</li>)}
                                    </ul>
                                </div>
                            )}
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setPreview(null)} className="flex-1 py-3 rounded-xl bg-zinc-800 text-white">取消</button>
                                <button onClick={runImport} disabled={importing || preview.rows.length === 0} className="flex-1 py-3 rounded-xl bg-emerald-500 text-black font-bold disabled:opacity-40">
                                    {importing ? '匯入中…' : `匯入 ${preview.rows.length} 筆`}
                                </button>
                            </div>
                        </>
                    )}
                </Card>
            )}

            {result && (
                <Card className="p-4 text-sm space-y-1" >
                    <p className="text-emerald-400 font-medium" role="status">已匯入 {result.inserted} 筆交易。</p>
                    {result.createdCategories.length > 0 && <p className="text-zinc-400">新增分類：{result.createdCategories.join('、')}</p>}
                    {result.createdAccounts.length > 0 && <p className="text-zinc-400">新增帳戶：{result.createdAccounts.join('、')}</p>}
                </Card>
            )}
        </div>
    );
}
