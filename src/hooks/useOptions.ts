import { useState, useEffect, useRef } from 'react';
import { OptionsService } from '../data/options';
import { Category, PaymentMethod } from '../types/database.types';
import { useAuth } from './useAuth';

export function useOptions() {
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);

    const hasInitialized = useRef(false);

    const fetchOptions = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Ensure defaults exist only once per component lifecycle to prevent strict-mode double-inserts
            if (!hasInitialized.current) {
                hasInitialized.current = true;
                await OptionsService.initializeDefaultsIfMissing(user.id);
            }

            const [cats, pays] = await Promise.all([
                OptionsService.getCategories(user.id),
                OptionsService.getPaymentMethods(user.id)
            ]);
            setCategories(cats);
            setPaymentMethods(pays);
        } catch (error) {
            console.error('Error fetching options:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOptions();
    }, [user]);

    const addCategory = async (category: Omit<Category, 'id' | 'user_id'>) => {
        if (!user) return null;
        try {
            const data = await OptionsService.addCategory(user.id, category);
            if (data) {
                setCategories(prev => [...prev, data]);
                return data;
            }
        } catch (error) {
            console.error('Error adding category:', error);
        }
        return null;
    };

    const updateCategory = async (id: string, category: Partial<Category>) => {
        if (!user) return null;
        try {
            const data = await OptionsService.updateCategory(user.id, id, category);
            if (data) {
                setCategories(prev => prev.map(c => c.id === id ? data : c));
                return data;
            }
        } catch (error) {
            console.error('Error updating category:', error);
        }
        return null;
    };

    const deleteCategory = async (id: string) => {
        if (!user) return false;
        try {
            await OptionsService.deleteCategory(user.id, id);
            setCategories(prev => prev.filter(c => c.id !== id));
            return true;
        } catch (error) {
            console.error('Error deleting category:', error);
        }
        return false;
    };

    const addPaymentMethod = async (paymentMethod: Omit<PaymentMethod, 'id' | 'user_id'>) => {
        if (!user) return null;
        try {
            const data = await OptionsService.addPaymentMethod(user.id, paymentMethod);
            if (data) {
                setPaymentMethods(prev => [...prev, data]);
                return data;
            }
        } catch (error) {
            console.error('Error adding payment method:', error);
        }
        return null;
    };

    const deletePaymentMethod = async (id: string) => {
        if (!user) return false;
        try {
            await OptionsService.deletePaymentMethod(user.id, id);
            setPaymentMethods(prev => prev.filter(p => p.id !== id));
            return true;
        } catch (error) {
            console.error('Error deleting payment method:', error);
        }
        return false;
    };

    return {
        categories,
        paymentMethods,
        loading,
        refreshOptions: fetchOptions,
        addCategory,
        updateCategory,
        deleteCategory,
        addPaymentMethod,
        deletePaymentMethod
    };
}
