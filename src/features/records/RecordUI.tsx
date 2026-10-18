import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Record as DbRecord } from '../../types/database.types';
import RecordForm from './RecordForm';
import RecordDetail from './RecordDetail';

interface RecordUI {
    openNew: (defaultAccountId?: string) => void;
    openDetail: (record: DbRecord) => void;
}

const Ctx = createContext<RecordUI | null>(null);

/** Hosts the add/edit form and the detail view so any screen can open them. */
export function RecordUIProvider({ children }: { children: React.ReactNode }) {
    const [form, setForm] = useState<{ editing: DbRecord | null; accountId?: string } | null>(null);
    const [detail, setDetail] = useState<DbRecord | null>(null);

    const openNew = useCallback((accountId?: string) => setForm({ editing: null, accountId }), []);
    const openDetail = useCallback((record: DbRecord) => setDetail(record), []);
    const value = useMemo(() => ({ openNew, openDetail }), [openNew, openDetail]);

    return (
        <Ctx.Provider value={value}>
            {children}
            {detail && (
                <RecordDetail
                    record={detail}
                    onClose={() => setDetail(null)}
                    onEdit={r => { setDetail(null); setForm({ editing: r }); }}
                />
            )}
            {form && (
                <RecordForm
                    key={form.editing?.id ?? 'new'}
                    editingRecord={form.editing}
                    defaultAccountId={form.accountId}
                    onClose={() => setForm(null)}
                />
            )}
        </Ctx.Provider>
    );
}

export function useRecordUI(): RecordUI {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useRecordUI must be used inside <RecordUIProvider>');
    return ctx;
}
