import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type PdfToTextSpawn = (
    command: string,
    args: readonly string[],
) => {
    stdout?: NodeJS.ReadableStream | null;
    stderr?: NodeJS.ReadableStream | null;
    on(event: 'close', listener: (code: number | null) => void): unknown;
    on(event: 'error', listener: (err: Error) => void): unknown;
};

export async function extractPdfText(
    bytes: Uint8Array,
    spawnFn: PdfToTextSpawn = spawn,
): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'gh-minutes-'));
    const file = join(dir, 'doc.pdf');
    try {
        await writeFile(file, bytes);
        return await runPdfToText(file, spawnFn);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

async function readStream(stream: NodeJS.ReadableStream | null | undefined): Promise<string> {
    if (!stream) return '';
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function runPdfToText(file: string, spawnFn: PdfToTextSpawn): Promise<string> {
    const child = spawnFn('pdftotext', ['-layout', file, '-']);
    const closed = new Promise<number | null>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => resolve(code));
    });
    const [out, err, code] = await Promise.all([
        readStream(child.stdout),
        readStream(child.stderr),
        closed,
    ]);
    if (code === 0) return out;
    throw new Error(`pdftotext exited ${code}${err ? `: ${err}` : ''}`);
}
