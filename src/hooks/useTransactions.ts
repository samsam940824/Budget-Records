import { useState, useEffect } from 'react';
import { RecordsService } from '../data/records';
import { Record } from '../types/database.types';
import { useAuth } from './useAuth';

export function useTransactions() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Record[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTransactions = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await RecordsService.getRecords(user.id);
            setTransactions(data);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [user]);

    const addTransaction = async (record: Omit<Record, 'id' | 'user_id'>) => {
        if (!user) return;
        await RecordsService.addRecord(user.id, record);
        await fetchTransactions();
    };

    const updateTransaction = async (id: string, record: Partial<Record>) => {
        if (!user) return;
        await RecordsService.updateRecord(user.id, id, record);
        await fetchTransactions();
    };

    const deleteTransaction = async (id: string) => {
        if (!user) return;
        await RecordsService.deleteRecord(user.id, id);
        await fetchTransactions();
    };

    return {
        transactions,
        loading,
        refresh: fetchTransactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
    };
}
