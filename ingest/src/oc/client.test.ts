import assert from 'node:assert/strict';
import test from 'node:test';
import { createOcClient } from './client.ts';
import { matchLastName } from '../votes/roster.ts';

const SHAUN = 'thompsons-station-shaun-alexander';
const SARAH = 'thompsons-station-sarah-alexander';

function peoplePayload() {
    return [
        {
            id: SHAUN,
            name: 'Shaun Alexander',
            name_short: 'Alexander',
            roles: [{ administrativeBodyId: 'thompsons-station-boma' }],
        },
        {
            id: SARAH,
            name: 'Sarah Alexander',
            name_short: 'Alexander',
            roles: [{ administrativeBodyId: 'thompsons-station-planning' }],
        },
        {
            id: 'thompsons-station-brian-stover',
            name: 'Brian Stover',
            name_short: 'Stover',
            roles: [{ administrativeBodyId: 'thompsons-station-boma' }],
        },
    ];
}

test('listMeetings sends Chicago day bounds, limit 100, includeUnreleased', async () => {
    const urls: string[] = [];
    const client = createOcClient({
        ocBaseUrl: 'http://web:3000',
        ocApiKey: 'k',
        cityId: 'thompsons-station',
        fetchImpl: async (url) => {
            urls.push(String(url));
            return new Response(JSON.stringify([
                {
                    id: 'champds-377',
                    name: 'Board of Mayor and Aldermen Regular Meeting',
                    dateTime: '2026-06-09T23:00:00.000Z',
                    administrativeBodyId: 'thompsons-station-boma',
                    subjects: [{ id: 'consent-parent', name: 'Consent Agenda:' }],
                },
            ]), { status: 200, headers: { 'content-type': 'application/json' } });
        },
    });
    const meetings = await client.listMeetings('2026-06-09T05:00:00.000Z', '2026-06-10T04:59:59.999Z');
    const parsed = new URL(urls[0]);
    assert.equal(parsed.pathname, '/api/cities/thompsons-station/meetings');
    assert.equal(parsed.searchParams.get('from'), '2026-06-09T05:00:00.000Z');
    assert.equal(parsed.searchParams.get('to'), '2026-06-10T04:59:59.999Z');
    assert.equal(parsed.searchParams.get('limit'), '100');
    assert.equal(parsed.searchParams.get('includeUnreleased'), 'true');
    assert.equal(meetings[0].id, 'champds-377');
    assert.equal(meetings[0].subjects[0].id, 'consent-parent');
});

test('getPeople filters by BOMA body so Alexander is unique', async () => {
    const client = createOcClient({
        ocBaseUrl: 'http://web:3000',
        ocApiKey: 'k',
        cityId: 'thompsons-station',
        fetchImpl: async () => new Response(JSON.stringify(peoplePayload()), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        }),
    });
    const roster = await client.getPeople('thompsons-station-boma');
    assert.equal(matchLastName('Alexander', roster), SHAUN);
    assert.ok(!roster.some((p) => p.personId === SARAH));
    assert.equal(matchLastName('Stover', roster), 'thompsons-station-brian-stover');
});

test('upsertVotes POSTs attendance and results to /votes', async () => {
    const hits: { url: string; body: unknown }[] = [];
    const client = createOcClient({
        ocBaseUrl: 'http://web:3000',
        ocApiKey: 'k',
        cityId: 'thompsons-station',
        fetchImpl: async (url, init) => {
            hits.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
    });
    const body = { attendance: [], results: [] };
    await client.upsertVotes('champds-377', body);
    assert.equal(hits[0].url, 'http://web:3000/api/cities/thompsons-station/meetings/champds-377/votes');
    assert.deepEqual(hits[0].body, body);
});
