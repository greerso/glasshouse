import { chicagoDayBoundsIso, dateFromMinutesLabel } from './date.ts';

export type ListedMeeting = {
    id: string;
    name: string;
    dateTime: string | Date;
    administrativeBodyId: string | null;
};

export type ResolveMinutesMeetingInput = {
    nickname: string;
    pdfText: string;
    sourceMeetingId: string;
    administrativeBodyId: string;
    meetings: readonly ListedMeeting[];
    fromMinutesSlot?: boolean;
};

export type ResolveMinutesMeetingResult =
    | { meetingId: string }
    | { skip: 'meeting-not-ingested' };

export function minutesDocumentedDate(nickname: string, pdfText: string): string | null {
    return dateFromMinutesLabel(nickname) ?? dateFromMinutesLabel(pdfText.slice(0, 800));
}

export function minutesDayBounds(nickname: string, pdfText: string): { from: string; to: string } | null {
    const date = minutesDocumentedDate(nickname, pdfText);
    return date ? chicagoDayBoundsIso(date) : null;
}

function meetingTimeMs(meeting: ListedMeeting): number {
    return new Date(meeting.dateTime).getTime();
}

function isWorkSession(name: string): boolean {
    return /work\s*session/i.test(name);
}

function isRegular(name: string): boolean {
    return /regular/i.test(name) && !isWorkSession(name);
}

export function resolveMinutesMeeting(input: ResolveMinutesMeetingInput): ResolveMinutesMeetingResult {
    const bounds = minutesDayBounds(input.nickname, input.pdfText);
    if (!bounds) {
        if (input.fromMinutesSlot) return { meetingId: input.sourceMeetingId };
        return { skip: 'meeting-not-ingested' };
    }

    const from = Date.parse(bounds.from);
    const to = Date.parse(bounds.to);
    const inDay = input.meetings.filter((meeting) => {
        if (meeting.administrativeBodyId !== input.administrativeBodyId) return false;
        const t = meetingTimeMs(meeting);
        return t >= from && t <= to;
    });

    if (inDay.length === 0) return { skip: 'meeting-not-ingested' };
    if (inDay.length === 1) return { meetingId: inDay[0].id };

    const regulars = inDay.filter((meeting) => isRegular(meeting.name));
    if (regulars.length === 1) return { meetingId: regulars[0].id };
    return { skip: 'meeting-not-ingested' };
}
