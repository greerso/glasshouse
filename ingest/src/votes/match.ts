import type { ExtractedVote } from './types.ts';

export type MatchableSubject = {
    id: string;
    name: string;
};

export type MatchSubjectResult =
    | { type: 'existing'; subjectId: string }
    | { type: 'create'; name: string; nonAgendaReason: 'outOfAgenda' };

type VoteNameFields = Pick<ExtractedVote, 'motionText' | 'ordinanceNumber' | 'isAmendment'>;

export const TITLE_OVERLAP_STOPWORDS: ReadonlySet<string> = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'of',
    'to',
    'for',
    'in',
    'on',
    'at',
    'by',
    'from',
    'with',
    'as',
    'is',
    'be',
    'this',
    'that',
    'said',
    'made',
    'motion',
    'approve',
    'approval',
    'approved',
    'consideration',
    'reading',
    '1st',
    '2nd',
    '3rd',
    'first',
    'second',
    'third',
    'ordinance',
    'resolution',
]);

const DASH = /[\u2010-\u2015]/g;

function collapseWs(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function normalizeDashes(text: string): string {
    return text.replace(DASH, '-');
}

function isPublicHearing(name: string): boolean {
    return /public hearing/i.test(name);
}

function isActionTitle(name: string): boolean {
    return /consideration|reading|ordinance|resolution/i.test(name) && !isPublicHearing(name);
}

function nameHasOrdinance(name: string, ordinanceNumber: string): boolean {
    return normalizeDashes(name).includes(ordinanceNumber);
}

export function outOfAgendaName(vote: VoteNameFields): string {
    const motion = collapseWs(vote.motionText);
    if (vote.isAmendment) {
        if (vote.ordinanceNumber) return `Amendment: Ordinance ${vote.ordinanceNumber}`;
        return `Amendment: ${motion.slice(0, 80)}`;
    }
    return motion.slice(0, 200);
}

function createOutOfAgenda(vote: VoteNameFields): MatchSubjectResult {
    return { type: 'create', name: outOfAgendaName(vote), nonAgendaReason: 'outOfAgenda' };
}

function existing(subjectId: string): MatchSubjectResult {
    return { type: 'existing', subjectId };
}

function pickUnique(subjects: readonly MatchableSubject[]): MatchableSubject | undefined {
    return subjects.length === 1 ? subjects[0] : undefined;
}

function matchConsent(vote: VoteNameFields, subjects: readonly MatchableSubject[]): MatchSubjectResult | undefined {
    if (!/consent agenda/i.test(vote.motionText)) return undefined;
    const parents = subjects.filter((subject) => /^consent agenda\b/i.test(subject.name.trim()));
    const parent = pickUnique(parents);
    return parent ? existing(parent.id) : createOutOfAgenda(vote);
}

function matchOrdinance(vote: VoteNameFields, subjects: readonly MatchableSubject[]): MatchSubjectResult | undefined {
    if (!vote.ordinanceNumber) return undefined;
    const numbered = subjects.filter((subject) => nameHasOrdinance(subject.name, vote.ordinanceNumber!));
    const nonHearing = numbered.filter((subject) => !isPublicHearing(subject.name));
    const only = pickUnique(nonHearing);
    if (only) return existing(only.id);
    const preferred = pickUnique(nonHearing.filter((subject) => isActionTitle(subject.name)));
    return preferred ? existing(preferred.id) : undefined;
}

function tokens(text: string): Set<string> {
    const out = new Set<string>();
    for (const raw of normalizeDashes(text).toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        if (raw.length < 2) continue;
        if (TITLE_OVERLAP_STOPWORDS.has(raw)) continue;
        out.add(raw);
    }
    return out;
}

function overlapScore(a: Set<string>, b: Set<string>): number {
    let n = 0;
    for (const token of a) if (b.has(token)) n += 1;
    return n;
}

function matchTitleOverlap(vote: VoteNameFields, subjects: readonly MatchableSubject[]): MatchSubjectResult | undefined {
    const motionTokens = tokens(vote.motionText);
    if (motionTokens.size === 0) return undefined;
    let best: MatchableSubject[] = [];
    let bestScore = 0;
    for (const subject of subjects) {
        if (isPublicHearing(subject.name)) continue;
        const score = overlapScore(motionTokens, tokens(subject.name));
        if (score < 2) continue;
        if (score > bestScore) {
            bestScore = score;
            best = [subject];
        } else if (score === bestScore) {
            best.push(subject);
        }
    }
    const winner = pickUnique(best);
    return winner ? existing(winner.id) : undefined;
}

export function matchSubject(
    vote: VoteNameFields,
    subjects: readonly MatchableSubject[],
): MatchSubjectResult {
    if (vote.isAmendment) return createOutOfAgenda(vote);
    return matchConsent(vote, subjects)
        ?? matchOrdinance(vote, subjects)
        ?? matchTitleOverlap(vote, subjects)
        ?? createOutOfAgenda(vote);
}
