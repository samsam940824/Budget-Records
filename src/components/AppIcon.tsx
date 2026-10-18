import React from 'react';
import {
    Utensils, Coffee, Pizza, Beer, ShoppingCart, ShoppingBag, Shirt, Gift, Gem,
    Car, Bus, Train, Bike, Plane, Fuel, Home, Building2, Umbrella, Wrench, Zap,
    Droplet, Wifi, Smartphone, HeartPulse, Stethoscope, Pill, Dumbbell,
    GraduationCap, BookOpen, Baby, PawPrint, Gamepad2, Film, Music, Scissors,
    Briefcase, Wallet, Banknote, CreditCard, PiggyBank, Landmark, Coins,
    HandCoins, TrendingUp, Receipt, Tag, ArrowLeftRight, LucideIcon,
} from 'lucide-react';

export const ICONS: { [name: string]: LucideIcon } = {
    Utensils, Coffee, Pizza, Beer, ShoppingCart, ShoppingBag, Shirt, Gift, Gem,
    Car, Bus, Train, Bike, Plane, Fuel, Home, Building2, Umbrella, Wrench, Zap,
    Droplet, Wifi, Smartphone, HeartPulse, Stethoscope, Pill, Dumbbell,
    GraduationCap, BookOpen, Baby, PawPrint, Gamepad2, Film, Music, Scissors,
    Briefcase, Wallet, Banknote, CreditCard, PiggyBank, Landmark, Coins,
    HandCoins, TrendingUp, Receipt, Tag, ArrowLeftRight,
};

export const COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#10b981',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
    '#f43f5e', '#a1a1aa',
];

/** Renders a lucide icon by name, or the stored text itself when it is an emoji. */
export function AppIcon({ icon, size = 20, className }: { icon?: string | null; size?: number; className?: string }) {
    const Lucide = icon ? ICONS[icon] : undefined;
    if (Lucide) return <Lucide size={size} className={className} />;
    if (icon && icon.trim()) {
        return <span className={className} style={{ fontSize: size * 0.95, lineHeight: 1 }} aria-hidden>{icon}</span>;
    }
    return <Wallet size={size} className={className} />;
}

/** Rounded tile used for categories and accounts: tinted background, coloured glyph. */
export function IconTile({ icon, color, size = 40, iconSize }: { icon?: string | null; color?: string | null; size?: number; iconSize?: number }) {
    const c = color || '#a1a1aa';
    return (
        <div
            className="rounded-xl flex items-center justify-center shrink-0"
            style={{ width: size, height: size, backgroundColor: `${c}26`, color: c }}
        >
            <AppIcon icon={icon} size={iconSize ?? Math.round(size * 0.5)} />
        </div>
    );
}

export function IconPicker({
    icon, color, onIconChange, onColorChange,
}: {
    icon: string;
    color: string;
    onIconChange: (icon: string) => void;
    onColorChange: (color: string) => void;
}) {
    const isEmoji = !!icon && !ICONS[icon];
    return (
        <div className="space-y-4">
            <div>
                <p className="text-xs text-zinc-500 mb-2 px-1">顏色</p>
                <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            type="button"
                            aria-label={`顏色 ${c}`}
                            onClick={() => onColorChange(c)}
                            className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110' : ''}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <label className="w-8 h-8 rounded-full overflow-hidden border border-zinc-700 cursor-pointer relative" aria-label="自訂顏色">
                        <input type="color" value={color} onChange={e => onColorChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <span className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">＋</span>
                    </label>
                </div>
            </div>
            <div>
                <p className="text-xs text-zinc-500 mb-2 px-1">圖示</p>
                <div className="grid grid-cols-8 gap-2">
                    {Object.keys(ICONS).map(name => (
                        <button
                            key={name}
                            type="button"
                            aria-label={name}
                            onClick={() => onIconChange(name)}
                            className={`aspect-square rounded-xl flex items-center justify-center transition-colors ${icon === name ? 'bg-zinc-700' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                            style={{ color: icon === name ? color : undefined }}
                        >
                            <AppIcon icon={name} size={18} className={icon === name ? '' : 'text-zinc-400'} />
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <p className="text-xs text-zinc-500 mb-2 px-1">或使用表情符號</p>
                <input
                    type="text"
                    value={isEmoji ? icon : ''}
                    onChange={e => {
                        const chars = Array.from(e.target.value.trim());
                        if (chars.length > 0) onIconChange(chars.slice(-2).join(''));
                    }}
                    placeholder="例如 🍜 🚇 🎁"
                    className="w-full bg-zinc-800 text-white p-3 rounded-xl outline-none placeholder-zinc-600"
                />
            </div>
        </div>
    );
}
