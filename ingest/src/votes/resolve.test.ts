import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chicagoDayBoundsIso } from './date.ts';
import { minutesDayBounds, resolveMinutesMeeting } from './resolve.ts';
import type { ListedMeeting } from './resolve.ts';

const fixture = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/minutes/2026-06-09-boma.txt'),
    'utf8',
);

const BOMA = 'thompsons-station-boma';
const JUNE9 = '2026-06-09T23:00:00.000Z';

const june9Bounds = {
    from: '2026-06-09T05:00:00.000Z',
    to: '2026-06-10T04:59:59.999Z',
};

function meeting(partial: Partial<ListedMeeting> & Pick<ListedMeeting, 'id'>): ListedMeeting {
    return {
        name: 'Board of Mayor and Aldermen Regular Meeting',
        dateTime: JUNE9,
        administrativeBodyId: BOMA,
        ...partial,
    };
}

function resolve(partial: {
    nickname?: string;
    pdfText?: string;
    sourceMeetingId?: string;
    administrativeBodyId?: string;
    meetings?: readonly ListedMeeting[];
    fromMinutesSlot?: boolean;
}) {
    return resolveMinutesMeeting({
        nickname: 'BOMA Minutes 6_9_2026',
        pdfText: '',
        sourceMeetingId: 'aug11_2026',
        administrativeBodyId: BOMA,
        meetings: [meeting({ id: 'champds-377' })],
        ...partial,
    });
}

test('minutesDayBounds for BOMA Minutes 6_9_2026 is the June 9 CDT window', () => {
    assert.deepEqual(chicagoDayBoundsIso('2026-06-09'), june9Bounds);
    assert.deepEqual(minutesDayBounds('BOMA Minutes 6_9_2026', ''), june9Bounds);
    assert.deepEqual(minutesDayBounds('Staff Report', fixture.slice(0, 800)), june9Bounds);
});

test('Aug 11 consent nickname BOMA Minutes 6_9_2026 resolves to champds-377', () => {
    assert.deepEqual(
        resolve({
            nickname: 'BOMA Minutes 6_9_2026',
            meetings: [meeting({ id: 'champds-377', dateTime: JUNE9 })],
        }),
        { meetingId: 'champds-377' },
    );
});

test('empty meeting list skips as meeting-not-ingested', () => {
    assert.deepEqual(resolve({ meetings: [] }), { skip: 'meeting-not-ingested' });
});

test('Minutes slot without a date uses the source meeting', () => {
    assert.deepEqual(
        resolve({
            nickname: 'Approved Minutes',
            pdfText: 'Members present. No calendar date in this slot.',
            fromMinutesSlot: true,
            sourceMeetingId: 'aug11_2026',
            meetings: [meeting({ id: 'champds-377' })],
        }),
        { meetingId: 'aug11_2026' },
    );
});

test('two same-day meetings prefer Regular over work session', () => {
    assert.deepEqual(
        resolve({
            meetings: [
                meeting({
                    id: 'champds-376',
                    name: 'Board of Mayor and Aldermen Work Session',
                    dateTime: '2026-06-09T22:00:00.000Z',
                }),
                meeting({
                    id: 'champds-377',
                    name: 'Board of Mayor and Aldermen Regular Meeting',
                    dateTime: JUNE9,
                }),
            ],
        }),
        { meetingId: 'champds-377' },
    );
});

test('filters to administrativeBodyId so a same-day other body is ignored', () => {
    assert.deepEqual(
        resolve({
            meetings: [
                meeting({
                    id: 'champds-380',
                    name: 'Planning Commission Regular Meeting',
                    administrativeBodyId: 'thompsons-station-planning',
                }),
                meeting({ id: 'champds-377' }),
            ],
        }),
        { meetingId: 'champds-377' },
    );
});

test('nickname date wins over a different date in the PDF header', () => {
    assert.deepEqual(
        resolve({
            nickname: 'BOMA Minutes 6_9_2026',
            pdfText: 'Meeting Minutes\nAugust 11, 2026, 6:00 p.m.\n',
            meetings: [
                meeting({ id: 'aug11_2026', dateTime: '2026-08-11T23:00:00.000Z' }),
                meeting({ id: 'champds-377' }),
            ],
        }),
        { meetingId: 'champds-377' },
    );
});

test('without a nickname date, the first 800 chars of the PDF supply the day', () => {
    assert.deepEqual(
        resolve({
            nickname: 'Item a - BOMA Minutes',
            pdfText: fixture,
            meetings: [meeting({ id: 'champds-377' })],
        }),
        { meetingId: 'champds-377' },
    );
});

test('a meeting just outside the Chicago day bounds is not selected', () => {
    assert.deepEqual(
        resolve({
            meetings: [
                meeting({
                    id: 'too-early',
                    dateTime: '2026-06-09T04:59:59.999Z',
                }),
                meeting({
                    id: 'too-late',
                    dateTime: '2026-06-10T05:00:00.000Z',
                }),
            ],
        }),
        { skip: 'meeting-not-ingested' },
    );
});
