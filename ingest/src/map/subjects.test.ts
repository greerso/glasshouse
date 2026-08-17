import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { mapSubjects } from './subjects.ts';
import type { ChampdsEvent } from '../champds/types.ts';

const fixture: ChampdsEvent = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/champds/event-390.json'), 'utf8'),
);

test('event 390 maps to 17 subjects with the Phase 0 agendaItemIndex set', () => {
    const subjects = mapSubjects(fixture);
    assert.equal(subjects.length, 17);
    assert.deepEqual(
        subjects.map((s) => s.agendaItemIndex),
        [0, 10, 20, 30, 40, 50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 70],
    );
});

test('event 390 keeps ChampDS titles (trailing colons) so upsert matches existing rows', () => {
    const subjects = mapSubjects(fixture);
    assert.equal(subjects[0].name, 'Meeting Called to Order:');
    assert.equal(subjects[5].name, 'Agenda Items:');
    assert.equal(subjects[16].name, 'Adjourn');
    assert.match(subjects[6].name, /FOG/);
});

test('consent agenda keeps its PDF attachments on that subject', () => {
    const consent = mapSubjects(fixture).find((s) => s.agendaItemIndex === 40);
    assert.ok(consent);
    assert.ok(consent.attachments.length >= 7);
    assert.equal(consent.attachments[0].CustomerMediaID, 4672);
});
