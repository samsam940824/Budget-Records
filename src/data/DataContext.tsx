import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import {
    Budget, Category, PaymentMethod, Record, RecurringTransaction, UserSettings,
} from '../types/database.types';
import { RecordsService, NewRecord } from './records';
import { OptionsService, NewCategory, NewAccount } from './options';
import { BudgetsService } from './budgets';
import { SettingsService } from './settings';
import { RecurringService, NewRecurring } from './recurring';
import { dueOccurrences } from '../lib/recurring';
import { todayString } from '../lib/dates';
import { ImportRow } from '../lib/csv';

export type NewBudget = Omit<Budget, 'id' | 'user_id'>;
export type NewRule = Omit<NewRecurring, 'next_date' | 'active'>;

export interface ImportSummary {
    inserted: number;
    createdCategories: string[];
    createdAccounts: string[];
}

interface DataContextValue {
    user: User;
    loading: boolean;
    error: string | null;
    records: Record[];
    categories: Category[];
    paymentMethods: PaymentMethod[];
    budgets: Budget[];
    settings: UserSettings | null;
    recurring: RecurringTransaction[];
    refresh: () => Promise<void>;

    addRecord: (record: NewRecord) => Promise<void>;
    updateRecord: (id: string, patch: Partial<Record>) => Promise<void>;
    deleteRecord: (id: string) => Promise<void>;
    importRecords: (rows: ImportRow[]) => Promise<ImportSummary>;

    addCategory: (c: NewCategory) => Promise<Category>;
    updateCategory: (id: string, patch: Partial<Category>) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;

    addAccount: (a: NewAccount) => Promise<PaymentMethod>;
    updateAccount: (id: string, patch: Partial<PaymentMethod>) => Promise<void>;
    deleteAccount: (id: string) => Promise<void>;

    addBudget: (b: NewBudget) => Promise<void>;
    updateBudget: (id: string, patch: Partial<Budget>) => Promise<void>;
    deleteBudget: (id: string) => Promise<void>;

    updateSettings: (patch: Partial<UserSettings>) => Promise<void>;

    addRecurring: (rule: NewRule) => Promise<void>;
    updateRecurring: (id: string, patch: Partial<RecurringTransaction>) => Promise<void>;
    deleteRecurring: (id: string, deleteGenerated: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const message = (err: unknown) =>
    err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '發生未知錯誤';

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

const byDateDesc = (a: Record, b: Record) =>
    a.date === b.date ? (b.time ?? '').localeCompare(a.time ?? '') : b.date.localeCompare(a.date);

export function DataProvider({ user, children }: { user: User; children: React.ReactNode }) {
    const userId = user.id;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [records, setRecords] = useState<Record[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);

    const recordsRef = useRef(records);
    recordsRef.current = records;
    const processing = useRef(false);

    /** Creates any recurring occurrences that are due and advances each rule. */
    const processRecurring = useCallback(async (rules: RecurringTransaction[]) => {
        if (processing.current) return;
        processing.current = true;
        try {
            const today = todayString();
            const created: Record[] = [];
            const updatedRules: RecurringTransaction[] = [];
            for (const rule of rules) {
                if (!rule.active || rule.next_date > today) continue;
                const due = dueOccurrences(rule, today);
                const rows: NewRecord[] = due.dates.map(date => ({
                    type: rule.type,
                    amount: Number(rule.amount),
                    category_id: rule.type === 'transfer' ? null : rule.category_id,
                    payment_method_id: rule.payment_method_id,
                    to_payment_method_id: rule.type === 'transfer' ? rule.to_payment_method_id : null,
                    description: rule.description ?? '',
                    location: rule.location ?? '',
                    currency_code: rule.currency_code,
                    date,
                    time: null,
                    recurring_id: rule.id,
                }));
                created.push(...await RecordsService.addRecurringOccurrences(userId, rows));
                if (due.nextDate !== rule.next_date || due.finished) {
                    updatedRules.push(await RecurringService.updateRule(userId, rule.id, {
                        next_date: due.nextDate,
                        active: !due.finished,
                    }));
                }
            }
            if (created.length > 0) {
                setRecords(prev => {
                    const ids = new Set(prev.map(r => r.id));
                    return [...prev, ...created.filter(r => !ids.has(r.id))].sort(byDateDesc);
                });
            }
            if (updatedRules.length > 0) {
                setRecurring(prev => prev.map(r => updatedRules.find(u => u.id === r.id) ?? r));
            }
        } catch (err) {
            console.error('Error generating recurring transactions:', err);
            setError(`定期交易產生失敗：${message(err)}`);
        } finally {
            processing.current = false;
        }
    }, [userId]);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const recs = await RecordsService.getRecords(userId);
            await OptionsService.initializeDefaultsIfMissing(userId, recs.some(r => r.type === 'income'));
            const [cats, pays, buds, sets, rules] = await Promise.all([
                OptionsService.getCategories(userId),
                OptionsService.getPaymentMethods(userId),
                BudgetsService.getBudgets(userId),
                SettingsService.getOrCreateSettings(userId),
                RecurringService.getRules(userId),
            ]);
            setRecords(recs);
            setCategories(cats);
            setPaymentMethods(pays);
            setBudgets(buds);
            setSettings(sets);
            setRecurring(rules);
            setError(null);
            await processRecurring(rules);
        } catch (err) {
            console.error('Error loading data:', err);
            setError(message(err));
        } finally {
            setLoading(false);
        }
    }, [userId, processRecurring]);

    useEffect(() => { refresh(); }, [refresh]);

    // A tab left open overnight catches up on recurring entries when it is shown again.
    const recurringRef = useRef(recurring);
    recurringRef.current = recurring;
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') processRecurring(recurringRef.current);
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [processRecurring]);

    // ---------- Records (optimistic) ----------

    const addRecord = useCallback(async (record: NewRecord) => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setRecords(prev => [{ ...record, id: tempId, user_id: userId }, ...prev].sort(byDateDesc));
        try {
            const saved = await RecordsService.addRecord(userId, record);
            setRecords(prev => prev.map(r => (r.id === tempId ? saved : r)));
        } catch (err) {
            setRecords(prev => prev.filter(r => r.id !== tempId));
            throw err;
        }
    }, [userId]);

    const updateRecord = useCallback(async (id: string, patch: Partial<Record>) => {
        const previous = recordsRef.current;
        setRecords(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)).sort(byDateDesc));
        try {
            const saved = await RecordsService.updateRecord(userId, id, patch);
            setRecords(prev => prev.map(r => (r.id === id ? saved : r)));
        } catch (err) {
            setRecords(previous);
            throw err;
        }
    }, [userId]);

    const deleteRecord = useCallback(async (id: string) => {
        const previous = recordsRef.current;
        setRecords(prev => prev.filter(r => r.id !== id));
        try {
            await RecordsService.deleteRecord(userId, id);
        } catch (err) {
            setRecords(previous);
            throw err;
        }
    }, [userId]);

    // ---------- Categories ----------

    const addCategory = useCallback(async (c: NewCategory) => {
        const saved = await OptionsService.addCategory(userId, c);
        setCategories(prev => [...prev, saved].sort(bySortOrder));
        return saved;
    }, [userId]);

    const updateCategory = useCallback(async (id: string, patch: Partial<Category>) => {
        const saved = await OptionsService.updateCategory(userId, id, patch);
        setCategories(prev => prev.map(c => (c.id === id ? saved : c)).sort(bySortOrder));
    }, [userId]);

    const deleteCategory = useCallback(async (id: string) => {
        await OptionsService.deleteCategory(userId, id);
        setCategories(prev => prev.filter(c => c.id !== id));
        // The database sets category_id to NULL on related rows.
        setRecords(prev => prev.map(r => (r.category_id === id ? { ...r, category_id: null } : r)));
        setBudgets(prev => prev.map(b => (b.category_id === id ? { ...b, category_id: null } : b)));
    }, [userId]);

    // ---------- Accounts ----------

    const addAccount = useCallback(async (a: NewAccount) => {
        const saved = await OptionsService.addPaymentMethod(userId, a);
        setPaymentMethods(prev => [...prev, saved].sort(bySortOrder));
        return saved;
    }, [userId]);

    const updateAccount = useCallback(async (id: string, patch: Partial<PaymentMethod>) => {
        const saved = await OptionsService.updatePaymentMethod(userId, id, patch);
        setPaymentMethods(prev => prev.map(p => (p.id === id ? saved : p)).sort(bySortOrder));
    }, [userId]);

    const deleteAccount = useCallback(async (id: string) => {
        await OptionsService.deletePaymentMethod(userId, id);
        setPaymentMethods(prev => prev.filter(p => p.id !== id));
        setRecords(prev => prev.map(r => ({
            ...r,
            payment_method_id: r.payment_method_id === id ? null : r.payment_method_id,
            to_payment_method_id: r.to_payment_method_id === id ? null : r.to_payment_method_id,
        })));
    }, [userId]);

    // ---------- Budgets ----------

    const addBudget = useCallback(async (b: NewBudget) => {
        const saved = await BudgetsService.addBudget(userId, b);
        setBudgets(prev => [saved, ...prev]);
    }, [userId]);

    const updateBudget = useCallback(async (id: string, patch: Partial<Budget>) => {
        const saved = await BudgetsService.updateBudget(userId, id, patch);
        setBudgets(prev => prev.map(b => (b.id === id ? saved : b)));
    }, [userId]);

    const deleteBudget = useCallback(async (id: string) => {
        await BudgetsService.deleteBudget(userId, id);
        setBudgets(prev => prev.filter(b => b.id !== id));
    }, [userId]);

    // ---------- Settings ----------

    const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
        setSettings(prev => (prev ? { ...prev, ...patch } : prev));
        const saved = await SettingsService.updateSettings(userId, patch);
        setSettings(saved);
    }, [userId]);

    // ---------- Recurring ----------

    const addRecurring = useCallback(async (rule: NewRule) => {
        const saved = await RecurringService.addRule(userId, { ...rule, next_date: rule.start_date, active: true });
        setRecurring(prev => [...prev, saved]);
        await processRecurring([saved]);
    }, [userId, processRecurring]);

    const updateRecurring = useCallback(async (id: string, patch: Partial<RecurringTransaction>) => {
        const saved = await RecurringService.updateRule(userId, id, patch);
        setRecurring(prev => prev.map(r => (r.id === id ? saved : r)));
        if (saved.active) await processRecurring([saved]);
    }, [userId, processRecurring]);

    const deleteRecurring = useCallback(async (id: string, deleteGenerated: boolean) => {
        if (deleteGenerated) await RecordsService.deleteRecordsByRecurring(userId, id);
        await RecurringService.deleteRule(userId, id);
        setRecurring(prev => prev.filter(r => r.id !== id));
        setRecords(prev => deleteGenerated
            ? prev.filter(r => r.recurring_id !== id)
            : prev.map(r => (r.recurring_id === id ? { ...r, recurring_id: null } : r)));
    }, [userId]);

    // ---------- CSV import ----------

    const importRecords = useCallback(async (rows: ImportRow[]): Promise<ImportSummary> => {
        const catByName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c]));
        const accByName = new Map(paymentMethods.map(a => [a.name.trim().toLowerCase(), a]));
        const createdCategories: string[] = [];
        const createdAccounts: string[] = [];

        const ensureCategory = async (name: string, type: 'expense' | 'income') => {
            if (!name) return null;
            const key = name.toLowerCase();
            const found = catByName.get(key);
            if (found) return found.id;
            const saved = await OptionsService.addCategory(userId, {
                name, icon: 'Tag', color: '#a1a1aa', sort_order: catByName.size + 1, type,
            });
            catByName.set(key, saved);
            createdCategories.push(name);
            return saved.id;
        };
        const ensureAccount = async (name: string) => {
            if (!name) return null;
            const key = name.toLowerCase();
            const found = accByName.get(key);
            if (found) return found.id;
            const saved = await OptionsService.addPaymentMethod(userId, {
                name, icon: 'Wallet', color: '#3b82f6', sort_order: accByName.size + 1,
                initial_balance: 0, currency_code: settings?.default_currency || 'TWD',
                include_in_total: true, archived: false,
            });
            accByName.set(key, saved);
            createdAccounts.push(name);
            return saved.id;
        };

        const toInsert: NewRecord[] = [];
        for (const row of rows) {
            toInsert.push({
                type: row.type,
                amount: row.amount,
                category_id: row.type === 'transfer' ? null : await ensureCategory(row.categoryName, row.type),
                payment_method_id: await ensureAccount(row.accountName),
                to_payment_method_id: row.type === 'transfer' ? await ensureAccount(row.toAccountName) : null,
                description: row.description,
                location: row.location,
                currency_code: row.currency || settings?.default_currency || 'TWD',
                date: row.date,
                time: row.time,
            });
        }
        const saved = await RecordsService.addRecords(userId, toInsert);
        await refresh();
        return { inserted: saved.length, createdCategories, createdAccounts };
    }, [categories, paymentMethods, settings, userId, refresh]);

    const value = useMemo<DataContextValue>(() => ({
        user, loading, error, records, categories, paymentMethods, budgets, settings, recurring, refresh,
        addRecord, updateRecord, deleteRecord, importRecords,
        addCategory, updateCategory, deleteCategory,
        addAccount, updateAccount, deleteAccount,
        addBudget, updateBudget, deleteBudget,
        updateSettings,
        addRecurring, updateRecurring, deleteRecurring,
    }), [
        user, loading, error, records, categories, paymentMethods, budgets, settings, recurring, refresh,
        addRecord, updateRecord, deleteRecord, importRecords,
        addCategory, updateCategory, deleteCategory,
        addAccount, updateAccount, deleteAccount,
        addBudget, updateBudget, deleteBudget,
        updateSettings,
        addRecurring, updateRecurring, deleteRecurring,
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useData must be used inside <DataProvider>');
    return ctx;
}
