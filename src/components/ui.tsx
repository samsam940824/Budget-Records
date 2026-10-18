import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/** Full-screen sheet with a close button, a title and an optional primary action. */
export function Sheet({
    title, onClose, action, children, zIndex = 50,
}: {
    title: string;
    onClose: () => void;
    action?: { label: string; onClick: () => void; disabled?: boolean };
    children: React.ReactNode;
    zIndex?: number;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black flex flex-col animate-in slide-in-from-bottom-10 max-w-md mx-auto" style={{ zIndex }} role="dialog" aria-label={title}>
            <div className="flex justify-between items-center px-4 pt-8 pb-4 shrink-0">
                <button onClick={onClose} aria-label="關閉" className="bg-zinc-800 text-zinc-300 p-2 rounded-full">
                    <X size={20} />
                </button>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {action ? (
                    <button
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className="bg-emerald-500 text-black px-4 py-1.5 rounded-full font-bold text-sm transition-opacity disabled:opacity-40"
                    >
                        {action.label}
                    </button>
                ) : <div className="w-9" />}
            </div>
            <div className="px-4 flex-1 overflow-y-auto pb-10">{children}</div>
        </div>
    );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${checked ? 'bg-emerald-400' : 'bg-zinc-700'}`}
        >
            <span className={`toggle-knob absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-7' : 'left-1'}`} />
        </button>
    );
}

export function Segmented<T extends string>({
    value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
    return (
        <div className="flex p-1 bg-zinc-800 rounded-2xl">
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-xl transition-colors ${value === o.value ? 'segment-active bg-zinc-600 text-white' : 'text-zinc-400'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`bg-zinc-900 rounded-3xl ${className}`}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-white font-bold">{children}</h3>
            {right}
        </div>
    );
}

/** One labelled line inside a Card, separated from the next by a hairline. */
export function FieldRow({ icon, label, children, last }: { icon?: React.ReactNode; label: string; children?: React.ReactNode; last?: boolean }) {
    return (
        <div className={`flex items-center justify-between gap-3 p-3 min-h-[52px] ${last ? '' : 'border-b border-zinc-800'}`}>
            <span className="text-white font-medium flex items-center gap-3 shrink-0">{icon}{label}</span>
            <div className="flex items-center justify-end min-w-0 flex-1">{children}</div>
        </div>
    );
}

export function ConfirmDialog({
    title, message, confirmLabel, onConfirm, onCancel, danger = true,
}: {
    title: string;
    message?: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    danger?: boolean;
}) {
    return (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-6 animate-in fade-in" role="alertdialog" aria-label={title}>
            <div className="bg-zinc-900 rounded-3xl w-full max-w-xs p-6 text-center">
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                {message && <p className="text-zinc-400 text-sm mb-6">{message}</p>}
                <div className="flex space-x-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-medium">取消</button>
                    <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-bold ${danger ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'}`}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

export const selectClass = 'bg-transparent text-right text-white outline-none appearance-none max-w-[60%] truncate';
