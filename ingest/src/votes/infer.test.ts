import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { inferUnanimousVoice } from './infer.ts';
import { parseMinutesText } from './parse.ts';
import type { ExtractedVote, ParsedMinutes } from './types.ts';

const fixture = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/minutes/2026-06-09-boma.txt'),
    'utf8',
);

const present = [
    { lastName: 'Stover', status: 'PRESENT' as const },
    { lastName: 'Alexander', status: 'PRESENT' as const },
    { lastName: 'King', status: 'PRESENT' as const },
    { lastName: 'White', status: 'PRESENT' as const },
    { lastName: 'Whitmer', status: 'PRESENT' as const },
];

function voice(overrides: Partial<ExtractedVote> = {}): ExtractedVote {
    return {
        motionText: 'The motion carried unanimously.',
        ordinanceNumber: null,
        isAmendment: false,
        outcome: 'PASSED',
        kind: 'VOICE',
        yayCount: 0,
        nayCount: 0,
        abstainCount: 0,
        members: [],
        source: 'decision',
        unanimous: true,
        ...overrides,
    };
}

function minutes(votes: ExtractedVote[]): ParsedMinutes {
    return { votes, attendance: present };
}

test('unanimous voice expands recorded attendance to per-member FOR inferred', () => {
    const out = inferUnanimousVoice(minutes([voice()]));
    assert.equal(out.votes.length, 1);
    assert.equal(out.votes[0].source, 'inferred');
    assert.equal(out.votes[0].kind, 'VOICE');
    assert.equal(out.votes[0].outcome, 'PASSED');
    assert.equal(out.votes[0].yayCount, 5);
    assert.deepEqual(
        out.votes[0].members.map((m) => m.lastName).sort(),
        ['Alexander', 'King', 'Stover', 'White', 'Whitmer'],
    );
    assert.ok(out.votes[0].members.every((m) => m.voteType === 'FOR'));
});

test('inferUnanimousVoice is the only writer of source inferred', () => {
    const parsed = parseMinutesText('The motion carried unanimously.\n');
    assert.equal(parsed.votes[0].source, 'decision');
    const inferred = inferUnanimousVoice({ ...parsed, attendance: present });
    assert.equal(inferred.votes[0].source, 'inferred');
    assert.ok(parseMinutesText(fixture).votes.every((v) => v.source === 'decision'));
    assert.ok(inferUnanimousVoice(parseMinutesText(fixture)).votes.every((v) => v.source === 'decision'));
});

test('non-unanimous voice stays decision with no members', () => {
    const out = inferUnanimousVoice(minutes([voice({
        motionText: 'The motion carried.',
        unanimous: false,
    })]));
    assert.equal(out.votes[0].source, 'decision');
    assert.deepEqual(out.votes[0].members, []);
});

test('failed voice is not inferred', () => {
    const out = inferUnanimousVoice(minutes([voice({
        motionText: 'The motion failed.',
        outcome: 'FAILED',
        unanimous: false,
    })]));
    assert.equal(out.votes[0].source, 'decision');
    assert.deepEqual(out.votes[0].members, []);
});

test('named roll-call is never rewritten as inferred', () => {
    const roll = parseMinutesText(fixture).votes[0];
    const out = inferUnanimousVoice({ votes: [roll], attendance: present });
    assert.equal(out.votes[0].source, 'decision');
    assert.equal(out.votes[0].kind, 'ROLL_CALL');
    assert.equal(out.votes[0].members.length, 5);
});
