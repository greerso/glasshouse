import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { matchSubject, outOfAgendaName } from './match.ts';
import { parseMinutesText } from './parse.ts';
import type { ExtractedVote } from './types.ts';

const fixture = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/minutes/2026-06-09-boma.txt'),
    'utf8',
);

const votes = parseMinutesText(fixture).votes;

const june9Subjects = [
    { id: 'consent-parent', name: 'Consent Agenda:' },
    { id: 'consent-child-a', name: 'Approval of the Minutes of May 19, 2026, Regular Board Meeting.' },
    { id: 'consent-child-b', name: 'Approval Contract 2026-005 with Barge Design for a Professional Services Agreement.' },
    {
        id: 'hearing-014',
        name: 'Public Hearing: Ordinance 2026-014: An Ordinance of the Town of Thompson’s Station, TN Adopting the Annual Budget, and Tax Rate for the Fiscal Year beginning July 1, 2026, and ending June 30, 2027.',
    },
    {
        id: 'hearing-012',
        name: 'Public Hearing: Ordinance 2026-012: An Ordinance of the Town of Thompson’s Station, TN to Approve Zoning for Property at 1655 Lewisburg Pike.',
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
        id: 'mayor-sign-decoy',
        name: 'Authorization for the Mayor to Sign the Wastewater Treatment Plant Contract.',
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

function collapseWs(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

test('consent matches the parent Consent Agenda item, never children', () => {
    assert.match(votes[0].motionText, /Consent Agenda/i);
    assert.deepEqual(matchSubject(votes[0], june9Subjects), {
        type: 'existing',
        subjectId: 'consent-parent',
    });
});

test('ordinance 2026-014 prefers the action item over the public hearing', () => {
    assert.equal(votes[2].ordinanceNumber, '2026-014');
    assert.equal(votes[2].isAmendment, false);
    assert.deepEqual(matchSubject(votes[2], june9Subjects), {
        type: 'existing',
        subjectId: 'action-014',
    });
});

test('amendment never reuses an agenda subject and names Amendment: Ordinance 2026-014', () => {
    assert.equal(votes[1].isAmendment, true);
    assert.equal(votes[1].ordinanceNumber, '2026-014');
    assert.deepEqual(matchSubject(votes[1], june9Subjects), {
        type: 'create',
        name: 'Amendment: Ordinance 2026-014',
        nonAgendaReason: 'outOfAgenda',
    });
    assert.equal(outOfAgendaName(votes[1]), 'Amendment: Ordinance 2026-014');
});

test('Sarah Benson title overlap matches the bid/consideration item', () => {
    assert.equal(votes[7].ordinanceNumber, null);
    assert.equal(votes[7].isAmendment, false);
    assert.match(votes[7].motionText, /Sarah Benson/i);
    assert.deepEqual(matchSubject(votes[7], june9Subjects), {
        type: 'existing',
        subjectId: 'sarah-benson',
    });
});

test('Sarah Benson amendment creates a stable name and does not reuse the bid subject', () => {
    assert.equal(votes[6].isAmendment, true);
    assert.equal(votes[6].ordinanceNumber, null);
    const expected = `Amendment: ${collapseWs(votes[6].motionText).slice(0, 80)}`;
    assert.deepEqual(matchSubject(votes[6], june9Subjects), {
        type: 'create',
        name: expected,
        nonAgendaReason: 'outOfAgenda',
    });
    assert.equal(outOfAgendaName(votes[6]), expected);
    assert.match(expected, /Amendment: amended the main motion to add Steelhead/i);
});

test('no match creates a stable outOfAgenda name from the motion line', () => {
    const orphan: ExtractedVote = {
        ...votes[9],
        motionText: 'made a motion to paint the water tower purple',
        ordinanceNumber: null,
        isAmendment: false,
    };
    assert.deepEqual(matchSubject(orphan, june9Subjects), {
        type: 'create',
        name: 'made a motion to paint the water tower purple',
        nonAgendaReason: 'outOfAgenda',
    });
    assert.equal(outOfAgendaName(orphan), 'made a motion to paint the water tower purple');
});

test('outOfAgendaName truncates a non-amendment motion to 200 characters', () => {
    const long = 'x'.repeat(240);
    assert.equal(outOfAgendaName({
        motionText: long,
        ordinanceNumber: null,
        isAmendment: false,
    }), long.slice(0, 200));
});
