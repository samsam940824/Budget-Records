import { useState, useEffect, useCallback } from 'react';
import { RecordsService } from '../data/records';
import { Record } from '../types/database.types';
import { useAuth } from './useAuth';

export function useTransactions() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Record[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTransactions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await RecordsService.getRecords(user.id);
            setTransactions(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching transactions:', err);
            setError(err instanceof Error ? err.message : '載入交易失敗');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    // Optimistic add: insert a temporary record immediately, then reconcile with server response.
    const addTransaction = async (record: Omit<Record, 'id' | 'user_id'>) => {
        if (!user) return;
        const tempId = `temp-${Date.now()}`;
        const optimistic: Record = { ...record, id: tempId, user_id: user.id } as Record;
        setTransactions(prev => [optimistic, ...prev]);
        try {
            const saved = await RecordsService.addRecord(user.id, record);
            setTransactions(prev => prev.map(t => (t.id === tempId ? (saved as Record) : t)));
        } catch (err) {
            setTransactions(prev => prev.filter(t => t.id !== tempId));
            throw err;
        }
    };

    const updateTransaction = async (id: string, record: Partial<Record>) => {
        if (!user) return;
        const previous = transactions;
        setTransactions(prev => prev.map(t => (t.id === id ? { ...t, ...record } : t)));
        try {
            await RecordsService.updateRecord(user.id, id, record);
        } catch (err) {
            setTransactions(previous);
            throw err;
        }
    };

    const deleteTransaction = async (id: string) => {
        if (!user) return;
        const previous = transactions;
        setTransactions(prev => prev.filter(t => t.id !== id));
        try {
            await RecordsService.deleteRecord(user.id, id);
        } catch (err) {
            setTransactions(previous);
            throw err;
        }
    };

    return {
        transactions,
        loading,
        error,
        refresh: fetchTransactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
    };
}
