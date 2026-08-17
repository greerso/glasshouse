import { BROWSER_UA, createChampdsClient } from './champds/client.ts';
import { loadConfig } from './config.ts';
import { createMirror } from './minio/mirror.ts';
import { createOcClient } from './oc/client.ts';
import { runCycle } from './orchestrate.ts';

async function main() {
    const cfg = loadConfig();
    const champds = createChampdsClient({
        champdsBaseUrl: cfg.champdsBaseUrl,
        requestGapMs: cfg.requestGapMs,
        userAgent: cfg.userAgent || BROWSER_UA,
    });
    const oc = createOcClient({ ocBaseUrl: cfg.ocBaseUrl, ocApiKey: cfg.ocApiKey, cityId: cfg.cityId });
    const mirror = createMirror({
        endpoint: cfg.s3Endpoint,
        region: cfg.s3Region,
        accessKey: cfg.s3AccessKey,
        secretKey: cfg.s3SecretKey,
        bucket: cfg.s3Bucket,
        publicBaseUrl: cfg.publicFilesBaseUrl,
        forcePathStyle: cfg.s3ForcePathStyle,
    });
    const deps = { cfg, champds, oc, mirror, cityId: cfg.cityId, listHashByEvent: new Map<number, string>() };

    const once = process.argv.includes('--once');
    const summary = await runCycle(deps);
    console.log('cycle', summary);
    if (once) return;

    let running = false;
    setInterval(() => {
        if (running) {
            console.log('skip overlapping cycle');
            return;
        }
        running = true;
        runCycle(deps)
            .then((s) => console.log('cycle', s))
            .catch((err) => console.error('cycle failed', err))
            .finally(() => { running = false; });
    }, cfg.pollIntervalMs);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
