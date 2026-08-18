export const SEED_LAST_NAME_IDS: Readonly<Record<string, string>> = {
    Stover: 'thompsons-station-brian-stover',
    Alexander: 'thompsons-station-shaun-alexander',
    King: 'thompsons-station-harry-king',
    White: 'thompsons-station-kreis-white',
    Whitmer: 'thompsons-station-bob-whitmer',
};

export type RosterPerson = { lastName: string; personId: string };

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
