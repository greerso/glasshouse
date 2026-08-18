import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { extractPdfText } from './pdftext.ts';
import { isMinutesLike, parseMinutesText } from './parse.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const june9Pdf = readFileSync(join(dir, '../../../docs/research/minutes/2026-06-09-boma.pdf'));

function fakeSpawn(calls: { cmd: string; args: string[] }[], stdout = 'layout text', code = 0) {
    return (cmd: string, args: string[]) => {
        calls.push({ cmd, args });
        const child = new EventEmitter() as EventEmitter & {
            stdout: Readable;
            stderr: Readable;
        };
        child.stdout = Readable.from([stdout]);
        child.stderr = Readable.from(['']);
        child.stdout.on('end', () => queueMicrotask(() => child.emit('close', code)));
        return child;
    };
}

test('extractPdfText runs pdftotext -layout file -', async () => {
    const calls: { cmd: string; args: string[] }[] = [];
    const text = await extractPdfText(new Uint8Array([37, 80, 68, 70]), fakeSpawn(calls) as never);
    assert.equal(text, 'layout text');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].cmd, 'pdftotext');
    assert.equal(calls[0].args[0], '-layout');
    assert.match(calls[0].args[1], /doc\.pdf$/);
    assert.equal(calls[0].args[2], '-');
});

test('June 9 PDF pdftotext -layout yields 10 vote blocks', async () => {
    const text = await extractPdfText(june9Pdf);
    assert.equal(isMinutesLike(text), true);
    assert.equal(parseMinutesText(text).votes.length, 10);
});
