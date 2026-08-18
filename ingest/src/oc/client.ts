import type { ListedMeetingWithSubjects, MinutesVotesBody } from '../votes/apply.ts';
import { rosterFromPeople, type RosterPerson } from '../votes/roster.ts';

export type OcClient = {
    getObservations(source?: string): Promise<{ source: string; contentHash: string; meetingId?: string | null }[]>;
    upsertObservation(row: { source: string; contentHash: string; meetingId?: string }): Promise<void>;
    createMeeting(payload: Record<string, unknown>): Promise<{ id: string; released: boolean }>;
    putMeeting(meetingId: string, payload: Record<string, unknown>): Promise<void>;
    upsertSubjects(meetingId: string, subjects: unknown[]): Promise<{ id: string; name?: string }[]>;
    releaseMeeting(meetingId: string): Promise<void>;
    listMeetings(from: string, to: string): Promise<ListedMeetingWithSubjects[]>;
    getPeople(administrativeBodyId: string): Promise<RosterPerson[]>;
    upsertVotes(meetingId: string, body: MinutesVotesBody): Promise<unknown>;
    getMeeting(meetingId: string): Promise<ListedMeetingWithSubjects | null>;
};

export function createOcClient(cfg: {
    ocBaseUrl: string;
    ocApiKey: string;
    cityId: string;
    fetchImpl?: typeof fetch;
}): OcClient {
    const base = `${cfg.ocBaseUrl.replace(/\/$/, '')}/api/cities/${cfg.cityId}`;
    const fetchImpl = cfg.fetchImpl ?? fetch;
    async function req(path: string, init: RequestInit = {}) {
        const res = await fetchImpl(`${base}${path}`, {
            ...init,
            headers: {
                authorization: `Bearer ${cfg.ocApiKey}`,
                'content-type': 'application/json',
                ...(init.headers ?? {}),
            },
        });
        return res;
    }

    return {
        async getObservations(source) {
            const q = source ? `?source=${encodeURIComponent(source)}` : '';
            const res = await req(`/observations${q}`);
            if (!res.ok) throw new Error(`GET observations ${res.status}`);
            return res.json();
        },
        async upsertObservation(row) {
            const res = await req('/observations', { method: 'POST', body: JSON.stringify(row) });
            if (!res.ok) throw new Error(`POST observation ${res.status}`);
        },
        async createMeeting(payload) {
            const res = await req('/meetings', { method: 'POST', body: JSON.stringify(payload) });
            if (res.status === 409) return { id: String(payload.meetingId), released: false };
            if (!res.ok) throw new Error(`POST meeting ${res.status} ${await res.text()}`);
            return res.json();
        },
        async putMeeting(meetingId, payload) {
            const res = await req(`/meetings/${meetingId}`, { method: 'PUT', body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(`PUT meeting ${res.status}`);
        },
        async upsertSubjects(meetingId, subjects) {
            const res = await req(`/meetings/${meetingId}/subjects`, {
                method: 'POST',
                body: JSON.stringify({ subjects }),
            });
            if (!res.ok) throw new Error(`POST subjects ${res.status} ${await res.text()}`);
            const body = await res.json() as { subjects: { id: string; name?: string }[] };
            return body.subjects;
        },
        async releaseMeeting(meetingId) {
            const res = await req(`/meetings/${meetingId}/release`, {
                method: 'POST',
                body: JSON.stringify({ released: true }),
            });
            if (!res.ok) throw new Error(`POST release ${res.status}`);
        },
        async listMeetings(from, to) {
            const q = new URLSearchParams({
                from,
                to,
                limit: '100',
                includeUnreleased: 'true',
            });
            const res = await req(`/meetings?${q}`);
            if (!res.ok) throw new Error(`GET meetings ${res.status}`);
            const rows = await res.json() as ListedMeetingWithSubjects[];
            return rows.map((row) => ({
                id: row.id,
                name: row.name,
                dateTime: row.dateTime,
                administrativeBodyId: row.administrativeBodyId,
                subjects: (row.subjects ?? []).map((subject) => ({ id: subject.id, name: subject.name })),
            }));
        },
        async getPeople(administrativeBodyId) {
            const res = await req('/people');
            if (!res.ok) throw new Error(`GET people ${res.status}`);
            return rosterFromPeople(await res.json() as Parameters<typeof rosterFromPeople>[0], administrativeBodyId);
        },
        async upsertVotes(meetingId, body) {
            const res = await req(`/meetings/${meetingId}/votes`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`POST votes ${res.status} ${await res.text()}`);
            return res.json();
        },
        async getMeeting(meetingId) {
            const res = await req(`/meetings/${meetingId}`);
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`GET meeting ${res.status}`);
            const data = await res.json() as {
                id?: string;
                name?: string;
                dateTime?: string | Date;
                administrativeBodyId?: string | null;
                meeting?: ListedMeetingWithSubjects;
                subjects?: { id: string; name: string }[];
            };
            const meeting = data.meeting ?? data;
            if (!meeting.id || !meeting.name || meeting.dateTime === undefined) return null;
            return {
                id: meeting.id,
                name: meeting.name,
                dateTime: meeting.dateTime,
                administrativeBodyId: meeting.administrativeBodyId ?? null,
                subjects: (data.subjects ?? meeting.subjects ?? []).map((subject) => ({
                    id: subject.id,
                    name: subject.name,
                })),
            };
        },
    };
}
