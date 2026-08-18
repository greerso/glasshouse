import { hashEventDetail, hashEventListRow } from './champds/hash.ts';
import type { ChampdsAttachment, ChampdsEvent, ChampdsListEvent } from './champds/types.ts';
import { CHAMPDS_GROUPS } from './map/groups.ts';
import { EXISTING_MEETING_IDS, mapMeeting, meetingIdForEvent } from './map/meeting.ts';
import { mapSubjects } from './map/subjects.ts';
import { objectKey, publicUrl } from './minio/mirror.ts';
import { requestTranscription } from './transcribe.ts';
import {
    applyMinutesPdf,
    type ApplyMinutesDeps,
    type ApplyMinutesInput,
    type ApplyMinutesResult,
} from './votes/apply.ts';
import { extractPdfText } from './votes/pdftext.ts';

export type IngestResult = {
    meetingId: string;
    action: 'created' | 'updated' | 'skipped';
    subjectCount: number;
};

export type CycleSummary = {
    processed: number;
    skipped: number;
    failed: number;
};

export type IngestEventDeps = {
    oc: ApplyMinutesDeps['oc'] & {
        getObservations(source?: string): Promise<{ source: string; contentHash: string; meetingId?: string | null }[]>;
        createMeeting(payload: Record<string, unknown>): Promise<{ id: string; released: boolean }>;
        putMeeting(meetingId: string, payload: Record<string, unknown>): Promise<void>;
        releaseMeeting(meetingId: string): Promise<void>;
    };
    champds: {
        downloadPdf(att: ChampdsAttachment): Promise<Uint8Array>;
        probeDirectMp4(mediaPath: string): Promise<string | null>;
        pdfUrl(att: ChampdsAttachment): string;
    };
    mirror: {
        exists(key: string): Promise<boolean>;
        putPdf(input: { key: string; body: Uint8Array; contentType: string }): Promise<{ key: string; url: string }>;
        get(key: string): Promise<Uint8Array>;
    };
    cityId: string;
    publicFilesBaseUrl: string;
    s3Bucket: string;
    extractPdfText?: (bytes: Uint8Array) => Promise<string>;
    applyMinutesPdf?: (deps: ApplyMinutesDeps, input: ApplyMinutesInput) => Promise<ApplyMinutesResult>;
};

export type CycleDeps = {
    cfg: {
        backfillSince: string;
        publicFilesBaseUrl: string;
        s3Bucket: string;
    };
    champds: {
        listGroup(groupId: number): Promise<ChampdsListEvent[]>;
        getEvent(eventId: number): Promise<ChampdsEvent>;
        downloadPdf(att: ChampdsAttachment): Promise<Uint8Array>;
        probeDirectMp4(mediaPath: string): Promise<string | null>;
        pdfUrl(att: ChampdsAttachment): string;
    };
    oc: IngestEventDeps['oc'];
    mirror: IngestEventDeps['mirror'];
    cityId: string;
    listHashByEvent: Map<number, string>;
};

function eventInstant(utc: string): number {
    return Date.parse(utc.includes('T') ? utc : utc.replace(' ', 'T') + 'Z');
}

function decodeNick(nick: string): string {
    try {
        return decodeURIComponent(nick);
    } catch {
        return nick;
    }
}

export function isMinutesLikeAttachment(att: ChampdsAttachment, fromMinutesSlot = false): boolean {
    if (fromMinutesSlot) return true;
    return /minute/i.test(decodeNick(att.MediaNickName));
}

export function collectPdfAttachments(event: ChampdsEvent): { att: ChampdsAttachment; fromMinutesSlot: boolean }[] {
    const seen = new Map<number, { att: ChampdsAttachment; fromMinutesSlot: boolean }>();
    for (const subject of mapSubjects(event)) {
        for (const att of subject.attachments) {
            seen.set(att.CustomerMediaID, { att, fromMinutesSlot: false });
        }
    }
    for (const att of event.Minutes?.Attachments ?? []) {
        const prev = seen.get(att.CustomerMediaID);
        seen.set(att.CustomerMediaID, { att: prev?.att ?? att, fromMinutesSlot: true });
    }
    return [...seen.values()];
}

export async function ingestEvent(
    deps: IngestEventDeps,
    input: { event: ChampdsEvent; bodyId: string },
): Promise<IngestResult> {
    const eventId = input.event.Event.CustomerEventID;
    const meetingId = meetingIdForEvent(eventId);
    const detailHash = hashEventDetail(input.event);
    const existing = await deps.oc.getObservations(`champds:event:${eventId}`);
    const mapped = mapSubjects(input.event);
    const pdfs = collectPdfAttachments(input.event);

    const mediaObs = await Promise.all(
        pdfs.map((row) => deps.oc.getObservations(`champds:media:${row.att.CustomerMediaID}`)),
    );
    const allMediaKnown = pdfs.every((_, i) => mediaObs[i].length > 0);
    const minutesLike = pdfs.filter((row) => isMinutesLikeAttachment(row.att, row.fromMinutesSlot));
    const votesObs = await Promise.all(
        minutesLike.map((row) => deps.oc.getObservations(`champds:votes:${row.att.CustomerMediaID}`)),
    );
    const allVotesKnown = minutesLike.every((_, i) => votesObs[i].length > 0);
    if (existing[0]?.contentHash === detailHash && allMediaKnown && allVotesKnown) {
        return { meetingId, action: 'skipped', subjectCount: mapped.length };
    }

    const isKnownExisting = eventId in EXISTING_MEETING_IDS;
    if (!isKnownExisting && existing.length === 0) {
        await deps.oc.createMeeting({ ...mapMeeting(input.event, input.bodyId) });
    }

    const urlsByMediaId = new Map<number, string>();
    const pendingExtract: {
        att: ChampdsAttachment;
        fromMinutesSlot: boolean;
        key: string;
        bytes?: Uint8Array;
    }[] = [];
    for (const { att, fromMinutesSlot } of pdfs) {
        const key = objectKey(deps.cityId, eventId, att);
        const already = await deps.mirror.exists(key);
        let bytes: Uint8Array | undefined;
        const put = already
            ? { key, url: publicUrl(deps.publicFilesBaseUrl, deps.s3Bucket, key) }
            : await deps.mirror.putPdf({
                key,
                body: (bytes = await deps.champds.downloadPdf(att)),
                contentType: 'application/pdf',
            });
        urlsByMediaId.set(att.CustomerMediaID, put.url);
        await deps.oc.upsertObservation({
            source: `champds:media:${att.CustomerMediaID}`,
            contentHash: `${att.MediaFileName}:${att.SizeBytes}`,
            meetingId,
        });
        if (isMinutesLikeAttachment(att, fromMinutesSlot)) {
            pendingExtract.push({ att, fromMinutesSlot, key, bytes });
        }
    }

    if (mapped.length > 0) {
        await deps.oc.upsertSubjects(
            meetingId,
            mapped.map((s) => ({
                name: s.name,
                description: s.description,
                agendaItemIndex: s.agendaItemIndex,
                contextCitationUrls: s.attachments
                    .map((a) => urlsByMediaId.get(a.CustomerMediaID))
                    .filter((u): u is string => Boolean(u)),
            })),
        );
    }

    // After this meeting's subjects exist so same-meeting Minutes can match them.
    const apply = deps.applyMinutesPdf ?? applyMinutesPdf;
    const extract = deps.extractPdfText ?? extractPdfText;
    for (const item of pendingExtract) {
        try {
            await apply({ extractPdfText: extract, oc: deps.oc }, {
                pdfBytes: item.bytes ?? await deps.mirror.get(item.key),
                mediaId: item.att.CustomerMediaID,
                nickname: decodeNick(item.att.MediaNickName),
                sourceMeetingId: meetingId,
                administrativeBodyId: input.bodyId,
                fromMinutesSlot: item.fromMinutesSlot,
            });
        } catch (err) {
            console.error(`extract votes media ${item.att.CustomerMediaID} failed`, err);
        }
    }

    const firstPdf = mapped.flatMap((s) => s.attachments)[0];
    const agendaUrl = firstPdf ? urlsByMediaId.get(firstPdf.CustomerMediaID) : undefined;
    if (firstPdf && agendaUrl) {
        await deps.oc.putMeeting(meetingId, {
            ...mapMeeting(input.event, input.bodyId),
            agendaUrl,
        });
    }

    if (!isKnownExisting) {
        await deps.oc.releaseMeeting(meetingId);
    }

    await deps.oc.upsertObservation({
        source: `champds:event:${eventId}`,
        contentHash: detailHash,
        meetingId,
    });

    const skipped = requestTranscription();
    console.log(`transcribe ${meetingId}: skipped (${skipped.reason})`);

    return {
        meetingId,
        action: existing.length ? 'updated' : 'created',
        subjectCount: mapped.length,
    };
}

export async function runCycle(deps: CycleDeps): Promise<CycleSummary> {
    const sinceMs = eventInstant(deps.cfg.backfillSince);
    const observations = await deps.oc.getObservations();
    const observedEvents = new Set(
        observations
            .filter((o) => o.source.startsWith('champds:event:'))
            .map((o) => o.source.slice('champds:event:'.length)),
    );

    const summary: CycleSummary = { processed: 0, skipped: 0, failed: 0 };

    for (const group of CHAMPDS_GROUPS) {
        const rows = (await deps.champds.listGroup(group.archiveGroupId))
            .filter((row) => eventInstant(row.EventDateTimeUTC) >= sinceMs)
            .sort((a, b) => eventInstant(b.EventDateTimeUTC) - eventInstant(a.EventDateTimeUTC));

        for (const row of rows) {
            const eventId = row.CustomerEventID;
            const listHash = hashEventListRow(row);
            const prev = deps.listHashByEvent.get(eventId);
            const hasObs = observedEvents.has(String(eventId));
            const hashChanged = prev !== undefined && prev !== listHash;

            if (hasObs && !hashChanged) {
                deps.listHashByEvent.set(eventId, listHash);
                summary.skipped += 1;
                continue;
            }

            try {
                const event = await deps.champds.getEvent(eventId);
                const result = await ingestEvent({
                    oc: deps.oc,
                    champds: deps.champds,
                    mirror: deps.mirror,
                    cityId: deps.cityId,
                    publicFilesBaseUrl: deps.cfg.publicFilesBaseUrl,
                    s3Bucket: deps.cfg.s3Bucket,
                }, { event, bodyId: group.bodyId });
                deps.listHashByEvent.set(eventId, listHash);
                if (result.action === 'skipped') summary.skipped += 1;
                else summary.processed += 1;
            } catch (err) {
                console.error(`ingest event ${eventId} failed`, err);
                summary.failed += 1;
            }
        }
    }

    return summary;
}
