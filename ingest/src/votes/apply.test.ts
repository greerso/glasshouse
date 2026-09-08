import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { applyMinutesPdf } from './apply.ts';
import { MINUTES_PARSER_VERSION } from './types.ts';

const fixture = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/minutes/2026-06-09-boma.txt'),
    'utf8',
);

const BOMA = 'thompsons-station-boma';
const STOVER = 'thompsons-station-brian-stover';
const ALEXANDER = 'thompsons-station-shaun-alexander';
const KING = 'thompsons-station-harry-king';
const WHITE = 'thompsons-station-kreis-white';
const WHITMER = 'thompsons-station-bob-whitmer';

const june9Bounds = {
    from: '2026-06-09T05:00:00.000Z',
    to: '2026-06-10T04:59:59.999Z',
};

const june9Subjects = [
    { id: 'consent-parent', name: 'Consent Agenda:' },
    { id: 'consent-child-a', name: 'Approval of the Minutes of May 19, 2026, Regular Board Meeting.' },
    { id: 'consent-child-b', name: 'Approval Contract 2026-005 with Barge Design for a Professional Services Agreement.' },
    {
        id: 'hearing-014',
        name: 'Public Hearing: Ordinance 2026-014: An Ordinance of the Town of Thompson’s Station, TN Adopting the Annual Budget, and Tax Rate for the Fiscal Year beginning July 1, 2026, and ending June 30, 2027.',
    },
    {
        id: 'action-014',
        name: 'Consideration of 2nd Reading of Ordinance 2026-014: An Ordinance of the Town of Thompson’s Station, TN Adopting the Annual Budget, and Tax Rate for the Fiscal Year beginning July 1, 2026, and ending June 30, 2027.',
    },
    {
        id: 'action-012',
        name: 'Consideration of 2nd Reading of Ordinance 2026-012: An Ordinance of the Town of Thompson’s Station, TN to approve the Zoning for Property at 1655 Lewisburg Pike.',
    },
    {
        id: 'action-013',
        name: 'Consideration of 2nd Reading of Ordinance 2026-013: An Ordinance of the Town of Thompson’s Station, TN to Approve an Update to the Community Development Department Fee Schedule.',
    },
    {
        id: 'action-003',
        name: 'Consideration of 2nd Reading of Ordinance 2026-003: An Ordinance to Regulate Bicycle, E-Bike, and Utility Terrain Vehicle Uses on Town Greenways, Paths, and Trails.',
    },
    {
        id: 'sarah-benson',
        name: 'Consideration of Responsive Bid for Sarah Benson Park Phase I Construction Project and Authorization for the Mayor to Sign said Contract with the Approved Responsive Bidder.',
    },
    {
        id: 'action-017',
        name: 'Consideration of 1st Reading of Ordinance 2026-017: An Ordinance to Add Wastewater Title 18 Chapter 6 to Adopt a Fats, Oils, and Grease (FOG) Management Program to the Town Code.',
    },
    {
        id: 'modify-condition',
        name: 'Consideration of Request to Modify a Condition of Approval Related to the Use of Declaration Way as a Construction Entrance for the Planned Development Plan at 4445 Columbia Pike.',
    },
];

const bomaRoster = [
    { lastName: 'Stover', personId: STOVER },
    { lastName: 'Alexander', personId: ALEXANDER },
    { lastName: 'King', personId: KING },
    { lastName: 'White', personId: WHITE },
    { lastName: 'Whitmer', personId: WHITMER },
];

function votesHash(text: string): string {
    return `${MINUTES_PARSER_VERSION}:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function collectApply(opts?: { meetings?: unknown[]; people?: typeof bomaRoster }) {
    const calls: { op: string; payload?: unknown }[] = [];
    return {
        calls,
        deps: {
            extractPdfText: async () => fixture,
            oc: {
                async listMeetings(from: string, to: string) {
                    calls.push({ op: 'listMeetings', payload: { from, to } });
                    return opts?.meetings ?? [
                        {
                            id: 'champds-377',
                            name: 'Board of Mayor and Aldermen Regular Meeting',
                            dateTime: '2026-06-09T23:00:00.000Z',
                            administrativeBodyId: BOMA,
                            subjects: june9Subjects,
                        },
                    ];
                },
                async getPeople(administrativeBodyId: string) {
                    calls.push({ op: 'getPeople', payload: administrativeBodyId });
                    return opts?.people ?? bomaRoster;
                },
                async upsertVotes(meetingId: string, body: unknown) {
                    calls.push({ op: 'upsertVotes', payload: { meetingId, body } });
                    return {};
                },
                async upsertSubjects(meetingId: string, subjects: { name: string }[]) {
                    calls.push({ op: 'upsertSubjects', payload: { meetingId, subjects } });
                    return subjects.map((subject) => ({
                        id: subject.name === 'Amendment: Ordinance 2026-014'
                            ? 'created-amendment-014'
                            : 'created-steelhead',
                        name: subject.name,
                    }));
                },
                async upsertObservation(row: { source: string; contentHash: string; meetingId?: string }) {
                    calls.push({ op: 'obs', payload: row });
                },
            },
        },
    };
}

const june9Input = {
    pdfBytes: new Uint8Array([1]),
    mediaId: 999,
    nickname: 'BOMA Minutes 6_9_2026',
    sourceMeetingId: 'aug11_2026',
    administrativeBodyId: BOMA,
};

test('June 9 text attached to Aug 11 POSTs 10 results to champds-377', async () => {
    const h = collectApply();
    const result = await applyMinutesPdf(h.deps, june9Input);

    assert.deepEqual(result, { action: 'applied', meetingId: 'champds-377', resultCount: 10 });

    const listed = h.calls.find((c) => c.op === 'listMeetings');
    assert.deepEqual(listed?.payload, june9Bounds);

    const people = h.calls.find((c) => c.op === 'getPeople');
    assert.equal(people?.payload, BOMA);

    const voteCall = h.calls.find((c) => c.op === 'upsertVotes');
    assert.ok(voteCall);
    const payload = voteCall.payload as {
        meetingId: string;
        body: {
            attendance: { personId: string; status: string; source: string }[];
            results: {
                subjectId: string;
                outcome: string;
                yayCount: number;
                nayCount: number;
                abstainCount: number;
                kind: string;
                source: string;
                votes: { personId: string; voteType: string }[];
            }[];
        };
    };
    assert.equal(payload.meetingId, 'champds-377');
    assert.equal(payload.body.results.length, 10);
    assert.equal(payload.body.attendance.length, 5);
    assert.deepEqual(
        payload.body.attendance.map((row) => row.personId).sort(),
        [ALEXANDER, STOVER, KING, WHITE, WHITMER].sort(),
    );
    assert.ok(payload.body.attendance.every((row) => row.status === 'PRESENT' && row.source === 'decision'));

    const created = h.calls.find((c) => c.op === 'upsertSubjects');
    assert.ok(created);
    const createdSubjects = (created.payload as { meetingId: string; subjects: { name: string; nonAgendaReason: string }[] });
    assert.equal(createdSubjects.meetingId, 'champds-377');
    assert.ok(createdSubjects.subjects.some((s) => s.name === 'Amendment: Ordinance 2026-014'));
    assert.ok(createdSubjects.subjects.every((s) => s.nonAgendaReason === 'outOfAgenda'));
    assert.ok(createdSubjects.subjects.every((s) => !('agendaItemIndex' in s)));

    const amend = payload.body.results.find((r) => r.subjectId === 'created-amendment-014');
    assert.ok(amend);
    assert.equal(amend.outcome, 'FAILED');
    assert.equal(amend.yayCount, 2);
    assert.equal(amend.nayCount, 3);
    assert.equal(amend.kind, 'ROLL_CALL');
    assert.equal(amend.source, 'decision');
    assert.deepEqual(
        amend.votes.filter((v) => v.voteType === 'FOR').map((v) => v.personId).sort(),
        [KING, WHITE].sort(),
    );
    assert.deepEqual(
        amend.votes.filter((v) => v.voteType === 'AGAINST').map((v) => v.personId).sort(),
        [ALEXANDER, STOVER, WHITMER].sort(),
    );

    const consent = payload.body.results.find((r) => r.subjectId === 'consent-parent');
    assert.ok(consent);
    assert.equal(consent.yayCount, 5);
    assert.equal(consent.votes.length, 5);
    assert.ok(consent.votes.every((v) => v.voteType === 'FOR'));

    const obs = h.calls.find((c) => c.op === 'obs');
    assert.deepEqual(obs?.payload, {
        source: 'champds:votes:999',
        contentHash: votesHash(fixture),
        meetingId: 'champds-377',
    });
});

test('agenda-only text is skipped-no-votes with observation and no votes POST', async () => {
    const h = collectApply();
    h.deps.extractPdfText = async () => 'Staff Report\nConsideration of Ordinance 2026-017';
    const result = await applyMinutesPdf(h.deps, june9Input);

    assert.deepEqual(result, { action: 'skipped-no-votes' });
    assert.equal(h.calls.filter((c) => c.op === 'upsertVotes').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'listMeetings').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'upsertSubjects').length, 0);
    const obs = h.calls.find((c) => c.op === 'obs');
    assert.deepEqual(obs?.payload, {
        source: 'champds:votes:999',
        contentHash: votesHash('Staff Report\nConsideration of Ordinance 2026-017'),
        meetingId: 'aug11_2026',
    });
});

test('meeting-not-ingested writes no observation and does not POST votes', async () => {
    const h = collectApply({ meetings: [] });
    const result = await applyMinutesPdf(h.deps, june9Input);

    assert.deepEqual(result, { action: 'skipped', reason: 'meeting-not-ingested' });
    assert.equal(h.calls.filter((c) => c.op === 'upsertVotes').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'obs').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'upsertSubjects').length, 0);
});

test('unknown last names are dropped but printed counts stay', async () => {
    const h = collectApply({
        people: bomaRoster.filter((p) => p.lastName !== 'Alexander'),
    });
    const result = await applyMinutesPdf(h.deps, june9Input);
    assert.equal(result.action, 'applied');
    const voteCall = h.calls.find((c) => c.op === 'upsertVotes');
    const body = (voteCall?.payload as { body: { results: { yayCount: number; votes: { personId: string }[] }[] } }).body;
    const consent = body.results[0];
    assert.equal(consent.yayCount, 5);
    assert.equal(consent.votes.length, 4);
    assert.ok(!consent.votes.some((v) => v.personId === ALEXANDER));
});
