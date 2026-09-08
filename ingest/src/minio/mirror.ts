import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ChampdsAttachment } from '../champds/types.ts';

export function objectKey(cityId: string, eventId: number, att: ChampdsAttachment): string {
    const nick = decodeURIComponent(att.MediaNickName)
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    const safeName = (nick || att.MediaFileName).replace(/\.pdf$/i, '');
    return `${cityId}/champds/${eventId}/pdf/${att.CustomerMediaID}-${safeName}.pdf`;
}

export function publicUrl(publicBaseUrl: string, bucket: string, key: string): string {
    return `${publicBaseUrl.replace(/\/$/, '')}/${bucket}/${key}`;
}

export type MirrorDeps = {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    publicBaseUrl: string;
    forcePathStyle: boolean;
    send?: (command: { input: unknown }) => Promise<unknown>;
};

export function createMirror(deps: MirrorDeps) {
    const client = new S3Client({
        endpoint: deps.endpoint,
        region: deps.region,
        credentials: { accessKeyId: deps.accessKey, secretAccessKey: deps.secretKey },
        forcePathStyle: deps.forcePathStyle,
    });
    const send = deps.send ?? ((command) => client.send(command as never));

    return {
        async get(key: string): Promise<Uint8Array> {
            const out = await send(new GetObjectCommand({ Bucket: deps.bucket, Key: key })) as {
                Body?: { transformToByteArray?: () => Promise<Uint8Array> };
            };
            if (!out.Body?.transformToByteArray) throw new Error(`empty object ${key}`);
            return new Uint8Array(await out.Body.transformToByteArray());
        },
        async exists(key: string): Promise<boolean> {
            try {
                await send(new HeadObjectCommand({ Bucket: deps.bucket, Key: key }));
                return true;
            } catch (err) {
                const name = (err as { name?: string }).name;
                if (name === 'NotFound' || name === '404' || name === 'NotFoundError') return false;
                throw err;
            }
        },
        async putPdf(input: { key: string; body: Uint8Array; contentType: string }) {
            await send(new PutObjectCommand({
                Bucket: deps.bucket,
                Key: input.key,
                Body: input.body,
                ContentType: input.contentType,
            }));
            return { key: input.key, url: publicUrl(deps.publicBaseUrl, deps.bucket, input.key) };
        },
    };
}
