import { createHash } from 'node:crypto';
import { inferUnanimousVoice } from './infer.ts';
import { matchSubject } from './match.ts';
import { parseMinutesText } from './parse.ts';
import { minutesDayBounds, resolveMinutesMeeting, type ListedMeeting } from './resolve.ts';
import { matchLastName, type RosterPerson } from './roster.ts';
import type { ExtractedVote, VoteKind, VoteOutcome, VoteSource } from './types.ts';
import { MINUTES_PARSER_VERSION } from './types.ts';

export type MinutesVoteRow = {
    personId: string;
    voteType: 'FOR' | 'AGAINST' | 'ABSTAIN';
};

export type MinutesResultRow = {
    subjectId: string;
    outcome: VoteOutcome;
    yayCount: number;
    nayCount: number;
    abstainCount: number;
    kind: VoteKind;
    motionText?: string;
    source: VoteSource;
    votes: MinutesVoteRow[];
};

export type MinutesVotesBody = {
    attendance: { personId: string; status: 'PRESENT' | 'ABSENT'; source: VoteSource }[];
    results: MinutesResultRow[];
};

export type ListedMeetingWithSubjects = ListedMeeting & {
    subjects?: { id: string; name: string }[];
};

export type ApplyMinutesResult =
    | { action: 'applied'; meetingId: string; resultCount: number }
    | { action: 'skipped-no-votes' }
    | { action: 'skipped'; reason: 'meeting-not-ingested' };

export type ApplyMinutesInput = {
    pdfBytes: Uint8Array;
    mediaId: number;
    nickname: string;
    sourceMeetingId: string;
    administrativeBodyId: string;
    fromMinutesSlot?: boolean;
};

export type ApplyMinutesDeps = {
    extractPdfText: (bytes: Uint8Array) => Promise<string>;
    oc: {
        listMeetings(from: string, to: string): Promise<ListedMeetingWithSubjects[]>;
        getPeople(administrativeBodyId: string): Promise<RosterPerson[]>;
        upsertVotes(meetingId: string, body: MinutesVotesBody): Promise<unknown>;
        upsertSubjects(meetingId: string, subjects: unknown[]): Promise<{ id: string; name?: string }[]>;
        upsertObservation(row: { source: string; contentHash: string; meetingId?: string }): Promise<void>;
        getMeeting?(meetingId: string): Promise<ListedMeetingWithSubjects | null>;
    };
};

export function votesObservationHash(text: string): string {
    return `${MINUTES_PARSER_VERSION}:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function votesSource(mediaId: number): string {
    return `champds:votes:${mediaId}`;
}

function resolveMembers(vote: ExtractedVote, roster: readonly RosterPerson[]): MinutesVoteRow[] {
    const out: MinutesVoteRow[] = [];
    for (const member of vote.members) {
        const personId = matchLastName(member.lastName, roster);
        if (personId) out.push({ personId, voteType: member.voteType });
    }
    return out;
}

export async function applyMinutesPdf(
    deps: ApplyMinutesDeps,
    input: ApplyMinutesInput,
): Promise<ApplyMinutesResult> {
    const text = await deps.extractPdfText(input.pdfBytes);
    const parsed = inferUnanimousVoice(parseMinutesText(text));
    const obsHash = votesObservationHash(text);

    if (parsed.votes.length === 0) {
        await deps.oc.upsertObservation({
            source: votesSource(input.mediaId),
            contentHash: obsHash,
            meetingId: input.sourceMeetingId,
        });
        return { action: 'skipped-no-votes' };
    }

    const bounds = minutesDayBounds(input.nickname, text);
    const meetings = bounds ? await deps.oc.listMeetings(bounds.from, bounds.to) : [];
    const resolved = resolveMinutesMeeting({
        nickname: input.nickname,
        pdfText: text,
        sourceMeetingId: input.sourceMeetingId,
        administrativeBodyId: input.administrativeBodyId,
        meetings,
        fromMinutesSlot: input.fromMinutesSlot,
    });
    if ('skip' in resolved) return { action: 'skipped', reason: resolved.skip };

    const meetingId = resolved.meetingId;
    let subjects = meetings.find((meeting) => meeting.id === meetingId)?.subjects ?? [];
    if (subjects.length === 0 && deps.oc.getMeeting) {
        subjects = (await deps.oc.getMeeting(meetingId))?.subjects ?? [];
    }

    const matched = parsed.votes.map((vote) => ({ vote, match: matchSubject(vote, subjects) }));
    const toCreate = matched.flatMap((row) => row.match.type === 'create' ? [row.match] : []);
    const created = toCreate.length > 0
        ? await deps.oc.upsertSubjects(meetingId, toCreate.map((row) => ({
            name: row.name,
            nonAgendaReason: row.nonAgendaReason,
        })))
        : [];

    const roster = await deps.oc.getPeople(input.administrativeBodyId);
    const results: MinutesResultRow[] = matched.map(({ vote, match }) => {
        const subjectId = match.type === 'existing'
            ? match.subjectId
            : created.find((row) => row.name === match.name)?.id;
        if (!subjectId) throw new Error(`minutes subject missing for ${match.type === 'create' ? match.name : 'existing'}`);
        return {
            subjectId,
            outcome: vote.outcome,
            yayCount: vote.yayCount,
            nayCount: vote.nayCount,
            abstainCount: vote.abstainCount,
            kind: vote.kind,
            ...(vote.motionText ? { motionText: vote.motionText } : {}),
            source: vote.source,
            votes: resolveMembers(vote, roster),
        };
    });

    const attendance = [];
    for (const row of parsed.attendance) {
        const personId = matchLastName(row.lastName, roster);
        if (personId) attendance.push({ personId, status: row.status, source: 'decision' as const });
    }

    await deps.oc.upsertVotes(meetingId, { attendance, results });
    await deps.oc.upsertObservation({
        source: votesSource(input.mediaId),
        contentHash: obsHash,
        meetingId,
    });
    return { action: 'applied', meetingId, resultCount: results.length };
}
