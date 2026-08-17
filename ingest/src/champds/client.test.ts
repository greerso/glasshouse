import assert from 'node:assert/strict';
import test from 'node:test';
import { BROWSER_UA, createChampdsClient } from './client.ts';

test('pdfUrl uses the verified ATT path', () => {
    const client = createChampdsClient({
        champdsBaseUrl: 'https://playapi.champds.com/thompsonsstationtn',
        requestGapMs: 0,
        userAgent: BROWSER_UA,
    });
    assert.equal(
        client.pdfUrl({
            CustomerMediaID: 4672,
            MediaFileName: '91575be773d9ca40e50a4f9ff6b112581d548fb1.pdf',
            MediaFileLocation: '2026-08',
            MediaNickName: 'Item%20a',
            SizeBytes: 199737,
        }),
        'https://play.champds.com/ATT/thompsonsstationtn/2026-08/91575be773d9ca40e50a4f9ff6b112581d548fb1.pdf',
    );
});

test('listGroup sends a browser User-Agent', async () => {
    const calls: Array<{ url: string; ua: string | null }> = [];
    const client = createChampdsClient({
        champdsBaseUrl: 'https://playapi.champds.com/thompsonsstationtn',
        requestGapMs: 0,
        userAgent: BROWSER_UA,
        fetchImpl: async (url, init) => {
            const headers = new Headers(init?.headers);
            calls.push({ url: String(url), ua: headers.get('user-agent') });
            return new Response(JSON.stringify([{ CustomerEventID: 390 }]), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        },
    });
    const rows = await client.listGroup(1);
    assert.equal(rows[0].CustomerEventID, 390);
    assert.equal(calls[0].url, 'https://playapi.champds.com/thompsonsstationtn/archiveGroupListWithMedia/1');
    assert.equal(calls[0].ua, BROWSER_UA);
});

test('probeDirectMp4 returns null when the response is not a video', async () => {
    const client = createChampdsClient({
        champdsBaseUrl: 'https://playapi.champds.com/thompsonsstationtn',
        requestGapMs: 0,
        userAgent: BROWSER_UA,
        fetchImpl: async () => new Response(null, { status: 404, headers: { 'content-type': 'text/html' } }),
    });
    assert.equal(await client.probeDirectMp4('/2026-08/9406ff0ae567d88b0dd4927b6eabb9c95b91b44e.mp4'), null);
});

test('probeDirectMp4 returns the URL when HEAD is 200 video/*', async () => {
    const client = createChampdsClient({
        champdsBaseUrl: 'https://playapi.champds.com/thompsonsstationtn',
        requestGapMs: 0,
        userAgent: BROWSER_UA,
        fetchImpl: async () => new Response(null, { status: 200, headers: { 'content-type': 'video/mp4' } }),
    });
    assert.equal(
        await client.probeDirectMp4('/2026-08/x.mp4'),
        'https://securestream10.champds.com/2026-08/x.mp4',
    );
});
