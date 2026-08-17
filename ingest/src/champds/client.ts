import type { ChampdsAttachment, ChampdsEvent, ChampdsListEvent } from './types.ts';

export const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type ChampdsClientConfig = {
    champdsBaseUrl: string;
    requestGapMs: number;
    userAgent: string;
    fetchImpl?: typeof fetch;
};

export type ChampdsClient = {
    listGroup(groupId: number): Promise<ChampdsListEvent[]>;
    getEvent(eventId: number): Promise<ChampdsEvent>;
    pdfUrl(att: ChampdsAttachment): string;
    downloadPdf(att: ChampdsAttachment): Promise<Uint8Array>;
    probeDirectMp4(mediaPath: string): Promise<string | null>;
};

export function createChampdsClient(cfg: ChampdsClientConfig): ChampdsClient {
    const fetchImpl = cfg.fetchImpl ?? fetch;
    let nextAllowed = 0;

    async function gap(): Promise<void> {
        const wait = nextAllowed - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        nextAllowed = Date.now() + cfg.requestGapMs;
    }

    async function getJson<T>(url: string): Promise<T> {
        await gap();
        const res = await fetchImpl(url, { headers: { 'user-agent': cfg.userAgent } });
        if (!res.ok) throw new Error(`ChampDS ${res.status} ${url}`);
        return res.json() as Promise<T>;
    }

    function pdfUrl(att: ChampdsAttachment): string {
        const name = att.MediaFileName ?? '';
        if (/^https?:\/\//i.test(name)) return name;
        const loc = (att.MediaFileLocation ?? '').replace(/^\/+|\/+$/g, '');
        const file = name.replace(/^\/+/, '');
        return loc
            ? `https://play.champds.com/ATT/thompsonsstationtn/${loc}/${file}`
            : `https://play.champds.com/ATT/thompsonsstationtn/${file}`;
    }

    return {
        listGroup(groupId) {
            return getJson<ChampdsListEvent[]>(
                `${cfg.champdsBaseUrl}/archiveGroupListWithMedia/${groupId}`,
            );
        },
        getEvent(eventId) {
            return getJson<ChampdsEvent>(`${cfg.champdsBaseUrl}/event/${eventId}`);
        },
        pdfUrl,
        async downloadPdf(att) {
            await gap();
            const url = pdfUrl(att);
            const res = await fetchImpl(url, { headers: { 'user-agent': cfg.userAgent } });
            if (!res.ok) throw new Error(`PDF ${res.status} ${url}`);
            return new Uint8Array(await res.arrayBuffer());
        },
        async probeDirectMp4(mediaPath) {
            await gap();
            const url = `https://securestream10.champds.com${mediaPath}`;
            const res = await fetchImpl(url, {
                method: 'HEAD',
                headers: { 'user-agent': cfg.userAgent },
                redirect: 'follow',
            });
            const ct = res.headers.get('content-type') ?? '';
            if (res.ok && ct.startsWith('video/')) return url;
            return null;
        },
    };
}
