import assert from 'node:assert/strict';
import test from 'node:test';
import { SEED_LAST_NAME_IDS, matchLastName } from './roster.ts';

test('seed last-name map resolves the five June 9 members', () => {
    assert.equal(matchLastName('Stover', SEED_LAST_NAME_IDS), 'thompsons-station-brian-stover');
    assert.equal(matchLastName('Alexander', SEED_LAST_NAME_IDS), 'thompsons-station-shaun-alexander');
    assert.equal(matchLastName('King', SEED_LAST_NAME_IDS), 'thompsons-station-harry-king');
    assert.equal(matchLastName('White', SEED_LAST_NAME_IDS), 'thompsons-station-kreis-white');
    assert.equal(matchLastName('Whitmer', SEED_LAST_NAME_IDS), 'thompsons-station-bob-whitmer');
});

test('matchLastName is case-insensitive on the seed map', () => {
    assert.equal(matchLastName('stover', SEED_LAST_NAME_IDS), 'thompsons-station-brian-stover');
});

test('unknown last name is dropped', () => {
    assert.equal(matchLastName('Smith', SEED_LAST_NAME_IDS), undefined);
});

test('ambiguous last name is dropped', () => {
    const people = [
        { lastName: 'Alexander', personId: 'thompsons-station-shaun-alexander' },
        { lastName: 'Alexander', personId: 'thompsons-station-sarah-alexander' },
    ];
    assert.equal(matchLastName('Alexander', people), undefined);
    assert.equal(matchLastName('Stover', people.concat({
        lastName: 'Stover',
        personId: 'thompsons-station-brian-stover',
    })), 'thompsons-station-brian-stover');
});
