// Calendar dates are handled as local 'YYYY-MM-DD' strings so that a
// record entered at 07:00 in Taiwan is not shifted to the previous UTC day.

const pad = (n: number) => String(n).padStart(2, '0');

export const formatDate = (d: Date): string =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDate = (s: string): Date => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const todayString = (now: Date = new Date()): string => formatDate(now);

export const daysInMonth = (year: number, monthIndex: number): number =>
    new Date(year, monthIndex + 1, 0).getDate();

export const addDays = (s: string, days: number): string => {
    const d = parseDate(s);
    d.setDate(d.getDate() + days);
    return formatDate(d);
};

/** Adds whole months, clamping the day to the target month's last day. */
export const addMonthsClamped = (s: string, months: number, anchorDay?: number): string => {
    const d = parseDate(s);
    const day = anchorDay ?? d.getDate();
    const total = d.getMonth() + months;
    const year = d.getFullYear() + Math.floor(total / 12);
    const month = ((total % 12) + 12) % 12;
    return formatDate(new Date(year, month, Math.min(day, daysInMonth(year, month))));
};

export const daysBetweenInclusive = (start: string, end: string): number => {
    const ms = parseDate(end).getTime() - parseDate(start).getTime();
    return Math.max(Math.round(ms / 86_400_000) + 1, 1);
};

export const minDate = (a: string, b: string): string => (a <= b ? a : b);
