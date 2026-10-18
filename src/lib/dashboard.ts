import { DashboardWidget, DashboardWidgetId } from '../types/database.types';

export const WIDGET_LABELS: { [K in DashboardWidgetId]: string } = {
    summary: '收支摘要',
    accounts: '帳戶與淨資產',
    categories: '支出分類',
    trend: '支出趨勢',
    budgets: '預算進度',
    upcoming: '即將到來的定期交易',
    recent: '最近交易',
};

export const DEFAULT_WIDGETS: DashboardWidget[] = (Object.keys(WIDGET_LABELS) as DashboardWidgetId[])
    .map(id => ({ id, visible: true }));

/** Keeps the saved order, drops unknown ids and appends widgets added later. */
export function resolveWidgets(saved: DashboardWidget[] | null | undefined): DashboardWidget[] {
    if (!Array.isArray(saved)) return DEFAULT_WIDGETS;
    const known = new Set(Object.keys(WIDGET_LABELS));
    const seen = new Set<string>();
    const result: DashboardWidget[] = [];
    for (const w of saved) {
        if (w && known.has(w.id) && !seen.has(w.id)) {
            seen.add(w.id);
            result.push({ id: w.id, visible: w.visible !== false });
        }
    }
    for (const w of DEFAULT_WIDGETS) if (!seen.has(w.id)) result.push(w);
    return result;
}
