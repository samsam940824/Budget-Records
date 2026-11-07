import React, { useCallback, useEffect, useState } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import { NotificationEvent } from '../../types/database.types';
import { useData } from '../../data/DataContext';
import { eventDateTime, reasonLabel, sourceLabel } from '../../data/inbox';
import { Card, Sheet } from '../../components/ui';
import { formatCurrency } from '../../utils/helpers';
import ResolveSheet from './ResolveSheet';

function EventRow({ event, last, onClick }: { event: NotificationEvent; last: boolean; onClick: () => void }) {
    const { date, time } = eventDateTime(event);
    return (
        <button onClick={onClick} className={`w-full text-left p-4 flex items-center gap-3 hover:bg-zinc-800 transition-colors ${last ? '' : 'border-b border-zinc-800'}`}>
            <div className="bg-amber-500/20 text-amber-400 p-2 rounded-xl shrink-0"><Bell size={18} /></div>
            <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{event.merchant || sourceLabel(event.source)}</p>
                <p className="text-zinc-500 text-xs truncate">{date.slice(5)} {time} • {sourceLabel(event.source)}</p>
                <p className="text-amber-400 text-xs mt-0.5">{reasonLabel(event.review_reason)}</p>
            </div>
            <span className="text-white font-bold shrink-0">{event.amount === null ? '金額未知' : formatCurrency(Number(event.amount))}</span>
        </button>
    );
}

/** Notifications the notify endpoint could not file on its own. */
export default function InboxView({ onClose }: { onClose: () => void }) {
    const { pendingEvents, refreshInbox } = useData();
    const [selected, setSelected] = useState<NotificationEvent | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            await refreshInbox();
        } catch (err) {
            setError(err instanceof Error ? err.message : '重新整理失敗');
        } finally {
            setRefreshing(false);
        }
    }, [refreshInbox]);

    // Notifications arrive while the app is closed, so fetch on open.
    useEffect(() => { reload(); }, [reload]);

    return (
        <Sheet title="待確認" onClose={onClose}>
            <div className="flex justify-between items-center mb-3 px-1">
                <p className="text-zinc-400 text-sm">{pendingEvents.length > 0 ? `${pendingEvents.length} 筆通知需要你決定` : ''}</p>
                <button onClick={reload} disabled={refreshing} aria-label="重新整理" className="text-zinc-400 p-1 disabled:opacity-40">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>
            {error && <p className="text-red-400 text-sm mb-4 px-1" role="alert">{error}</p>}
            {pendingEvents.length === 0 ? (
                <div className="text-center text-zinc-500 mt-16">
                    <Bell size={40} className="mx-auto mb-3 opacity-40" />
                    <p>沒有待確認的通知</p>
                    <p className="text-xs mt-1">自動記帳判斷不出來的通知會出現在這裡</p>
                </div>
            ) : (
                <Card className="overflow-hidden">
                    {pendingEvents.map((e, i) => (
                        <EventRow key={e.id} event={e} last={i === pendingEvents.length - 1} onClick={() => setSelected(e)} />
                    ))}
                </Card>
            )}
            {selected && <ResolveSheet event={selected} onClose={() => setSelected(null)} />}
        </Sheet>
    );
}
