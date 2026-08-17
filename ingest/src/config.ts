export type IngestConfig = {
    champdsBaseUrl: string;
    userAgent: string;
    requestGapMs: number;
    pollIntervalMs: number;
    backfillSince: string;
    cityId: string;
    ocBaseUrl: string;
    ocApiKey: string;
    s3Endpoint: string;
    s3Region: string;
    s3AccessKey: string;
    s3SecretKey: string;
    s3Bucket: string;
    s3ForcePathStyle: boolean;
    publicFilesBaseUrl: string;
};

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`missing env ${name}`);
    return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IngestConfig {
    return {
        champdsBaseUrl: env.CHAMPDS_BASE_URL ?? 'https://playapi.champds.com/thompsonsstationtn',
        userAgent: env.CHAMPDS_UA ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        requestGapMs: Number(env.REQUEST_GAP_MS ?? 500),
        pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 900_000),
        backfillSince: env.BACKFILL_SINCE ?? '2022-11-01T00:00:00.000Z',
        cityId: env.OC_CITY_ID ?? 'thompsons-station',
        ocBaseUrl: required('OC_BASE_URL'),
        ocApiKey: required('OC_API_KEY'),
        s3Endpoint: required('S3_ENDPOINT'),
        s3Region: env.S3_REGION ?? 'us-east-1',
        s3AccessKey: required('S3_ACCESS_KEY'),
        s3SecretKey: required('S3_SECRET_KEY'),
        s3Bucket: env.S3_BUCKET ?? 'glasshouse',
        s3ForcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
        publicFilesBaseUrl: env.PUBLIC_FILES_BASE_URL ?? 'http://10.0.0.66:9000',
    };
}
