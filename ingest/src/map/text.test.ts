import assert from 'node:assert/strict';
import test from 'node:test';
import { stripHtml } from './text.ts';

test('strips tags and decodes nbsp/amp', () => {
    assert.equal(
        stripHtml('<p>a.&nbsp; Staff Report</p>\n<p>b.&nbsp; Ordinance 2026-017</p>'),
        'a. Staff Report b. Ordinance 2026-017',
    );
});

test('collapses tabs and leftover whitespace', () => {
    assert.equal(stripHtml('10.\tConsideration of  the plan.'), '10. Consideration of the plan.');
});
