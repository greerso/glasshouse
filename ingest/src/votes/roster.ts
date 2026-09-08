export const SEED_LAST_NAME_IDS: Readonly<Record<string, string>> = {
    Stover: 'thompsons-station-brian-stover',
    Alexander: 'thompsons-station-shaun-alexander',
    King: 'thompsons-station-harry-king',
    White: 'thompsons-station-kreis-white',
    Whitmer: 'thompsons-station-bob-whitmer',
};

export type RosterPerson = { lastName: string; personId: string };

export type PersonLike = {
    id: string;
    name?: string;
    name_en?: string;
    name_short?: string;
    roles?: { administrativeBodyId?: string | null }[];
};

export function lastNameFromPerson(person: PersonLike): string {
    const short = person.name_short?.trim();
    if (short && !/\s/.test(short)) return short;
    const full = (person.name_en || person.name || '').trim();
    const parts = full.split(/\s+/).filter(Boolean);
    return parts[parts.length - 1] ?? '';
}

export function rosterFromPeople(
    people: readonly PersonLike[],
    administrativeBodyId: string,
): RosterPerson[] {
    return people
        .filter((person) => (person.roles ?? []).some((role) => role.administrativeBodyId === administrativeBodyId))
        .map((person) => ({ lastName: lastNameFromPerson(person), personId: person.id }))
        .filter((row) => row.lastName.length > 0);
}

export function matchLastName(
    lastName: string,
    roster: Readonly<Record<string, string>> | readonly RosterPerson[],
): string | undefined {
    const needle = lastName.trim().toLowerCase();
    if (!needle) return undefined;
    if (Array.isArray(roster)) {
        const hits = roster.filter((p) => p.lastName.toLowerCase() === needle);
        return hits.length === 1 ? hits[0].personId : undefined;
    }
    const entries = Object.entries(roster).filter(([key]) => key.toLowerCase() === needle);
    if (entries.length !== 1) return undefined;
    return entries[0][1];
}
