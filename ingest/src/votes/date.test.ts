import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chicagoDayBoundsIso, dateFromMinutesLabel } from './date.ts';

const fixture = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/minutes/2026-06-09-boma.txt'),
    'utf8',
);

test('dateFromMinutesLabel reads BOMA Minutes 6_9_2026', () => {
    assert.equal(dateFromMinutesLabel('BOMA Minutes 6_9_2026'), '2026-06-09');
});

test('dateFromMinutesLabel reads June 9, 2026 from the fixture header', () => {
    assert.equal(dateFromMinutesLabel('June 9, 2026, 6:00 p.m.'), '2026-06-09');
    assert.equal(dateFromMinutesLabel(fixture.slice(0, 800)), '2026-06-09');
});

test('dateFromMinutesLabel returns null when no date is present', () => {
    assert.equal(dateFromMinutesLabel('Staff Report'), null);
});

test('chicagoDayBoundsIso uses CDT for June 9 2026', () => {
    assert.deepEqual(chicagoDayBoundsIso('2026-06-09'), {
        from: '2026-06-09T05:00:00.000Z',
        to: '2026-06-10T04:59:59.999Z',
    });
});

test('chicagoDayBoundsIso uses CST for January 15 2026', () => {
    assert.deepEqual(chicagoDayBoundsIso('2026-01-15'), {
        from: '2026-01-15T06:00:00.000Z',
        to: '2026-01-16T05:59:59.999Z',
    });
});
