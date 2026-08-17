import { hashEventDetail, hashEventListRow } from './champds/hash.ts';
import type { ChampdsAttachment, ChampdsEvent, ChampdsListEvent } from './champds/types.ts';
import { CHAMPDS_GROUPS } from './map/groups.ts';
import { EXISTING_MEETING_IDS, mapMeeting, meetingIdForEvent } from './map/meeting.ts';
import { mapSubjects } from './map/subjects.ts';
import { objectKey, publicUrl } from './minio/mirror.ts';
import { requestTranscription } from './transcribe.ts';

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
    oc: {
        getObservations(source?: string): Promise<{ source: string; contentHash: string; meetingId?: string | null }[]>;
        upsertObservation(row: { source: string; contentHash: string; meetingId?: string }): Promise<void>;
        createMeeting(payload: Record<string, unknown>): Promise<{ id: string; released: boolean }>;
        putMeeting(meetingId: string, payload: Record<string, unknown>): Promise<void>;
        upsertSubjects(meetingId: string, subjects: unknown[]): Promise<unknown[]>;
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
    };
    cityId: string;
    publicFilesBaseUrl: string;
    s3Bucket: string;
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

export async function ingestEvent(
    deps: IngestEventDeps,
    input: { event: ChampdsEvent; bodyId: string },
): Promise<IngestResult> {
    const eventId = input.event.Event.CustomerEventID;
    const meetingId = meetingIdForEvent(eventId);
    const detailHash = hashEventDetail(input.event);
    const existing = await deps.oc.getObservations(`champds:event:${eventId}`);
    const mapped = mapSubjects(input.event);
    const attachments = mapped.flatMap((s) => s.attachments);

    const mediaObs = await Promise.all(
        attachments.map((a) => deps.oc.getObservations(`champds:media:${a.CustomerMediaID}`)),
    );
    const allMediaKnown = attachments.every((_, i) => mediaObs[i].length > 0);
    if (existing[0]?.contentHash === detailHash && allMediaKnown) {
        return { meetingId, action: 'skipped', subjectCount: mapped.length };
    }

    const isKnownExisting = eventId in EXISTING_MEETING_IDS;
    if (!isKnownExisting && existing.length === 0) {
        await deps.oc.createMeeting({ ...mapMeeting(input.event, input.bodyId) });
    }

    const urlsByMediaId = new Map<number, string>();
    for (const att of attachments) {
        const key = objectKey(deps.cityId, eventId, att);
        const already = await deps.mirror.exists(key);
        const put = already
            ? { key, url: publicUrl(deps.publicFilesBaseUrl, deps.s3Bucket, key) }
            : await deps.mirror.putPdf({
                key,
                body: await deps.champds.downloadPdf(att),
                contentType: 'application/pdf',
            });
        urlsByMediaId.set(att.CustomerMediaID, put.url);
        await deps.oc.upsertObservation({
            source: `champds:media:${att.CustomerMediaID}`,
            contentHash: `${att.MediaFileName}:${att.SizeBytes}`,
            meetingId,
        });
    }

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
