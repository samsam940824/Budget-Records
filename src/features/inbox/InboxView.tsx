import React, { useCallback, useEffect, useState } from 'react';
import { Bell, EyeOff, RefreshCw } from 'lucide-react';
import { NotificationEvent } from '../../types/database.types';
import { useData } from '../../data/DataContext';
import { eventDateTime, reasonLabel, sourceLabel } from '../../data/inbox';
import { Card, Sheet } from '../../components/ui';
import { formatCurrency } from '../../utils/helpers';
import ResolveSheet from './ResolveSheet';

/** An armed ignore button reverts to the bell if not tapped within this time. */
const IGNORE_ARM_MS = 4000;
const IGNORE_BUTTON_ATTR = 'data-ignore-button';

interface EventRowProps {
    event: NotificationEvent;
    last: boolean;
    armed: boolean;
    busy: boolean;
    onOpen: () => void;
    onArm: () => void;
    onIgnore: () => void;
}

/** Tapping the bell turns it into an ignore button; a second tap ignores without opening the event. */
function EventRow({ event, last, armed, busy, onOpen, onArm, onIgnore }: EventRowProps) {
    const { date, time } = eventDateTime(event);
    return (
        <div className={`flex items-center hover:bg-zinc-800 transition-colors ${last ? '' : 'border-b border-zinc-800'}`}>
            {armed ? (
                <button {...{ [IGNORE_BUTTON_ATTR]: '' }} onClick={onIgnore} disabled={busy} aria-label="忽略這則通知"
                    className="ml-4 shrink-0 bg-red-500/20 text-red-400 text-sm font-medium px-2 py-2 rounded-xl flex items-center gap-1 disabled:opacity-40">
                    <EyeOff size={16} /> 忽略
                </button>
            ) : (
                <button onClick={onArm} aria-label="顯示忽略按鈕" className="ml-4 shrink-0 bg-amber-500/20 text-amber-400 p-2 rounded-xl">
                    <Bell size={18} />
                </button>
            )}
            <button onClick={onOpen} className="flex-1 min-w-0 text-left py-4 pl-3 pr-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{event.merchant || sourceLabel(event.source)}</p>
                    <p className="text-zinc-500 text-xs truncate">{date.slice(5)} {time} • {sourceLabel(event.source)}</p>
                    <p className="text-amber-400 text-xs mt-0.5">{reasonLabel(event.review_reason)}</p>
                </div>
                <span className="text-white font-bold shrink-0">{event.amount === null ? '金額未知' : formatCurrency(Number(event.amount))}</span>
            </button>
        </div>
    );
}

/** Notifications the notify endpoint could not file on its own. */
export default function InboxView({ onClose }: { onClose: () => void }) {
    const { pendingEvents, refreshInbox, ignoreEvent } = useData();
    const [selected, setSelected] = useState<NotificationEvent | null>(null);
    const [armedId, setArmedId] = useState<string | null>(null);
    const [ignoring, setIgnoring] = useState(false);
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

    // An armed ignore button cancels on any tap elsewhere, or after a pause.
    useEffect(() => {
        if (armedId === null) return;
        const cancel = (e: PointerEvent) => {
            if (!(e.target instanceof Element) || !e.target.closest(`[${IGNORE_BUTTON_ATTR}]`)) setArmedId(null);
        };
        const timer = window.setTimeout(() => setArmedId(null), IGNORE_ARM_MS);
        document.addEventListener('pointerdown', cancel, true);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('pointerdown', cancel, true);
        };
    }, [armedId]);

    const ignore = async (event: NotificationEvent) => {
        setIgnoring(true);
        setError(null);
        try {
            await ignoreEvent(event);
            setArmedId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : '忽略失敗');
        } finally {
            setIgnoring(false);
        }
    };

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
                        <EventRow key={e.id} event={e} last={i === pendingEvents.length - 1} armed={armedId === e.id} busy={ignoring}
                            onOpen={() => setSelected(e)} onArm={() => setArmedId(e.id)} onIgnore={() => ignore(e)} />
                    ))}
                </Card>
            )}
            {selected && <ResolveSheet event={selected} onClose={() => setSelected(null)} />}
        </Sheet>
    );
}
