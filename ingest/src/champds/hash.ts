import { createHash } from 'node:crypto';
import type { ChampdsAgendaItem, ChampdsEvent, ChampdsListEvent } from './types.ts';

function flatten(items: ChampdsAgendaItem[], parentId: number | null = null): unknown[] {
    const out: unknown[] = [];
    for (const item of items) {
        out.push({
            id: item.CustomerAgendaItemID,
            parentId,
            title: item.Title,
            description: item.Description,
            order: item.OrderOrdinal,
            attachments: (item.Attachments ?? []).map((a) => ({
                id: a.CustomerMediaID,
                file: a.MediaFileName,
                loc: a.MediaFileLocation,
                size: a.SizeBytes,
            })),
        });
        if (item.Children?.length) {
            out.push(...flatten(item.Children, item.CustomerAgendaItemID));
        }
    }
    return out;
}

export function hashEventDetail(event: ChampdsEvent): string {
    const canonical = {
        id: event.Event.CustomerEventID,
        title: event.Event.EventTitle,
        description: event.Event.EventDescription,
        dateTimeUtc: event.Event.EventDateTimeUTC,
        mediaPath: event.MediaInfo?.MediaPath ?? null,
        items: flatten(event.Agenda?.AgendaItems ?? []),
        minutes: (event.Minutes?.Attachments ?? []).map((a) => a.CustomerMediaID),
    };
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function hashEventListRow(row: ChampdsListEvent): string {
    return createHash('sha256').update(JSON.stringify({
        id: row.CustomerEventID,
        title: row.EventTitle,
        description: row.EventDescription,
        dateTimeUtc: row.EventDateTimeUTC,
        mediaPath: row.MediaInfo?.MediaPath ?? null,
    })).digest('hex');
}
