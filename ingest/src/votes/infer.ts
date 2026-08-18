import type { ExtractedVote, ParsedMinutes } from './types.ts';

function expandUnanimousVoice(vote: ExtractedVote, minutes: ParsedMinutes): ExtractedVote {
    if (vote.kind !== 'VOICE') return vote;
    if (vote.source === 'inferred') return vote;
    if (!vote.unanimous || vote.outcome !== 'PASSED') return vote;
    if (vote.members.length > 0) return vote;
    if (vote.nayCount > 0 || vote.abstainCount > 0) return vote;
    if (minutes.attendance.length === 0) return vote;
    const members = minutes.attendance.map((row) => ({
        lastName: row.lastName,
        voteType: 'FOR' as const,
    }));
    return {
        ...vote,
        source: 'inferred',
        members,
        yayCount: vote.yayCount > 0 ? vote.yayCount : members.length,
    };
}

export function inferUnanimousVoice(minutes: ParsedMinutes): ParsedMinutes {
    return {
        ...minutes,
        votes: minutes.votes.map((vote) => expandUnanimousVoice(vote, minutes)),
    };
}
