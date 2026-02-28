import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { BudgetsService } from '../data/budgets';
import { Budget } from '../types/database.types';

export function useBudgets() {
    const { user } = useAuth();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBudgets = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await BudgetsService.getAll(user.id);
            setBudgets(data);
        } catch (error) {
            console.error('Error fetching budgets:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchBudgets();
    }, [fetchBudgets]);

    const addBudget = async (budget: Omit<Budget, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
        if (!user) return null;
        try {
            const data = await BudgetsService.create(user.id, budget);
            if (data) {
                setBudgets(prev => [data, ...prev]);
                return data;
            }
        } catch (error) {
            console.error('Error adding budget:', error);
        }
        return null;
    };

    const updateBudget = async (id: string, updates: Partial<Budget>) => {
        if (!user) return null;
        try {
            const data = await BudgetsService.update(id, user.id, updates);
            if (data) {
                setBudgets(prev => prev.map(b => (b.id === id ? data : b)));
                return data;
            }
        } catch (error) {
            console.error('Error updating budget:', error);
        }
        return null;
    };

    const deleteBudget = async (id: string) => {
        if (!user) return false;
        try {
            const success = await BudgetsService.delete(id, user.id);
            if (success) {
                setBudgets(prev => prev.filter(b => b.id !== id));
                return true;
            }
        } catch (error) {
            console.error('Error deleting budget:', error);
        }
        return false;
    };

    return {
        budgets,
        loading,
        addBudget,
        updateBudget,
        deleteBudget,
        refreshBudgets: fetchBudgets
    };
}
