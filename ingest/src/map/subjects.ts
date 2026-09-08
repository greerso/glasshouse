import type { ChampdsAgendaItem, ChampdsAttachment, ChampdsEvent } from '../champds/types.ts';
import { stripHtml } from './text.ts';

export type MappedSubject = {
    name: string;
    description: string;
    agendaItemIndex: number;
    attachments: ChampdsAttachment[];
};

function flatten(
    items: ChampdsAgendaItem[],
    parent: ChampdsAgendaItem | null,
): { item: ChampdsAgendaItem; parent: ChampdsAgendaItem | null }[] {
    const out: { item: ChampdsAgendaItem; parent: ChampdsAgendaItem | null }[] = [];
    for (const item of items) {
        out.push({ item, parent });
        if (item.Children?.length) out.push(...flatten(item.Children, item));
    }
    return out;
}

export function agendaItemIndex(item: ChampdsAgendaItem, parent: ChampdsAgendaItem | null): number {
    if (!parent) return item.OrderOrdinal;
    return parent.OrderOrdinal + 1 + Math.floor(item.OrderOrdinal / 10);
}

export function mapSubjects(event: ChampdsEvent): MappedSubject[] {
    const flat = flatten(event.Agenda?.AgendaItems ?? [], null);
    const used = new Set<number>();
    return flat.map(({ item, parent }) => {
        let index = agendaItemIndex(item, parent);
        while (used.has(index)) index += 1;
        used.add(index);
        const name =
            stripHtml(item.Title) ||
            stripHtml(item.Description ?? '') ||
            `Untitled item ${item.CustomerAgendaItemID}`;
        return {
            name,
            description: stripHtml(item.Description ?? ''),
            agendaItemIndex: index,
            attachments: item.Attachments ?? [],
        };
    });
}
