import assert from 'node:assert/strict';
import test from 'node:test';
import { objectKey, publicUrl, createMirror } from './mirror.ts';

test('objectKey is stable and path-safe', () => {
    assert.equal(
        objectKey('thompsons-station', 390, {
            CustomerMediaID: 4672,
            MediaFileName: '91575be773d9ca40e50a4f9ff6b112581d548fb1.pdf',
            MediaFileLocation: '2026-08',
            MediaNickName: 'Item%20a%20-%20BOMA%20Minutes%206_9_2026',
            SizeBytes: 199737,
        }),
        'thompsons-station/champds/390/pdf/4672-Item-a-BOMA-Minutes-6_9_2026.pdf',
    );
});

test('publicUrl is path-style until cdn. exists', () => {
    assert.equal(
        publicUrl('http://10.0.0.66:9000', 'glasshouse', 'thompsons-station/champds/390/pdf/4672-x.pdf'),
        'http://10.0.0.66:9000/glasshouse/thompsons-station/champds/390/pdf/4672-x.pdf',
    );
});

test('get returns object bytes via GetObject', async () => {
    const sent: unknown[] = [];
    const mirror = createMirror({
        endpoint: 'http://minio:9000',
        region: 'us-east-1',
        accessKey: 'glasshouse',
        secretKey: 'secret',
        bucket: 'glasshouse',
        publicBaseUrl: 'http://10.0.0.66:9000',
        forcePathStyle: true,
        send: async (command) => {
            sent.push(command.input);
            return {
                Body: {
                    transformToByteArray: async () => new Uint8Array([37, 80, 68, 70]),
                },
            };
        },
    });
    const bytes = await mirror.get('thompsons-station/champds/390/pdf/4672-x.pdf');
    assert.deepEqual(bytes, new Uint8Array([37, 80, 68, 70]));
    assert.deepEqual(sent[0], {
        Bucket: 'glasshouse',
        Key: 'thompsons-station/champds/390/pdf/4672-x.pdf',
    });
});

test('putPdf sends PutObject with path-style client options and returns the public URL', async () => {
    const sent: unknown[] = [];
    const mirror = createMirror({
        endpoint: 'http://minio:9000',
        region: 'us-east-1',
        accessKey: 'glasshouse',
        secretKey: 'secret',
        bucket: 'glasshouse',
        publicBaseUrl: 'http://10.0.0.66:9000',
        forcePathStyle: true,
        send: async (command) => {
            sent.push(command.input);
            return {};
        },
    });
    const result = await mirror.putPdf({
        key: 'thompsons-station/champds/390/pdf/4672-x.pdf',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'application/pdf',
    });
    assert.equal(result.url, 'http://10.0.0.66:9000/glasshouse/thompsons-station/champds/390/pdf/4672-x.pdf');
    assert.deepEqual(sent[0], {
        Bucket: 'glasshouse',
        Key: 'thompsons-station/champds/390/pdf/4672-x.pdf',
        Body: new Uint8Array([1, 2, 3]),
        ContentType: 'application/pdf',
    });
});
