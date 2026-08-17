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
        },
        publicFilesBaseUrl: 'http://10.0.0.66:9000',
        s3Bucket: 'glasshouse',
    };
}

test('event 390 does not create a second meeting and does not flip released', async () => {
    const h = collect();
    const result = await ingestEvent({
        oc: h.oc,
        champds: h.champds,
        mirror: h.mirror,
        cityId: 'thompsons-station',
        publicFilesBaseUrl: h.publicFilesBaseUrl,
        s3Bucket: h.s3Bucket,
    }, { event: fixture, bodyId: 'thompsons-station-boma' });

    assert.equal(result.meetingId, 'aug11_2026');
    assert.equal(h.calls.filter((c) => c.op === 'createMeeting').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'release').length, 0);
    const subjectCall = h.calls.find((c) => c.op === 'upsertSubjects');
    assert.ok(subjectCall);
    assert.equal((subjectCall.payload as { meetingId: string }).meetingId, 'aug11_2026');
    assert.equal((subjectCall.payload as { subjects: unknown[] }).subjects.length, 17);
    assert.ok(h.calls.some((c) => c.op === 'obs' && (c.payload as { source: string }).source === 'champds:event:390'));
});

test('a second pass with the same content hash skips meeting and subject writes', async () => {
    const h = collect();
    const deps = {
        oc: h.oc,
        champds: h.champds,
        mirror: h.mirror,
        cityId: 'thompsons-station',
        publicFilesBaseUrl: h.publicFilesBaseUrl,
        s3Bucket: h.s3Bucket,
    };
    await ingestEvent(deps, { event: fixture, bodyId: 'thompsons-station-boma' });
    const afterFirst = h.calls.length;
    const second = await ingestEvent(deps, { event: fixture, bodyId: 'thompsons-station-boma' });
    assert.equal(second.action, 'skipped');
    assert.equal(h.calls.filter((c) => c.op === 'createMeeting').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'upsertSubjects').length, 1);
    assert.ok(h.calls.length >= afterFirst);
});

test('a new event POSTs champds-{id} unreleased, then releases after subjects', async () => {
    const h = collect();
    const event = structuredClone(fixture);
    event.Event.CustomerEventID = 387;
    await ingestEvent({
        oc: h.oc,
        champds: h.champds,
        mirror: h.mirror,
        cityId: 'thompsons-station',
        publicFilesBaseUrl: h.publicFilesBaseUrl,
        s3Bucket: h.s3Bucket,
    }, { event, bodyId: 'thompsons-station-boma' });

    const created = h.calls.find((c) => c.op === 'createMeeting');
    assert.ok(created);
    assert.equal((created.payload as { meetingId: string }).meetingId, 'champds-387');
    assert.equal(h.calls.some((c) => c.op === 'release' && c.payload === 'champds-387'), true);
});
