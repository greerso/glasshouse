import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { mapMeeting, meetingIdForEvent, EXISTING_MEETING_IDS } from './meeting.ts';
import type { ChampdsEvent } from '../champds/types.ts';

const fixture: ChampdsEvent = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/champds/event-390.json'), 'utf8'),
);

test('event 390 reuses the already-ingested meeting id', () => {
    assert.equal(EXISTING_MEETING_IDS[390], 'aug11_2026');
    assert.equal(meetingIdForEvent(390), 'aug11_2026');
    assert.equal(meetingIdForEvent(387), 'champds-387');
});

test('mapMeeting uses EventDateTimeUTC as a Zulu instant and does not invent a YouTube url', () => {
    const payload = mapMeeting(fixture, 'thompsons-station-boma');
    assert.equal(payload.meetingId, 'aug11_2026');
    assert.equal(payload.date, '2026-08-11T23:00:00.000Z');
    assert.equal(payload.administrativeBodyId, 'thompsons-station-boma');
    assert.equal(payload.processAgenda, false);
    assert.equal(payload.name, payload.name_en);
    assert.ok(payload.name.includes('Board of Mayor'));
    assert.equal('youtubeUrl' in payload && payload.youtubeUrl, false);
});
