import React, { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { Category, CategoryType } from '../../types/database.types';
import { IconPicker, IconTile } from '../../components/AppIcon';
import { Card, ConfirmDialog, FieldRow, SectionTitle, Segmented, Sheet } from '../../components/ui';

function CategoryForm({ category, type, onClose }: { category: Category | null; type: CategoryType; onClose: () => void }) {
    const { categories, records, budgets, addCategory, updateCategory, deleteCategory } = useData();
    const [name, setName] = useState(category?.name ?? '');
    const [icon, setIcon] = useState(category?.icon ?? 'Tag');
    const [color, setColor] = useState(category?.color ?? '#3b82f6');
    const [kind, setKind] = useState<CategoryType>(category?.type ?? type);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const usage = category ? records.filter(r => r.category_id === category.id).length : 0;
    const budgetUsage = category ? budgets.filter(b => b.category_id === category.id).length : 0;

    const save = async () => {
        const trimmed = name.trim();
        if (!trimmed) { setError('請輸入分類名稱'); return; }
        if (categories.some(c => c.id !== category?.id && c.name.trim() === trimmed)) { setError('已有同名分類'); return; }
        setSaving(true);
        try {
            if (category) await updateCategory(category.id, { name: trimmed, icon, color, type: kind });
            else await addCategory({ name: trimmed, icon, color, type: kind, sort_order: categories.length + 1 });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '儲存失敗');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet title={category ? '編輯分類' : '新分類'} onClose={onClose} action={{ label: saving ? '儲存中…' : '儲存', onClick: save, disabled: saving }} zIndex={60}>
            <div className="flex flex-col items-center my-4"><IconTile icon={icon} color={color} size={72} /></div>
            {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}
            <div className="mb-4"><Segmented<CategoryType> value={kind} onChange={setKind} options={[{ value: 'expense', label: '支出' }, { value: 'income', label: '收入' }]} /></div>
            <Card className="p-2 mb-6">
                <FieldRow label="名稱" last>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="例如：早餐" className="bg-transparent text-white text-right w-full outline-none placeholder-zinc-600" aria-label="分類名稱" autoFocus={!category} />
                </FieldRow>
            </Card>
            <SectionTitle>外觀</SectionTitle>
            <Card className="p-4 mb-6"><IconPicker icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} /></Card>
            {category && (
                <button onClick={() => setConfirmDelete(true)} className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 font-medium flex items-center justify-center gap-2">
                    <Trash2 size={18} /> 刪除分類
                </button>
            )}
            {confirmDelete && category && (
                <ConfirmDialog
                    title={`刪除「${category.name}」？`}
                    message={usage + budgetUsage > 0 ? `${usage} 筆交易與 ${budgetUsage} 個預算會變成「未分類」。` : '此動作無法復原。'}
                    confirmLabel="刪除"
                    onCancel={() => setConfirmDelete(false)}
                    onConfirm={async () => {
                        setConfirmDelete(false);
                        try { await deleteCategory(category.id); onClose(); }
                        catch (err) { setError(err instanceof Error ? err.message : '刪除失敗'); }
                    }}
                />
            )}
        </Sheet>
    );
}

export default function CategoryManager({ onBack }: { onBack: () => void }) {
    const { categories, updateCategory } = useData();
    const [tab, setTab] = useState<CategoryType>('expense');
    const [editing, setEditing] = useState<Category | null | 'new'>(null);
    const list = categories.filter(c => (c.type ?? 'expense') === tab);

    const move = async (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= list.length) return;
        const reordered = [...list];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        // Income categories sort after expense categories in shared pickers.
        const base = tab === 'income' ? 100 : 0;
        await Promise.all(reordered
            .map((c, i) => ({ c, order: base + i + 1 }))
            .filter(({ c, order }) => c.sort_order !== order)
            .map(({ c, order }) => updateCategory(c.id, { sort_order: order })));
    };

    return (
        <div className="pb-28 animate-in fade-in duration-300 pt-20 px-4">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <button onClick={onBack} aria-label="返回" className="bg-zinc-800 p-2 rounded-full text-white"><ChevronRight className="rotate-180" size={24} /></button>
                    <h1 className="text-2xl font-bold text-white">分類</h1>
                </div>
                <button onClick={() => setEditing('new')} aria-label="新增分類" className="bg-zinc-800 p-2 rounded-full text-white"><Plus size={22} /></button>
            </div>
            <div className="mb-4"><Segmented<CategoryType> value={tab} onChange={setTab} options={[{ value: 'expense', label: '支出分類' }, { value: 'income', label: '收入分類' }]} /></div>
            <Card className="overflow-hidden">
                {list.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-3 p-3 ${i < list.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                        <div className="flex flex-col text-zinc-500">
                            <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`上移 ${c.name}`} className="disabled:opacity-20 leading-none">▲</button>
                            <button onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`下移 ${c.name}`} className="disabled:opacity-20 leading-none">▼</button>
                        </div>
                        <button onClick={() => setEditing(c)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                            <IconTile icon={c.icon} color={c.color} />
                            <span className="flex-1 text-white font-medium truncate">{c.name}</span>
                            <ChevronRight size={16} className="text-zinc-600" />
                        </button>
                    </div>
                ))}
                {list.length === 0 && <p className="text-center text-zinc-500 p-6">尚無分類</p>}
            </Card>
            {editing && <CategoryForm category={editing === 'new' ? null : editing} type={tab} onClose={() => setEditing(null)} />}
        </div>
    );
}
