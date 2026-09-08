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

test('missing Agenda maps to zero subjects', () => {
    const event = {
        Event: {
            CustomerEventID: 389,
            EventTitle: 'Annual State of the Town Address',
            EventDescription: '',
            EventDateTimeUTC: '2026-07-23 14:00:00',
        },
        MediaInfo: { MediaPath: '/x.mp4' },
    } as ChampdsEvent;
    assert.deepEqual(mapSubjects(event), []);
});

test('empty Title falls back to stripped Description', () => {
    const event = {
        Event: {
            CustomerEventID: 250,
            EventTitle: 'Work Session',
            EventDescription: '',
            EventDateTimeUTC: '2025-03-31 22:00:00',
        },
        Agenda: {
            AgendaItems: [
                {
                    CustomerAgendaItemID: 2991,
                    Title: '',
                    Description: '<p><em>Note: A Budget Workshop</em></p>',
                    OrderOrdinal: 70,
                    OrderParentID: 0,
                    Attachments: [],
                },
            ],
        },
    } as ChampdsEvent;
    const subjects = mapSubjects(event);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].name, 'Note: A Budget Workshop');
});

test('consent agenda keeps its PDF attachments on that subject', () => {
    const consent = mapSubjects(fixture).find((s) => s.agendaItemIndex === 40);
    assert.ok(consent);
    assert.ok(consent.attachments.length >= 7);
    assert.equal(consent.attachments[0].CustomerMediaID, 4672);
});
