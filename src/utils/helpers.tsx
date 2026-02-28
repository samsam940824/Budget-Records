import React from 'react';
import {
    Umbrella, Car, Train, ShoppingBag, Coffee, Wallet, Banknote, CreditCard
} from 'lucide-react';

export const IconMap: Record<string, React.ReactNode> = {
    Umbrella: <Umbrella size={24} />,
    Car: <Car size={24} />,
    Train: <Train size={24} />,
    ShoppingBag: <ShoppingBag size={24} />,
    Coffee: <Coffee size={24} />,
    Wallet: <Wallet size={24} />,
    Banknote: <Banknote size={24} />,
    CreditCard: <CreditCard size={24} />,
};

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

export const formatCurrency = (amount: number, currencyCode: string = 'TWD') => {
    const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};
