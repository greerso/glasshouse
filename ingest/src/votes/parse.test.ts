import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { isMinutesLike, parseMinutesText } from './parse.ts';
import { MINUTES_PARSER_VERSION } from './types.ts';

const fixture = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/minutes/2026-06-09-boma.txt'),
    'utf8',
);

function lastNames(
    vote: { members: { lastName: string; voteType: string }[] },
    voteType: string,
): string[] {
    return vote.members.filter((m) => m.voteType === voteType).map((m) => m.lastName).sort();
}

test('MINUTES_PARSER_VERSION is 1', () => {
    assert.equal(MINUTES_PARSER_VERSION, '1');
});

test('June 9 fixture yields 10 vote blocks, all roll-call decision', () => {
    const parsed = parseMinutesText(fixture);
    assert.equal(parsed.votes.length, 10);
    assert.ok(parsed.votes.every((v) => v.kind === 'ROLL_CALL'));
    assert.ok(parsed.votes.every((v) => v.source === 'decision'));
});

test('consent agenda passed 5-0 with five named yays', () => {
    const vote = parseMinutesText(fixture).votes[0];
    assert.match(vote.motionText, /Consent Agenda/i);
    assert.equal(vote.isAmendment, false);
    assert.equal(vote.ordinanceNumber, null);
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 5);
    assert.equal(vote.nayCount, 0);
    assert.equal(vote.abstainCount, 0);
    assert.deepEqual(lastNames(vote, 'FOR'), ['Alexander', 'King', 'Stover', 'White', 'Whitmer']);
    assert.deepEqual(lastNames(vote, 'AGAINST'), []);
});

test('amended ordinance 2026-014 (tax rate) failed 2-3', () => {
    const vote = parseMinutesText(fixture).votes[1];
    assert.equal(vote.isAmendment, true);
    assert.equal(vote.ordinanceNumber, '2026-014');
    assert.equal(vote.outcome, 'FAILED');
    assert.equal(vote.yayCount, 2);
    assert.equal(vote.nayCount, 3);
    assert.equal(vote.abstainCount, 0);
    assert.deepEqual(lastNames(vote, 'FOR'), ['King', 'White']);
    assert.deepEqual(lastNames(vote, 'AGAINST'), ['Alexander', 'Stover', 'Whitmer']);
});

test('main 2026-014 passed 5-0 and is not an amendment', () => {
    const vote = parseMinutesText(fixture).votes[2];
    assert.equal(vote.isAmendment, false);
    assert.equal(vote.ordinanceNumber, '2026-014');
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 5);
    assert.equal(vote.nayCount, 0);
    assert.deepEqual(lastNames(vote, 'FOR'), ['Alexander', 'King', 'Stover', 'White', 'Whitmer']);
});

test('2026-012 passed 5-0', () => {
    const vote = parseMinutesText(fixture).votes[3];
    assert.equal(vote.ordinanceNumber, '2026-012');
    assert.equal(vote.isAmendment, false);
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 5);
    assert.equal(vote.nayCount, 0);
});

test('2026-013 passed 5-0', () => {
    const vote = parseMinutesText(fixture).votes[4];
    assert.equal(vote.ordinanceNumber, '2026-013');
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 5);
});

test('2026-003 e-bike passed 5-0', () => {
    const vote = parseMinutesText(fixture).votes[5];
    assert.equal(vote.ordinanceNumber, '2026-003');
    assert.match(vote.motionText, /E-Bike|Bicycle|Greenway/i);
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 5);
    assert.deepEqual(lastNames(vote, 'FOR'), ['Alexander', 'King', 'Stover', 'White', 'Whitmer']);
});

test('Sarah Benson amendment passed 3-1-1 with White ABSTAIN', () => {
    const vote = parseMinutesText(fixture).votes[6];
    assert.equal(vote.isAmendment, true);
    assert.equal(vote.ordinanceNumber, null);
    assert.match(vote.motionText, /Sarah Benson/i);
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 3);
    assert.equal(vote.nayCount, 1);
    assert.equal(vote.abstainCount, 1);
    assert.deepEqual(lastNames(vote, 'FOR'), ['Alexander', 'Stover', 'Whitmer']);
    assert.deepEqual(lastNames(vote, 'AGAINST'), ['King']);
    assert.deepEqual(lastNames(vote, 'ABSTAIN'), ['White']);
});

test('main amended Sarah Benson passed 5-0 and is not an amendment', () => {
    const vote = parseMinutesText(fixture).votes[7];
    assert.equal(vote.isAmendment, false);
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 5);
    assert.equal(vote.nayCount, 0);
    assert.deepEqual(lastNames(vote, 'FOR'), ['Alexander', 'King', 'Stover', 'White', 'Whitmer']);
});

test('2026-017 FOG passed 5-0', () => {
    const vote = parseMinutesText(fixture).votes[8];
    assert.equal(vote.ordinanceNumber, '2026-017');
    assert.match(vote.motionText, /FOG|Fats, Oils/i);
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 5);
});

test('modify a condition passed 5-0', () => {
    const vote = parseMinutesText(fixture).votes[9];
    assert.equal(vote.isAmendment, false);
    assert.equal(vote.ordinanceNumber, null);
    assert.match(vote.motionText, /Modify a Condition|Declaration Way/i);
    assert.equal(vote.outcome, 'PASSED');
    assert.equal(vote.yayCount, 5);
    assert.deepEqual(lastNames(vote, 'FOR'), ['Alexander', 'King', 'Stover', 'White', 'Whitmer']);
});

test('attendance is the five members present', () => {
    const { attendance } = parseMinutesText(fixture);
    assert.deepEqual(
        attendance.map((a) => a.lastName).sort(),
        ['Alexander', 'King', 'Stover', 'White', 'Whitmer'],
    );
    assert.ok(attendance.every((a) => a.status === 'PRESENT'));
});

test('en-dash ordinance in the fixture normalizes to 2026-014', () => {
    assert.match(fixture, /Ordinance 2026\u2013014/);
    const main = parseMinutesText(fixture).votes[2];
    assert.equal(main.ordinanceNumber, '2026-014');
});

test('isMinutesLike is true for the fixture and false for agenda-only text', () => {
    assert.equal(isMinutesLike(fixture), true);
    assert.equal(isMinutesLike('Staff Report\nConsideration of Ordinance 2026-017'), false);
});

test('voice-only when the next 200 chars lack Yay Votes', () => {
    const voice = parseMinutesText('The motion carried unanimously.\n');
    assert.equal(voice.votes.length, 1);
    assert.equal(voice.votes[0].kind, 'VOICE');
    assert.equal(voice.votes[0].outcome, 'PASSED');
    assert.equal(voice.votes[0].unanimous, true);
    assert.equal(voice.votes[0].source, 'decision');
    assert.deepEqual(voice.votes[0].members, []);

    const far = parseMinutesText(`The motion passed.\n${'x'.repeat(200)}\n5-Yay Votes: Alexander\n`);
    assert.equal(far.votes.length, 1);
    assert.equal(far.votes[0].kind, 'VOICE');

    const roll = parseMinutesText(
        'The motion passed with the following vote:\n5-Yay Votes: Alexander, King, Stover, White, Whitmer,\n0-Nay Votes:\n',
    );
    assert.equal(roll.votes.length, 1);
    assert.equal(roll.votes[0].kind, 'ROLL_CALL');
    assert.equal(roll.votes[0].yayCount, 5);
});
