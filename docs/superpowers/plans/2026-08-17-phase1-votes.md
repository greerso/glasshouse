# Glasshouse Phase 1 Minutes Vote Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract votes from already-mirrored ChampDS minutes PDFs and write `SubjectVote` + `MeetingAttendance` (plus `SubjectVoteResult` for nameless voice outcomes) so Thompson's Station subject pages show real tallies.

**Architecture:** Ingest owns the pass. After a minutes-like PDF is mirrored, `pdftotext -layout` plus a last-name roster regex parse it, resolve the meeting the minutes *document* (date in nickname/title — not the meeting that attached the file), match or create subjects, and `POST` service-auth votes. Web stores rows with `DataSource.decision` (named roll-call / written outcome) or `DataSource.inferred` (unanimous-voice expansion) and `reviewStatus unreviewed|approved`. No Anthropic, no `pollDecisions.ts`, no transcript path.

**Tech Stack:** TypeScript; ingest Node `^20.11.1` + `node:test` + `poppler-utils` (`pdftotext`); web Node `>=24.15.0 <25` + Prisma + Jest + next-intl. Ingest still has no Prisma and never opens Postgres.

**Spec:** docs/superpowers/specs/2026-08-16-glasshouse-design.md

## Global Constraints

- Fork discipline: every web change is a minimal isolated commit on branch `glasshouse` in `/Users/greer/dev/glasshouse-web`; upstream remains `upstream`; never rewrite upstream history.
- Ingest lives as `ingest/` in this ops repo. Talks to web only over HTTP (`ServiceApiKey` Bearer). SQL writes from ingest are forbidden.
- Node: web `>=24.15.0 <25`; ingest `^20.11.1`. Do not "upgrade" either.
- Openship v0.5.0: one project `proj_5AhrGz_cRgruBEi7`, one compose file, no `networks:` keys, no compose `profiles:`, commands are exec-form arrays only, set via `service sync` never `service update --command`.
- **No `service sync` without both `WEB_IMAGE` and `INGEST_IMAGE` set** in thinkstation `/data/openship/projects/glasshouse/.env`. Prebuilt images only. Ingest-only or web-only deploys have dropped `openship-glasshouse-db` before — restore from `openship-glasshouse-pgdata` if that happens.
- Never enable compose service `tasks`. Do not call `requestTranscribe` or `src/lib/tasks/pollDecisions.ts`.
- Do not invent keys. Do not flip `NEXTAUTH_URL`.
- Secrets stay in Openship env and untracked `.env*` files. Nothing secret is committed.
- Timezone everywhere: `America/Chicago`.
- AGPL: deploy only pushed commits; `NEXT_PUBLIC_BUILD_COMMIT_SHA` must equal the deployed web HEAD.
- Do not invent `DataSource.minutes`. Official written minutes = `decision`. `inferred` is only the unanimous-voice expansion.
- BOMA first. Same parser may run on other bodies; a PDF with no `Yay Votes` / `motion carried` / `motion passed` / `motion failed` lines is skipped, not a failed ingest cycle.
- ChampDS minutes often live on the *next* meeting's consent attachments. Votes apply to the meeting the minutes document.
- Backfill votes publish immediately with per-row **"machine-extracted, not yet human-reviewed"**. Ongoing review-before-publish is later admin UI; this plan only adds the badge + an admin toggle to mark reviewed.
- Read `DATABASE_URL` before any Prisma command — if it contains `production`, stop.

## Rulings (spec gaps locked here)

1. **No Anthropic / no transcript.** Regex + last-name roster on `pdftotext -layout` output. Proven on `docs/research/minutes/2026-06-09-boma.pdf`.
2. **`DataSource.inferred`** only for the unanimous-voice + recorded-attendance expansion (per-member FOR). Named Yay/Nay/Abstain → `decision`. Outcome-only voice (non-unanimous, no names) → `SubjectVoteResult` with `source=decision` and **zero** `SubjectVote` rows.
3. **`SubjectVoteResult` is required.** `SubjectVote.personId` is non-null, so a nameless voice outcome cannot be a `SubjectVote`. One row per subject: outcome, counts, `kind` (`ROLL_CALL` | `VOICE`), `source`, `reviewStatus`, `motionText`. Named roll-calls write this *and* per-member `SubjectVote` rows. Do not reuse `Decision` (Diavgeia) or `pollDecisions.ts`.
4. **`reviewStatus` on `SubjectVote`, `MeetingAttendance`, and `SubjectVoteResult`:** `unreviewed | approved`, default `unreviewed`. Re-upsert of the same `voteType`/`status`/`counts` **preserves** `reviewStatus`. A changed `voteType`/`status`/`counts` resets it to `unreviewed`.
5. **One extracted vote block = one subject.** `@@unique([subjectId, personId, source])` cannot store an amendment and the main motion on the same subject. Amendments always create an `outOfAgenda` subject named `Amendment: {ordinance or truncated motion}`. Consent agenda one motion → one subject (the parent Consent Agenda item, never the children).
6. **Subject match.** Ordinance/resolution number (normalize en-dash/em-dash to `-`) wins if exactly one non-hearing subject matches. If several share the number, prefer a name matching `/consideration|reading|ordinance|resolution/i` that does **not** match `/public hearing/i`. Title overlap is a fallback (see Task 3). Zero or still-ambiguous → create `outOfAgenda` from the motion line. Never guess.
7. **Public tallies.** `subject.tsx` currently hides `VotingSection` behind `options.editsAllowed`. Extracted votes (`subject.votes.length > 0` or a `voteResult` row) render for everyone, `defaultOpen={true}`. The utterance-only fallback stays admin-gated.
8. **Attendance** is meeting-level `MeetingAttendance` with `source=decision`. Do not write `SubjectAttendance`. Pass meeting attendance into `VotingSection` for the absent-members row.
9. **Ingest skip condition** today is "event hash known AND all media observed" — that would skip event 390 forever and never extract the already-mirrored June 9 PDF. After this plan, skip only when those are true **and** every minutes-like attachment has a `champds:votes:{mediaId}` observation whose hash is `1:{sha256(text)}` (parser version `1`).
10. **`event.Minutes.Attachments`** are minutes-like even without `minute` in the nickname. Mirror them the same way as agenda PDFs, then extract. Dedup by `CustomerMediaID`.
11. **Do not fail the ingest event** if extract throws or the documented meeting is not ingested yet. Log and retry next cycle (no vote observation written). A PDF with no vote/voice lines writes the observation with the text hash so we do not re-parse forever.
12. **Admin approve** is meeting-scoped `PATCH` with a **user session** (superadmin, same check as `subjects/[subjectId]`). Service keys may POST votes; they may not mark reviewed.
13. **Stable out-of-agenda names** so re-runs do not duplicate: `Amendment: Ordinance 2026-014` when an ordinance number exists; otherwise `Amendment: {first 80 chars of motion}`; non-amendment fallback is the normalized motion line truncated to 200.
14. **Unknown / ambiguous last names** are dropped. Counts on `SubjectVoteResult` still come from the printed `N-Yay` / `N-Nay` / `N-Abstain` numbers. Never invent a person.
15. **June 9 fixture is the contract.** File `docs/research/minutes/2026-06-09-boma.txt` is the `pdftotext -layout` of `docs/research/minutes/2026-06-09-boma.pdf`, minutes of June 9, 2026 BOMA (`champds-377`), attached to Aug 11 (`aug11_2026`) consent item `BOMA Minutes 6_9_2026`. Ten vote blocks (listed in Task 2). Seed last names:
    - Stover → `thompsons-station-brian-stover`
    - Alexander → `thompsons-station-shaun-alexander`
    - King → `thompsons-station-harry-king`
    - White → `thompsons-station-kreis-white`
    - Whitmer → `thompsons-station-bob-whitmer`

## File structure

**glasshouse-web** (fork branch `glasshouse`):

| File | Role |
|---|---|
| `prisma/schema.prisma` | `DataSource.inferred`, `ReviewStatus`, `VoteOutcome`, `VoteKind`, `reviewStatus` columns, `SubjectVoteResult` |
| `prisma/migrations/<ts>_add_inferred_review_status_vote_result/migration.sql` | `--create-only` then fill |
| `src/lib/zod-schemas/ingestSubject.ts` | allow `nonAgendaReason` out-of-agenda upsert |
| `src/lib/zod-schemas/minutesVotes.ts` | POST votes body + PATCH review body |
| `src/lib/db/subjects-ingest.ts` | upsert out-of-agenda by `(name, nonAgendaReason)` |
| `src/lib/db/minutes-votes.ts` | upsert attendance / result / votes; approve meeting |
| `src/app/api/cities/[cityId]/meetings/[meetingId]/votes/route.ts` | `POST` service-or-user; `PATCH` user-only |
| `src/lib/db/subject.ts` | include `source`, `reviewStatus`, `voteResult` |
| `src/lib/db/decisions.ts` | `getMeetingAttendance` select grows roles + reviewStatus |
| `src/lib/getMeetingData.ts` | attach `meetingAttendance` |
| `src/components/meetings/subject/VotingSection.tsx` | badges + outcome-only + approve |
| `src/components/meetings/subject/subject.tsx` | public card when extracted votes exist |
| `messages/{en,el,fr,sr}.json` | new `Subject.*` strings |

**glasshouse ops repo:**

| File | Role |
|---|---|
| `ingest/Dockerfile` | install `poppler-utils` in the runtime stage |
| `ingest/src/votes/types.ts` | parser / apply types; `MINUTES_PARSER_VERSION = '1'` |
| `ingest/src/votes/parse.ts` | attendance + roll-call + voice regex |
| `ingest/src/votes/roster.ts` | last-name → personId |
| `ingest/src/votes/infer.ts` | unanimous voice → per-member FOR / `inferred` |
| `ingest/src/votes/date.ts` | nickname/PDF date + Chicago day bounds |
| `ingest/src/votes/resolve.ts` | minutes PDF → documented meeting id |
| `ingest/src/votes/match.ts` | vote block → existing subject or create-spec |
| `ingest/src/votes/pdftext.ts` | `pdftotext -layout` wrapper |
| `ingest/src/votes/apply.ts` | parse → resolve → match → POST |
| `ingest/src/oc/client.ts` | `listMeetings`, `getPeople`, `upsertVotes` |
| `ingest/src/minio/mirror.ts` | `get(key)` for already-mirrored PDFs |
| `ingest/src/orchestrate.ts` | mirror Minutes slot; hook extract after minutes PDF |
| `docs/RUNBOOK.md` | rebuild + extract June 9 + verify LAN |

The complete checkbox steps, tests, implementation code, and per-task commits for Tasks 1–7 are the remainder of this file (same bodies as the writing-plans draft). Do not implement from a session scratch copy.

---

### Task 1: Prisma — `inferred`, `reviewStatus`, `SubjectVoteResult`

**Files:**
- Modify: `/Users/greer/dev/glasshouse-web/prisma/schema.prisma` (`Subject` ~508, `MeetingAttendance` ~578, `SubjectVote` ~604, `DataSource` ~637)
- Create: `/Users/greer/dev/glasshouse-web/prisma/migrations/<timestamp>_add_inferred_review_status_vote_result/migration.sql` (via `prisma migrate dev --create-only`)
- Create: `/Users/greer/dev/glasshouse-web/src/lib/db/__tests__/minutes-schema.test.ts`

**Interfaces:**
- Consumes: existing `SubjectVote`, `MeetingAttendance`, `DataSource`.
- Produces: `DataSource.inferred`; `ReviewStatus`; `VoteOutcome`; `VoteKind`; `Subject.voteResult`; `reviewStatus` default `unreviewed` on vote and attendance rows.

Work in `/Users/greer/dev/glasshouse-web` on branch `glasshouse`. Read `DATABASE_URL` first — if it contains `production`, stop.

- [ ] **Step 1: Write the failing enum test**

```typescript
// src/lib/db/__tests__/minutes-schema.test.ts
import { DataSource, ReviewStatus, VoteKind, VoteOutcome } from '@prisma/client';

describe('minutes vote schema', () => {
    it('adds inferred to DataSource', () => {
        expect(DataSource.inferred).toBe('inferred');
        expect(DataSource.decision).toBe('decision');
    });

    it('adds ReviewStatus, VoteOutcome, VoteKind', () => {
        expect(ReviewStatus.unreviewed).toBe('unreviewed');
        expect(ReviewStatus.approved).toBe('approved');
        expect(VoteOutcome.PASSED).toBe('PASSED');
        expect(VoteOutcome.FAILED).toBe('FAILED');
        expect(VoteKind.ROLL_CALL).toBe('ROLL_CALL');
        expect(VoteKind.VOICE).toBe('VOICE');
    });
});
```

- [ ] **Step 2: Run the test — expect FAIL** (`inferred` / `ReviewStatus` missing from the generated client)

Run: `npm test -- src/lib/db/__tests__/minutes-schema.test.ts`

- [ ] **Step 3: Edit the schema**

On `Subject` (after `votes SubjectVote[]`):

```prisma
  voteResult SubjectVoteResult?
```

On `MeetingAttendance` and `SubjectVote`, add:

```prisma
  reviewStatus ReviewStatus @default(unreviewed)
```

Replace `enum DataSource` and append the new enums + model immediately after it:

```prisma
enum DataSource {
  decision    // Official written record (Diavgeia decision PDF *or* minutes PDF)
  transcript  // Derived from transcript analysis
  manual      // Manually entered by admin
  inferred    // Unanimous voice vote expanded from recorded attendance
}

enum ReviewStatus {
  unreviewed
  approved
}

enum VoteOutcome {
  PASSED
  FAILED
}

enum VoteKind {
  ROLL_CALL
  VOICE
}

model SubjectVoteResult {
  id           String       @id @default(cuid())
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  subject      Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  subjectId    String       @unique
  outcome      VoteOutcome
  yayCount     Int
  nayCount     Int
  abstainCount Int          @default(0)
  kind         VoteKind
  motionText   String?
  source       DataSource
  reviewStatus ReviewStatus @default(unreviewed)

  @@index([subjectId])
}
```

Do **not** add `DataSource.minutes`.

- [ ] **Step 4: Create the migration**

```bash
cd /Users/greer/dev/glasshouse-web
npx prisma migrate dev --create-only --name add_inferred_review_status_vote_result
```

Fill `migration.sql` as:

```sql
-- AlterEnum
ALTER TYPE "DataSource" ADD VALUE 'inferred';

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('unreviewed', 'approved');
CREATE TYPE "VoteOutcome" AS ENUM ('PASSED', 'FAILED');
CREATE TYPE "VoteKind" AS ENUM ('ROLL_CALL', 'VOICE');

-- AlterTable
ALTER TABLE "SubjectVote" ADD COLUMN "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'unreviewed';
ALTER TABLE "MeetingAttendance" ADD COLUMN "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'unreviewed';

-- CreateTable
CREATE TABLE "SubjectVoteResult" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "outcome" "VoteOutcome" NOT NULL,
    "yayCount" INTEGER NOT NULL,
    "nayCount" INTEGER NOT NULL,
    "abstainCount" INTEGER NOT NULL DEFAULT 0,
    "kind" "VoteKind" NOT NULL,
    "motionText" TEXT,
    "source" "DataSource" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'unreviewed',
    CONSTRAINT "SubjectVoteResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubjectVoteResult_subjectId_key" ON "SubjectVoteResult"("subjectId");
CREATE INDEX "SubjectVoteResult_subjectId_idx" ON "SubjectVoteResult"("subjectId");

ALTER TABLE "SubjectVoteResult"
  ADD CONSTRAINT "SubjectVoteResult_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

PostgreSQL cannot *use* a newly added enum value in the same transaction. This file only *adds* `'inferred'`; it does not write a row with that value. Do not split unless `migrate dev` errors.

- [ ] **Step 5: Apply + generate, re-run the test — expect PASS**

```bash
npx prisma migrate dev
npx prisma generate
npm test -- src/lib/db/__tests__/minutes-schema.test.ts
```

- [ ] **Step 6: Commit** (web fork)

```bash
cd /Users/greer/dev/glasshouse-web
git add prisma/schema.prisma prisma/migrations src/lib/db/__tests__/minutes-schema.test.ts
git commit -m "feat: add inferred DataSource, reviewStatus, and SubjectVoteResult"
```

---

### Task 2: Minutes parser, roster, inference — June 9 fixture

**Files:**
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/types.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/parse.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/parse.test.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/roster.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/roster.test.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/infer.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/infer.test.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/date.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/date.test.ts`

**Interfaces:**
- Consumes: fixture text at `docs/research/minutes/2026-06-09-boma.txt` (verbatim). No PDF, no network.
- Produces: `MINUTES_PARSER_VERSION = '1'`; `parseMinutesText(text) → ParsedMinutes`; `isMinutesLike`; `dateFromMinutesLabel`; `matchLastName`; `inferUnanimousVoice`.

- [ ] **Step 1: Write the failing parser, roster, infer, and date tests** in the files listed above. Use the exact test bodies from the writing-plans draft (June 9 fixture = 10 vote blocks, consent 5-0, tax amendment 2-3, Sarah Benson amendment 3-1-1 with White ABSTAIN, seed last-name map, unanimous-voice inference, Chicago CDT/CST bounds). Do not paste or edit the fixture `.txt`.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /Users/greer/dev/glasshouse/ingest && npx tsx --test src/votes/*.test.ts`

- [ ] **Step 3: Implement** `types.ts`, `parse.ts`, `roster.ts`, `infer.ts`, `date.ts` per the draft:
  - Roll-call regex: `The (amended |main amended )?motion (passed|failed) with the following vote:` + `N-Yay` / `N-Nay` / optional `N-Abstain`.
  - Attendance from `Members and staff attending were` through `, Town Administrator`.
  - `main amended motion` is not an amendment. En-dash ordinances normalize to `2026-014`.
  - Voice-only only when the next 200 chars lack `Yay Votes`.
  - `inferUnanimousVoice` is the only writer of `source: 'inferred'`.
  - `chicagoDayBoundsIso` via `Intl` `America/Chicago`. No extra npm deps.

- [ ] **Step 4: Re-run — expect PASS.** If a fixture assertion fails, fix the parser, not the fixture.

- [ ] **Step 5: Commit**

```bash
cd /Users/greer/dev/glasshouse
git add ingest/src/votes
git commit -m "feat(ingest): parse BOMA minutes roll-call and voice votes"
```

---

### Task 3: Minutes PDF → documented meeting + subject match

**Files:**
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/resolve.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/resolve.test.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/match.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/votes/match.test.ts`

**Interfaces:**
- Produces: `resolveMinutesMeeting` → `{ meetingId }` or `{ skip }`; `matchSubject` → existing id or `{ type: 'create', name, nonAgendaReason: 'outOfAgenda' }`; `outOfAgendaName`.

- [ ] **Step 1: Write the failing tests** from the draft: Aug 11 consent nickname `BOMA Minutes 6_9_2026` resolves to `champds-377` (from=`2026-06-09T05:00:00.000Z`, to=`2026-06-10T04:59:59.999Z`); empty list → skip; Minutes slot without a date uses the source meeting; two same-day meetings prefer Regular over work session. Match tests: consent parent; ordinance prefers action item over public hearing; amendment never reuses an agenda subject (`Amendment: Ordinance 2026-014`); Sarah Benson title overlap; no-match creates a stable name.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /Users/greer/dev/glasshouse/ingest && npx tsx --test src/votes/resolve.test.ts src/votes/match.test.ts`

- [ ] **Step 3: Implement** `resolve.ts` and `match.ts` exactly as in the draft (date from nickname then first 800 chars of PDF; filter `administrativeBodyId`; title-overlap tokens with the listed stopwords).

- [ ] **Step 4: Re-run all `src/votes/*.test.ts` — expect PASS**

- [ ] **Step 5: Commit**

```bash
cd /Users/greer/dev/glasshouse
git add ingest/src/votes/resolve.ts ingest/src/votes/resolve.test.ts ingest/src/votes/match.ts ingest/src/votes/match.test.ts
git commit -m "feat(ingest): resolve minutes PDFs to the documented meeting"
```

---

### Task 4: Service-auth votes API + out-of-agenda subjects

**Files:**
- Modify: `/Users/greer/dev/glasshouse-web/src/lib/zod-schemas/ingestSubject.ts` and its test
- Modify: `/Users/greer/dev/glasshouse-web/src/lib/db/subjects-ingest.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/lib/zod-schemas/minutesVotes.ts` + test
- Create: `/Users/greer/dev/glasshouse-web/src/lib/db/minutes-votes.ts` + test
- Create: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/meetings/[meetingId]/votes/route.ts` + test

**Interfaces:**
- `POST .../subjects` accepts `nonAgendaReason` and upserts by `(name, nonAgendaReason)`.
- `POST .../votes` — `withServiceOrUserAuth`, upsert by `(subjectId, personId, source)`.
- `PATCH .../votes` — superadmin session only, `{ reviewStatus: 'approved' }`.
- Do **not** import `pollDecisions.ts`. Reject `source: 'minutes'`.

- [ ] **Step 1: Write the failing Zod, db-helper, and route tests** from the draft (named roll call; empty votes; reject `minutes`; review schema only `approved`; create then preserve `reviewStatus` on same `voteType`; PATCH 403 for service key / 200 for superadmin).

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /Users/greer/dev/glasshouse-web && npm test -- src/lib/zod-schemas/__tests__/minutesVotes.test.ts src/lib/db/__tests__/minutes-votes.test.ts src/app/api/cities/[cityId]/meetings/[meetingId]/votes/__tests__/route.test.ts src/lib/zod-schemas/__tests__/ingestSubject.test.ts`

- [ ] **Step 3: Implement** the union subject schema, out-of-agenda upsert, `minutesVotesBodySchema` / `minutesVotesReviewSchema`, `upsertMinutesVotes` / `approveMeetingVotes`, and `POST`+`PATCH` route as specified in the draft. Preserve `reviewStatus` when `voteType`/`status`/`counts` are unchanged; reset to `unreviewed` when they change.

- [ ] **Step 4: Re-run those tests plus the existing subjects route test — expect PASS**

- [ ] **Step 5: Commit** (web fork)

```bash
cd /Users/greer/dev/glasshouse-web
git add src/lib/zod-schemas src/lib/db/subjects-ingest.ts src/lib/db/minutes-votes.ts src/lib/db/__tests__ src/app/api/cities/[cityId]/meetings/[meetingId]/votes
git commit -m "feat: service-auth minutes votes upsert and admin approve"
```

---

### Task 5: Ingest — pdftotext, hook after minutes PDF, skip non-minutes

**Files:**
- Modify: `ingest/Dockerfile`, `ingest/src/minio/mirror.ts`, `ingest/src/oc/client.ts`, `ingest/src/orchestrate.ts` (+ tests)
- Create: `ingest/src/votes/pdftext.ts`, `apply.ts`, and their tests

**Interfaces:**
- `extractPdfText(bytes)`; `applyMinutesPdf(...)`; `listMeetings` / `getPeople` / `upsertVotes` on the OC client; `mirror.get`; skip only when event hash + all media + all `champds:votes:{mediaId}` observations exist.

- [ ] **Step 1: Write failing apply + orchestrate + pdftext tests** from the draft. June 9 text attached to Aug 11 must POST **10** results to **`champds-377`**, 5 attendance rows, create `Amendment: Ordinance 2026-014`, write `champds:votes:999`. Agenda-only text → `skipped-no-votes` with observation, no votes POST. Event 390 minutes nickname must trigger extract; `Staff Report` must not. Second pass skips only after the votes observation exists.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /Users/greer/dev/glasshouse/ingest && npx tsx --test src/votes/apply.test.ts src/votes/pdftext.test.ts src/orchestrate.test.ts`

- [ ] **Step 3: Implement**
  - Runtime-stage `apt-get install poppler-utils` in `ingest/Dockerfile` (keep the digest pin). No LLM, no new npm deps.
  - `pdftotext -layout file -`.
  - `apply.ts` pipeline: parse → infer → empty-votes observation → resolve (no obs on skip) → match/create subjects → map last names (drop misses) → POST votes → write `1:{sha256(text)}` observation.
  - Orchestrate: also mirror `event.Minutes.Attachments`; extract after minutes-like PDFs inside try/catch (log, do not fail the event).

- [ ] **Step 4: `cd ingest && npm test` — expect PASS**

- [ ] **Step 5: Commit**

```bash
cd /Users/greer/dev/glasshouse
git add ingest/Dockerfile ingest/src
git commit -m "feat(ingest): extract minutes votes after mirroring PDFs"
```

---

### Task 6: VotingSection unreviewed badge + public tallies + admin approve

**Files:**
- Modify: `src/lib/db/subject.ts`, `src/lib/db/decisions.ts`, `src/lib/getMeetingData.ts`, `VotingSection.tsx`, `subject.tsx`, `messages/{en,el,fr,sr}.json`
- Create: `src/lib/utils/voteBadges.ts` + test

- [ ] **Step 1: Write the failing `voteBadgeState` test** from the draft.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /Users/greer/dev/glasshouse-web && npm test -- src/lib/utils/__tests__/voteBadges.test.ts`

- [ ] **Step 3: Implement**
  - `votesInclude` adds `source`, `reviewStatus`; subject includes add `voteResult`.
  - `MeetingDataCore.meetingAttendance` from `getMeetingAttendance` (select roles + `reviewStatus`).
  - Public card when extracted votes exist (`hasExtractedVotes || options.editsAllowed`); `defaultOpen={hasExtractedVotes}`.
  - Outcome-only: counts, no names, `t('voteOutcomeOnly')`.
  - Badges: `voteUnreviewed` = "Machine-extracted, not yet human-reviewed"; `voteInferred` = "Inferred from unanimous voice vote".
  - Superadmin button PATCHes `{ reviewStatus: 'approved' }` then reloads.
  - Add the four keys to `en`, `el`, `fr`, `sr`. Leave Diavgeia strings in place.

- [ ] **Step 4: Re-run the badge test — expect PASS**

- [ ] **Step 5: Commit** (web fork)

```bash
cd /Users/greer/dev/glasshouse-web
git add src/lib/db/subject.ts src/lib/db/decisions.ts src/lib/getMeetingData.ts src/lib/utils/voteBadges.ts src/lib/utils/__tests__/voteBadges.test.ts src/components/meetings/subject/VotingSection.tsx src/components/meetings/subject/subject.tsx messages
git commit -m "feat: show minutes tallies with unreviewed and inferred badges"
```

---

### Task 7: Rebuild web + ingest images, extract June 9 onto champds-377, verify LAN

**Files:**
- Modify: `/Users/greer/dev/glasshouse/docs/RUNBOOK.md` (append `## Phase 1 — minutes vote extraction`)

- [ ] **Step 1: Append the runbook section** from the draft: rebuild web (`prisma migrate deploy` in entrypoint), rebuild ingest (`pdftotext -v`), `grep` both `WEB_IMAGE` and `INGEST_IMAGE` before `service sync`, restore db from `openship-glasshouse-pgdata` if dropped, `docker exec … node dist/index.js --once`, LAN curl of `champds-377`, idempotency SQL count.

- [ ] **Step 2: Push both repos, set both image env vars, sync, deploy web then ingest, run `--once`.** Do not invent keys, flip `NEXTAUTH_URL`, or enable `tasks`.

- [ ] **Step 3: Verify LAN tallies**
  - ≥10 `voteResult` rows (8 agenda + 2 amendments), 5 PRESENT attendance.
  - `Amendment: Ordinance 2026-014` = 2 FOR (King, White), 3 AGAINST (Alexander, Stover, Whitmer).
  - Sarah Benson amendment = 3 FOR (Alexander, Stover, Whitmer), 1 AGAINST (King), 1 ABSTAIN (White).
  - Others 5-0 named.
  - Badge visible. Second `--once` does not increase `SubjectVote` count.
  - If `champds-377` 404s or extract skips `meeting-not-ingested`, ingest June 9 first. Do not `psql`-insert votes.

- [ ] **Step 4: Commit**

```bash
cd /Users/greer/dev/glasshouse
git add docs/RUNBOOK.md
git commit -m "docs: minutes vote extraction rebuild and June 9 verify"
```

---

## Self-review

**Spec coverage:** roll-call → Tasks 2+5; unanimous voice → Task 2 `inferred`; nameless voice → `SubjectVoteResult` only; unreviewed badge → Task 6; admin approve → Tasks 4+6; no transcript/`pollDecisions`; next-meeting attachment → Tasks 3+5; idempotent June 9 → Tasks 4+5+7; skip empty PDFs → Tasks 2+5; poppler only → Task 5.

**Placeholder scan:** no TBD. Task 2–6 test *bodies* that were already written in the first draft remain the contract — implement those assertions, do not invent weaker ones.

**Type consistency:** `ExtractedVote`, `ParsedMinutes`, `MINUTES_PARSER_VERSION`, `upsertMinutesVotes`, `applyMinutesPdf`, `champds:votes:{mediaId}` are named the same in every task.

**Plan complete and saved to `docs/superpowers/plans/2026-08-17-phase1-votes.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
