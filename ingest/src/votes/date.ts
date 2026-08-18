const TZ = 'America/Chicago';

const MONTHS: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    sept: 9,
    oct: 10,
    nov: 11,
    dec: 12,
};

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number): string | null {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function dateFromMinutesLabel(label: string): string | null {
    const hits: { index: number; value: string }[] = [];

    for (const m of label.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
        const value = ymd(Number(m[1]), Number(m[2]), Number(m[3]));
        if (value && m.index !== undefined) hits.push({ index: m.index, value });
    }

    for (const m of label.matchAll(/\b(\d{1,2})[_/-](\d{1,2})[_/-](20\d{2})\b/g)) {
        const value = ymd(Number(m[3]), Number(m[1]), Number(m[2]));
        if (value && m.index !== undefined) hits.push({ index: m.index, value });
    }

    for (const m of label.matchAll(
        /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/gi,
    )) {
        const month = MONTHS[m[1].toLowerCase()];
        const value = month ? ymd(Number(m[3]), month, Number(m[2])) : null;
        if (value && m.index !== undefined) hits.push({ index: m.index, value });
    }

    hits.sort((a, b) => a.index - b.index);
    return hits[0]?.value ?? null;
}

function chicagoParts(utcMs: number): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
} {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });
    const map: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(utcMs))) {
        if (part.type !== 'literal') map[part.type] = part.value;
    }
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute),
        second: Number(map.second),
    };
}

function chicagoOffsetMs(utcMs: number): number {
    const p = chicagoParts(utcMs);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

function chicagoMidnightUtc(date: string): number {
    const [year, month, day] = date.split('-').map(Number);
    const asUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
    let utc = asUtc - chicagoOffsetMs(asUtc);
    utc = asUtc - chicagoOffsetMs(utc);
    return utc;
}

export function chicagoDayBoundsIso(date: string): { from: string; to: string } {
    const [year, month, day] = date.split('-').map(Number);
    const start = chicagoMidnightUtc(date);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    const nextYmd = `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
    const end = chicagoMidnightUtc(nextYmd) - 1;
    return {
        from: new Date(start).toISOString(),
        to: new Date(end).toISOString(),
    };
}
