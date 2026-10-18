export const CURRENCIES = [
    { code: 'TWD', name: '新台幣', symbol: 'NT$' },
    { code: 'USD', name: '美元', symbol: '$' },
    { code: 'EUR', name: '歐元', symbol: '€' },
    { code: 'JPY', name: '日圓', symbol: '¥' },
    { code: 'GBP', name: '英鎊', symbol: '£' },
    { code: 'CNY', name: '人民幣', symbol: '¥' },
    { code: 'KRW', name: '韓元', symbol: '₩' },
    { code: 'HKD', name: '港幣', symbol: 'HK$' },
    { code: 'AUD', name: '澳幣', symbol: 'A$' },
    { code: 'CAD', name: '加幣', symbol: 'C$' },
    { code: 'SGD', name: '新加坡幣', symbol: 'S$' },
];

const formatters = new Map<string, Intl.NumberFormat>();

/** Whole units by default; cents are shown only when the amount has them. */
export const formatCurrency = (amount: number, currencyCode: string = 'TWD') => {
    const value = Number(amount) || 0;
    const hasCents = Math.round(value * 100) % 100 !== 0;
    const key = `${currencyCode}:${hasCents}`;
    let f = formatters.get(key);
    if (!f) {
        try {
            f = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: hasCents ? 2 : 0,
                maximumFractionDigits: hasCents ? 2 : 0,
            });
        } catch {
            f = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        }
        formatters.set(key, f);
    }
    return f.format(value);
};

export const formatSigned = (amount: number, type: 'expense' | 'income' | 'transfer', currencyCode?: string) =>
    `${type === 'expense' ? '-' : type === 'income' ? '+' : ''}${formatCurrency(amount, currencyCode)}`;

export const amountColor = (type: 'expense' | 'income' | 'transfer') =>
    type === 'expense' ? 'text-red-400' : type === 'income' ? 'text-emerald-400' : 'text-sky-400';

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

export const formatDateHeader = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${y}年${m}月${d}日 ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
};

export const formatShortDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-').map(Number);
    return `${m}/${d}`;
};
