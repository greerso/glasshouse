import assert from 'node:assert/strict';
import test from 'node:test';
import { requestTranscription } from './transcribe.ts';

test('does not trigger the tasks pipeline', () => {
    const result = requestTranscription();
    assert.equal(result.skipped, true);
    assert.match(result.reason, /document-only/i);
});
