import type { ChampdsEvent } from '../champds/types.ts';
import { stripHtml } from './text.ts';

export const EXISTING_MEETING_IDS: Record<number, string> = {
    390: 'aug11_2026',
};

export function meetingIdForEvent(eventId: number): string {
    return EXISTING_MEETING_IDS[eventId] ?? `champds-${eventId}`;
}

export function mapMeeting(event: ChampdsEvent, bodyId: string) {
    const name = stripHtml(event.Event.EventTitle);
    return {
        name,
        name_en: name,
        date: new Date(event.Event.EventDateTimeUTC.replace(' ', 'T') + 'Z').toISOString(),
        meetingId: meetingIdForEvent(event.Event.CustomerEventID),
        administrativeBodyId: bodyId,
        processAgenda: false as const,
    };
}
