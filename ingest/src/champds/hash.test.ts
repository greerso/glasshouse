import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { hashEventDetail, hashEventListRow } from './hash.ts';
import type { ChampdsEvent } from './types.ts';

const fixture: ChampdsEvent = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/champds/event-390.json'), 'utf8'),
);

test('hashEventDetail is stable for the event-390 fixture', () => {
    const a = hashEventDetail(fixture);
    const b = hashEventDetail(fixture);
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
});

test('hashEventDetail ignores LastModifyDateTimeUTC', () => {
    const baseline = hashEventDetail(fixture);
    const mutated = structuredClone(fixture);
    mutated.Event.LastModifyDateTimeUTC = '2099-01-01 00:00:00';
    mutated.Agenda.AgendaItems[0].LastModifyDateTimeUTC = '2099-01-01 00:00:00';
    assert.equal(hashEventDetail(mutated), baseline);
});

test('hashEventDetail changes when an agenda title changes', () => {
    const baseline = hashEventDetail(fixture);
    const mutated = structuredClone(fixture);
    mutated.Agenda.AgendaItems[0].Title = 'Changed title';
    assert.notEqual(hashEventDetail(mutated), baseline);
});

test('hashEventListRow ignores LastModifyDateTimeUTC', () => {
    const row = {
        CustomerEventID: 390,
        EventTitle: 'Board of Mayor and Alderman Regular Meeting',
        EventDescription: '<p>August&nbsp;Agenda</p>',
        EventDateTimeUTC: '2026-08-11 23:00:00',
        LastModifyDateTimeUTC: '2026-08-13 18:55:49',
        MediaInfo: { MediaPath: '/2026-08/9406ff0ae567d88b0dd4927b6eabb9c95b91b44e.mp4' },
    };
    const a = hashEventListRow(row);
    const b = hashEventListRow({ ...row, LastModifyDateTimeUTC: '2099-01-01 00:00:00' });
    assert.equal(a, b);
});
