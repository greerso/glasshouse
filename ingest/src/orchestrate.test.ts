import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ingestEvent } from './orchestrate.ts';
import type { ChampdsEvent } from './champds/types.ts';

const fixture: ChampdsEvent = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../docs/research/champds/event-390.json'), 'utf8'),
);

function collect() {
    const calls: { op: string; payload?: unknown }[] = [];
    const observations = new Map<string, { source: string; contentHash: string; meetingId?: string }>();
    return {
        calls,
        oc: {
            async getObservations(source?: string) {
                const all = [...observations.values()];
                return source ? all.filter((o) => o.source === source) : all;
            },
            async upsertObservation(row: { source: string; contentHash: string; meetingId?: string }) {
                observations.set(row.source, row);
                calls.push({ op: 'obs', payload: row });
            },
            async createMeeting(payload: unknown) {
                calls.push({ op: 'createMeeting', payload });
                return { id: 'aug11_2026', released: true };
            },
            async putMeeting() { calls.push({ op: 'putMeeting' }); },
            async upsertSubjects(meetingId: string, subjects: unknown) {
                calls.push({ op: 'upsertSubjects', payload: { meetingId, subjects } });
                return [];
            },
            async releaseMeeting(meetingId: string) {
                calls.push({ op: 'release', payload: meetingId });
            },
            async listMeetings() { return []; },
            async getPeople() { return []; },
            async upsertVotes() { calls.push({ op: 'upsertVotes' }); },
        },
        champds: {
            async downloadPdf() { return new Uint8Array([1]); },
            async probeDirectMp4() { return null; },
            pdfUrl() { return 'https://play.champds.com/ATT/thompsonsstationtn/2026-08/x.pdf'; },
        },
        mirror: {
            async exists() { return false; },
            async putPdf({ key }: { key: string }) {
                return { key, url: `http://10.0.0.66:9000/glasshouse/${key}` };
            },
            async get() { return new Uint8Array([1]); },
        },
        publicFilesBaseUrl: 'http://10.0.0.66:9000',
        s3Bucket: 'glasshouse',
        applyMinutesPdf: async () => ({ action: 'skipped-no-votes' as const }),
    };
}

function depsOf(h: ReturnType<typeof collect>, extra: Record<string, unknown> = {}) {
    return {
        oc: h.oc,
        champds: h.champds,
        mirror: h.mirror,
        cityId: 'thompsons-station',
        publicFilesBaseUrl: h.publicFilesBaseUrl,
        s3Bucket: h.s3Bucket,
        applyMinutesPdf: h.applyMinutesPdf,
        ...extra,
    };
}

test('event 390 does not create a second meeting and does not flip released', async () => {
    const h = collect();
    const result = await ingestEvent(depsOf(h), { event: fixture, bodyId: 'thompsons-station-boma' });

    assert.equal(result.meetingId, 'aug11_2026');
    assert.equal(h.calls.filter((c) => c.op === 'createMeeting').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'release').length, 0);
    const subjectCall = h.calls.find((c) => c.op === 'upsertSubjects');
    assert.ok(subjectCall);
    assert.equal((subjectCall.payload as { meetingId: string }).meetingId, 'aug11_2026');
    assert.equal((subjectCall.payload as { subjects: unknown[] }).subjects.length, 17);
    assert.ok(h.calls.some((c) => c.op === 'obs' && (c.payload as { source: string }).source === 'champds:event:390'));
});

test('a second pass skips only after champds:votes observation exists', async () => {
    const h = collect();
    const deps = depsOf(h);
    await ingestEvent(deps, { event: fixture, bodyId: 'thompsons-station-boma' });
    const second = await ingestEvent(deps, { event: fixture, bodyId: 'thompsons-station-boma' });
    assert.notEqual(second.action, 'skipped');
    assert.equal(h.calls.filter((c) => c.op === 'upsertSubjects').length, 2);

    await h.oc.upsertObservation({ source: 'champds:votes:4672', contentHash: '1:abc', meetingId: 'aug11_2026' });
    const third = await ingestEvent(deps, { event: fixture, bodyId: 'thompsons-station-boma' });
    assert.equal(third.action, 'skipped');
    assert.equal(h.calls.filter((c) => c.op === 'createMeeting').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'upsertSubjects').length, 2);
});

test('event 390 minutes nickname triggers extract; Staff Report does not', async () => {
    const h = collect();
    const extracted: { mediaId: number; nickname: string }[] = [];
    await ingestEvent(depsOf(h, {
        applyMinutesPdf: async (_deps: unknown, input: { mediaId: number; nickname: string }) => {
            extracted.push({ mediaId: input.mediaId, nickname: input.nickname });
            return { action: 'applied', meetingId: 'champds-377', resultCount: 10 };
        },
    }), { event: fixture, bodyId: 'thompsons-station-boma' });

    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].mediaId, 4672);
    assert.match(decodeURIComponent(extracted[0].nickname), /BOMA Minutes 6_9_2026/i);
    assert.ok(!extracted.some((e) => /staff report/i.test(decodeURIComponent(e.nickname))));
});

test('extract errors do not fail ingestEvent', async () => {
    const h = collect();
    let called = false;
    const result = await ingestEvent(depsOf(h, {
        applyMinutesPdf: async () => {
            called = true;
            throw new Error('pdftotext failed');
        },
    }), { event: fixture, bodyId: 'thompsons-station-boma' });
    assert.equal(called, true);
    assert.equal(result.meetingId, 'aug11_2026');
    assert.ok(!h.calls.some((c) => c.op === 'obs' && String((c.payload as { source: string }).source).startsWith('champds:votes:')));
});

test('Minutes slot attachments are mirrored and extracted even without minute in the nickname', async () => {
    const h = collect();
    const extracted: { mediaId: number; fromMinutesSlot?: boolean }[] = [];
    const event = structuredClone(fixture);
    event.Minutes = {
        Attachments: [{
            CustomerMediaID: 8888,
            MediaFileName: 'approved.pdf',
            MediaFileLocation: '2026-08',
            MediaNickName: 'ApprovedPacket',
            SizeBytes: 12,
        }],
    };
    await ingestEvent(depsOf(h, {
        applyMinutesPdf: async (_deps: unknown, input: { mediaId: number; fromMinutesSlot?: boolean }) => {
            extracted.push({ mediaId: input.mediaId, fromMinutesSlot: input.fromMinutesSlot });
            return { action: 'skipped-no-votes' };
        },
    }), { event, bodyId: 'thompsons-station-boma' });

    assert.ok(extracted.some((e) => e.mediaId === 4672));
    const slot = extracted.find((e) => e.mediaId === 8888);
    assert.ok(slot);
    assert.equal(slot.fromMinutesSlot, true);
    assert.ok(h.calls.some((c) => c.op === 'obs' && (c.payload as { source: string }).source === 'champds:media:8888'));
});

test('agenda-less event creates and releases the meeting without POSTing subjects', async () => {
    const h = collect();
    const event = {
        Event: {
            CustomerEventID: 389,
            EventTitle: 'Annual State of the Town Address',
            EventDescription: '',
            EventDateTimeUTC: '2026-07-23 14:00:00',
        },
    } as ChampdsEvent;
    const result = await ingestEvent(depsOf(h), { event, bodyId: 'thompsons-station-special-events' });

    assert.equal(result.meetingId, 'champds-389');
    assert.equal(result.subjectCount, 0);
    assert.equal(h.calls.filter((c) => c.op === 'createMeeting').length, 1);
    assert.equal(h.calls.filter((c) => c.op === 'upsertSubjects').length, 0);
    assert.equal(h.calls.some((c) => c.op === 'release' && c.payload === 'champds-389'), true);
    assert.ok(h.calls.some((c) => c.op === 'obs' && (c.payload as { source: string }).source === 'champds:event:389'));
});

test('a new event POSTs champds-{id} unreleased, then releases after subjects', async () => {
    const h = collect();
    const event = structuredClone(fixture);
    event.Event.CustomerEventID = 387;
    await ingestEvent(depsOf(h), { event, bodyId: 'thompsons-station-boma' });

    const created = h.calls.find((c) => c.op === 'createMeeting');
    assert.ok(created);
    assert.equal((created.payload as { meetingId: string }).meetingId, 'champds-387');
    assert.equal(h.calls.some((c) => c.op === 'release' && c.payload === 'champds-387'), true);
});
