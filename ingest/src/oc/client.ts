export type OcClient = {
    getObservations(source?: string): Promise<{ source: string; contentHash: string; meetingId?: string | null }[]>;
    upsertObservation(row: { source: string; contentHash: string; meetingId?: string }): Promise<void>;
    createMeeting(payload: Record<string, unknown>): Promise<{ id: string; released: boolean }>;
    putMeeting(meetingId: string, payload: Record<string, unknown>): Promise<void>;
    upsertSubjects(meetingId: string, subjects: unknown[]): Promise<unknown[]>;
    releaseMeeting(meetingId: string): Promise<void>;
};

export function createOcClient(cfg: { ocBaseUrl: string; ocApiKey: string; cityId: string }): OcClient {
    const base = `${cfg.ocBaseUrl.replace(/\/$/, '')}/api/cities/${cfg.cityId}`;
    async function req(path: string, init: RequestInit = {}) {
        const res = await fetch(`${base}${path}`, {
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
            const body = await res.json() as { subjects: unknown[] };
            return body.subjects;
        },
        async releaseMeeting(meetingId) {
            const res = await req(`/meetings/${meetingId}/release`, {
                method: 'POST',
                body: JSON.stringify({ released: true }),
            });
            if (!res.ok) throw new Error(`POST release ${res.status}`);
        },
    };
}
