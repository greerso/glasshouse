import type {
    ExtractedMemberVote,
    ExtractedVote,
    ParsedAttendance,
    ParsedMinutes,
    VoteOutcome,
} from './types.ts';

// `main ` is required: the plan regex omitted it, but the June 9 fixture has "The main motion passed".
const ROLL_CALL_RE =
    /The (amended |main amended |main )?motion (passed|failed) with the following vote:/gi;
const VOICE_RE =
    /The (amended |main amended |main )?motion (carried(?:\s+unanimously)?|passed|failed)\b/gi;
const MOTION_RE = /\b(?:made a motion|amended the main motion)\b/i;
const DASH = '[\u2010-\u2015\\-]';

function collapseWs(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function parseNames(raw: string): string[] {
    return raw
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
}

function parseBucket(
    tail: string,
    kind: 'Yay' | 'Nay' | 'Abstain',
): { count: number; names: string[] } {
    const re = new RegExp(`(\\d+)\\s*-\\s*${kind}(?:\\s+Votes)?:[ \\t]*([^\\n]*)`, 'i');
    const match = tail.match(re);
    if (!match) return { count: 0, names: [] };
    return { count: Number(match[1]), names: parseNames(match[2]) };
}

function rollCallEnd(headerEnd: number, tail: string): number {
    const countRe = /\d+\s*-\s*(?:Yay|Nay|Abstain)(?:\s+Votes)?:[^\n]*/gi;
    let last = 0;
    for (const match of tail.matchAll(countRe)) {
        last = (match.index ?? 0) + match[0].length;
    }
    return headerEnd + last;
}

function membersFromBuckets(
    yay: string[],
    nay: string[],
    abstain: string[],
): ExtractedMemberVote[] {
    const members: ExtractedMemberVote[] = [];
    for (const lastName of yay) members.push({ lastName, voteType: 'FOR' });
    for (const lastName of nay) members.push({ lastName, voteType: 'AGAINST' });
    for (const lastName of abstain) members.push({ lastName, voteType: 'ABSTAIN' });
    return members;
}

function isAmendmentPrefix(prefix: string | undefined): boolean {
    return (prefix ?? '') === 'amended ';
}

function extractOrdinance(text: string): string | null {
    const match = text.match(new RegExp(`\\b(?:Ordinance|Resolution)\\s+(\\d{4})${DASH}(\\d+)\\b`, 'i'));
    return match ? `${match[1]}-${match[2]}` : null;
}

function motionInWindow(window: string): string {
    const start = window.search(MOTION_RE);
    if (start < 0) return '';
    let body = window.slice(start);
    const stop = body.search(
        /\b(?:The motion was seconded|seconded the|Discussion\b|The (?:amended |main amended |main )?motion (?:passed|failed|carried))/i,
    );
    if (stop > 0) body = body.slice(0, stop);
    return collapseWs(body).replace(/[.,;:]+$/, '');
}

function parseAttendance(text: string): ParsedAttendance[] {
    const start = text.search(/Members and staff attending were/i);
    if (start < 0) return [];
    const after = text.slice(start).replace(/Members and staff attending were/i, '');
    const end = after.search(/,\s*Town Administrator/i);
    if (end < 0) return [];
    const span = collapseWs(after.slice(0, end))
        .replace(/\bVice Mayor\b/gi, '')
        .replace(/\bMayor\b/gi, '')
        .replace(/\bAldermen\b/gi, '')
        .replace(/\bAlderman\b/gi, '')
        .replace(/\band\b/gi, ',');
    return span
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((full) => {
            const bits = full.split(/\s+/).filter(Boolean);
            return { lastName: bits[bits.length - 1], status: 'PRESENT' as const };
        });
}

type LocatedVote = { index: number; end: number; vote: ExtractedVote };

function parseRollCalls(text: string): LocatedVote[] {
    const out: LocatedVote[] = [];
    for (const match of text.matchAll(ROLL_CALL_RE)) {
        const index = match.index ?? 0;
        const tail = text.slice(index + match[0].length, index + match[0].length + 400);
        const yay = parseBucket(tail, 'Yay');
        const nay = parseBucket(tail, 'Nay');
        const abstain = parseBucket(tail, 'Abstain');
        const outcome: VoteOutcome = match[2].toLowerCase() === 'passed' ? 'PASSED' : 'FAILED';
        const end = rollCallEnd(index + match[0].length, tail);
        out.push({
            index,
            end,
            vote: {
                motionText: '',
                ordinanceNumber: null,
                isAmendment: isAmendmentPrefix(match[1]),
                outcome,
                kind: 'ROLL_CALL',
                yayCount: yay.count,
                nayCount: nay.count,
                abstainCount: abstain.count,
                members: membersFromBuckets(yay.names, nay.names, abstain.names),
                source: 'decision',
                unanimous: outcome === 'PASSED' && nay.count === 0 && abstain.count === 0,
            },
        });
    }
    return out;
}

function parseVoiceVotes(text: string, rollStarts: Set<number>): LocatedVote[] {
    const out: LocatedVote[] = [];
    for (const match of text.matchAll(VOICE_RE)) {
        const index = match.index ?? 0;
        if (rollStarts.has(index)) continue;
        const after = text.slice(index + match[0].length, index + match[0].length + 200);
        if (/Yay Votes/i.test(after)) continue;
        const verb = match[2].toLowerCase();
        const failed = verb === 'failed';
        const unanimous = /unanimously/i.test(verb);
        out.push({
            index,
            end: index + match[0].length,
            vote: {
                motionText: collapseWs(match[0]),
                ordinanceNumber: null,
                isAmendment: isAmendmentPrefix(match[1]),
                outcome: failed ? 'FAILED' : 'PASSED',
                kind: 'VOICE',
                yayCount: 0,
                nayCount: 0,
                abstainCount: 0,
                members: [],
                source: 'decision',
                unanimous,
            },
        });
    }
    return out;
}

function attachMotions(text: string, located: LocatedVote[]): ExtractedVote[] {
    const ordered = [...located].sort((a, b) => a.index - b.index);
    return ordered.map((item, i) => {
        const windowStart = i === 0 ? 0 : ordered[i - 1].end;
        const window = text.slice(windowStart, item.index);
        const motionText = motionInWindow(window) || item.vote.motionText;
        return {
            ...item.vote,
            motionText,
            ordinanceNumber: extractOrdinance(motionText) ?? extractOrdinance(window),
        };
    });
}

export function isMinutesLike(text: string): boolean {
    return /Yay Votes|motion carried|motion passed|motion failed/i.test(text);
}

export function parseMinutesText(text: string): ParsedMinutes {
    const roll = parseRollCalls(text);
    const voice = parseVoiceVotes(text, new Set(roll.map((r) => r.index)));
    return {
        attendance: parseAttendance(text),
        votes: attachMotions(text, [...roll, ...voice]),
    };
}
