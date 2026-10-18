import React, { useEffect } from 'react';
import { Delete } from 'lucide-react';

export const PASSCODE_LENGTH = 4;

/** Four dots and a numeric keypad. Calls onComplete when all digits are entered. */
export default function PasscodePad({
    title, subtitle, value, onChange, onComplete, error,
}: {
    title: string;
    subtitle?: string;
    value: string;
    onChange: (v: string) => void;
    onComplete: (v: string) => void;
    error?: string | null;
}) {
    const press = (digit: string) => {
        if (value.length >= PASSCODE_LENGTH) return;
        const next = value + digit;
        onChange(next);
        if (next.length === PASSCODE_LENGTH) onComplete(next);
    };
    const back = () => onChange(value.slice(0, -1));

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (/^\d$/.test(e.key)) press(e.key);
            else if (e.key === 'Backspace') back();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    return (
        <div className="flex flex-col items-center">
            <h2 className="text-white text-xl font-bold mb-2">{title}</h2>
            <p className={`text-sm mb-8 h-5 ${error ? 'text-red-400' : 'text-zinc-400'}`} role={error ? 'alert' : undefined}>{error || subtitle}</p>
            <div className={`flex gap-4 mb-10 ${error ? 'animate-pulse' : ''}`} aria-label={`已輸入 ${value.length} 位`}>
                {Array.from({ length: PASSCODE_LENGTH }, (_, i) => (
                    <span key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${i < value.length ? 'bg-white border-white' : 'border-zinc-500'}`} />
                ))}
            </div>
            <div className="grid grid-cols-3 gap-5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                    <button key={d} onClick={() => press(d)} className="w-[72px] h-[72px] rounded-full bg-zinc-800 text-white text-2xl font-medium active:bg-zinc-600">{d}</button>
                ))}
                <span />
                <button onClick={() => press('0')} className="w-[72px] h-[72px] rounded-full bg-zinc-800 text-white text-2xl font-medium active:bg-zinc-600">0</button>
                <button onClick={back} aria-label="刪除" className="w-[72px] h-[72px] rounded-full text-zinc-300 flex items-center justify-center"><Delete size={26} /></button>
            </div>
        </div>
    );
}
