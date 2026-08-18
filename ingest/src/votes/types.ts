export const MINUTES_PARSER_VERSION = '1';

export type VoteSource = 'decision' | 'inferred';
export type VoteOutcome = 'PASSED' | 'FAILED';
export type VoteKind = 'ROLL_CALL' | 'VOICE';
export type MemberVoteType = 'FOR' | 'AGAINST' | 'ABSTAIN';

export type ExtractedMemberVote = {
    lastName: string;
    voteType: MemberVoteType;
};

export type ExtractedVote = {
    motionText: string;
    ordinanceNumber: string | null;
    isAmendment: boolean;
    outcome: VoteOutcome;
    kind: VoteKind;
    yayCount: number;
    nayCount: number;
    abstainCount: number;
    members: ExtractedMemberVote[];
    source: VoteSource;
    unanimous: boolean;
};

export type ParsedAttendance = {
    lastName: string;
    status: 'PRESENT';
};

export type ParsedMinutes = {
    votes: ExtractedVote[];
    attendance: ParsedAttendance[];
};
