# Glasshouse — Elections stub + vote feed

**Parent:** `docs/superpowers/specs/2026-08-16-glasshouse-design.md`  
**Approved decisions (chat, 2026-08-18):** ship both; elections first; seats-only candidate block until WCEC publishes names; civic feed (not a social network); upcoming items are agendas, not “upcoming votes.”  
**Status:** draft for user review (critical-assessment findings applied 2026-08-18)

## Goal

Give Thompson’s Station residents two public surfaces they can use without opening a meeting archive:

1. **Elections** — what is on the 3 November 2026 municipal ballot, from Williamson County Election Commission (WCEC) records only.
2. **Votes** — a reverse-chronological log of recorded votes plus posted agendas that have not been voted yet, with shareable filters and a pairwise agreement view.

Ship order is elections stub, then the vote feed. Both are `glasshouse-web` only. No new ingest behavior. No Prisma schema change.

## Non-goals

- Likes, comments, follows, or any resident-generated discussion (parent spec: no forum).
- Inventing candidate names, “seats up” from news, or treating incumbents as 2026 filers.
- A WCEC scraper or live fetch of the candidate list.
- Branding overhaul, About/methodology pages, flags engine, digest, iCal, person-page vote stats, campaign finance.
- Pulling un-ingested ChampDS meetings (e.g. 2023-10-10 Flock) onto the feed.
- Labeling voting “blocs” or characterizing members.

## Decisions

| Decision | Choice |
|---|---|
| Information architecture | Two city tabs, two URLs. Not one combined “Town” page. |
| Elections path | `/{cityId}/elections` |
| Votes path | `/{cityId}/votes` |
| Candidate table before WCEC list | Seats only: Mayor (1) · Alderman (2). **No name column.** |
| Candidate names later | Name column appears only when the content file has `candidates.length > 0`. Source = WCEC document. Never `Person`. |
| Feed default | `view=splits` (non-unanimous items only). Unanimous consent is one click away. Default **body** is the council (`thompsons-station-boma`). Planning Commission is one click on the body filter — the parent spec notes land-use often dies there; this increment still defaults to the elected board because that is the feed residents asked for and where named roll-calls exist today. |
| Unvoted labels | Future unvoted: **On the agenda**. Past unvoted: **Awaiting minutes**. Never “upcoming vote.” |
| Agreement | Second view on `/votes`, not its own tab. Neutral percents. No bloc copy. |
| Editorial | Neutral facts + existing unreviewed badge. No opinion. |
| Data writes | None. Pages read existing rows + one checked-in JSON file. |

## 1. Elections stub

### Placement

New route under the existing city tabs layout:

- `glasshouse-web/src/app/[locale]/(city)/[cityId]/(other)/(tabs)/elections/page.tsx`

Add an **Elections** link in `CityNavigation` (after People). `useSelectedLayoutSegment()` match: `elections`.

The tab is on every city (same nav component). An **unknown** `cityId` still 404s from the existing `(other)` / `(tabs)` layouts (`getCityCached` → `notFound()`). A **known** city without a matching content file renders only: “No election file for this city.” Do not invent a second city’s ballot. `file.cityId` must equal the route `cityId` or the file is treated as missing.

### Page content (locked order)

Applies only when a matching file loads. Empty state replaces this whole stack.

1. Title: `file.title` · formatted `file.electionDate` as a civil date (see Dates below). For the TS file that is Town of Thompson’s Station Municipal Election · **Tuesday, November 3, 2026**.
2. **Seats** — one line per `offices[]` (`{label} ({seats} seat(s))`). No name column while `candidates` is empty. Under the seats: “Certified names appear here after the Williamson County Election Commission publishes the list.”
3. **Dates**, from the content file only. Labels are deadlines, not status. Date-only fields (`earlyVoteStart`, `earlyVoteEnd`, `electionDay`, `electionDate`) are **civil dates**. Format them as calendar components (`YYYY-MM-DD` → weekday + month + day + year). Do **not** parse them as `new Date("YYYY-MM-DD")` and then format in `America/Chicago` (UTC midnight becomes the previous evening). Offset fields (`qualifyingClose`, `withdrawalClose`, `registrationDeadline`) format in `city.timezone`.
   - Qualifying deadline: Thursday, August 20, 2026, 12:00 noon
   - Withdrawal deadline: Thursday, August 27, 2026, 12:00 noon
   - Voter registration deadline: Monday, October 5, 2026, 4:30 p.m.
   - Early voting: Wednesday, October 14 – Thursday, October 29, 2026
   - Election day: Tuesday, November 3, 2026
4. **How to vote / how to file** — the `links` array in the content file (WCEC TS public notice, qualifications, petitions checklist, Nov 3 absentee form). External, `rel="noopener noreferrer"`.
5. **Source line** — `sourceNote` + `lastCapturedAt` from the file.

When `candidates.length > 0`, the seats table becomes **Office | Name | Status**. One row per candidate. Two alderman qualifiers are two rows (the seats line above the table still says Alderman (2)). `status=withdrawn` shows a **Withdrawn** label; `qualified` shows nothing extra. Citation is the candidate’s `sourceUrl`. Do not add party labels (municipal races are non-partisan per WCEC FAQ).

If `candidates` is non-empty but an office has zero rows, that office still appears in the seats summary and has no name rows — do not invent a placeholder name.

### Content file

`glasshouse-web/src/content/elections/thompsons-station-2026-11.json`

This file is the **only** runtime source for the elections page. It must live under `src/` so it is copied into the production image. **`glasshouse-web/.dockerignore` starts with `data`**, and the Openship image runs `npm run production:build` inside the container with no source mount — a file under `data/` never reaches `next build`. Do not put this file in `data/`. Do not `fs.readFile` a path that is not in the image.

The ops research folder (`docs/research/2026-11-election/`) stays the capture archive. After a recapture, a human copies certified names into this JSON and rebuilds the web image. No HTTP call to WCEC from the web app. Import the JSON at build time (static import or `fs` of a `src/content` path that is in the image).

Schema (all fields required unless marked optional):

```json
{
  "cityId": "thompsons-station",
  "electionDate": "2026-11-03",
  "title": "Town of Thompson's Station Municipal Election",
  "offices": [
    { "id": "mayor", "label": "Mayor", "seats": 1 },
    { "id": "alderman", "label": "Alderman", "seats": 2 }
  ],
  "candidates": [],
  "dates": {
    "qualifyingClose": "2026-08-20T12:00:00-05:00",
    "withdrawalClose": "2026-08-27T12:00:00-05:00",
    "registrationDeadline": "2026-10-05T16:30:00-05:00",
    "earlyVoteStart": "2026-10-14",
    "earlyVoteEnd": "2026-10-29",
    "electionDay": "2026-11-03"
  },
  "links": [
    { "label": "WCEC public notice — Thompson's Station", "href": "https://www.williamsoncounty-tn.gov/DocumentCenter/View/29556/Public-Notice-Thompsons-Station-November-2026" },
    { "label": "Candidate qualifications", "href": "https://www.williamsoncounty-tn.gov/2133/Qualifications" },
    { "label": "Petitions checklist", "href": "https://www.williamsoncounty-tn.gov/2135/Petitions-Checklist-Resources" },
    { "label": "November 3 absentee request", "href": "https://www.williamsoncounty-tn.gov/DocumentCenter/View/29561/nov-3-2026-absentee" }
  ],
  "sourceNote": "Captured 2026-08-17 from WCEC public notice. Next recapture when WCEC publishes the qualified list.",
  "lastCapturedAt": "2026-08-17"
}
```

Candidate object (only after a WCEC document names someone):

```json
{
  "officeId": "mayor",
  "name": "Exact name as printed",
  "sourceUrl": "https://…",
  "sourceDate": "2026-08-21",
  "status": "qualified"
}
```

`status` is `qualified` | `withdrawn`. Withdrawn names stay on the page with a **Withdrawn** label if they appeared on an earlier capture (ballot-final recapture after noon 27 August 2026). Do not delete history by editing them out.

Validate the JSON with a Zod schema in `src/lib/elections/schema.ts`. A malformed file fails the page (Next.js error boundary), not a silent empty ballot. Each `candidates[].officeId` must equal an `offices[].id` or Zod fails.

### Recapture (ops, not a web feature)

Still required, independent of this page shipping:

1. After noon **20 August 2026** and after the **21 August** WCEC meeting: new dated file `docs/research/2026-11-election/candidates-observed-YYYY-MM-DD.md`. If WCEC published names, copy them into the web JSON and bump `lastCapturedAt` / `sourceNote`.
2. After noon **27 August 2026**: ballot-final list; mark withdrawals `withdrawn`.

Do not put sitting BOMA (`Person`) on this page as candidates. Incumbents stay on People.

### Copy that is forbidden on this page

- “Stover, Alexander, and Whitmer seats are up” (*Williamson Herald* preview).
- 2022/2024 results (later increment).
- “Unopposed,” “likely,” “expected to file.”

## 2. Vote feed

### Placement

- `glasshouse-web/src/app/[locale]/(city)/[cityId]/(other)/(tabs)/votes/page.tsx`
- **Votes** tab in `CityNavigation` (after Elections).
- Segment: `votes`.

Two views, query `tab=feed` | `tab=agreement`. Default `tab=feed`.

### Feed view

**Visibility (all three blocks):** include a meeting if `released === true` **or** the viewer `isUserAuthorizedToEdit({ cityId })`. Same rule as `getCouncilMeetingsForCity({ includeUnreleased })`. Do not leak unreleased rows to the public. Do not hide drafts from editors.

**Unvoted subjects** (no `SubjectVote` rows and no `SubjectVoteResult`), after the `body` filter, ignoring `view` / `person` / `page`:

A subject is unvoted when all of:

- visibility rule above
- meeting `name` does not match `/\(CANCELLED\)/i`
- subject `withdrawn === false`
- subject has **zero** `SubjectVote` rows and **no** `SubjectVoteResult`
- subject name does not match the skip list (case-insensitive, anchored to the meaningful title after trimming a trailing `:`):
  - `meeting called to order`
  - `adjourn` / `adjournment`
  - `pledge` / `pledge of allegiance`
  - `invocation`
  - `roll call` (attendance, not “roll call vote on …”)
  - `announcements`
  - `public comments` / `public comment`
  - `agenda items`
  - any title that is only a section label + optional colon (no motion / ordinance / resolution / consideration / approval / hearing)

Minutes land on the *next* meeting’s packet, so a meeting that has already started usually has no vote rows for weeks. **Do not use “future meeting” as the unvoted gate** or those items vanish from both blocks.

Split unvoted display by `dateTime` vs now:

- `dateTime` ≥ now → top block, badge **On the agenda**
- `dateTime` < now → second block, badge **Awaiting minutes**

Card: date, body name, subject title, badge, link to the subject. No tally digits. Group by meeting. Upcoming meetings newest-first (no cap; few future meetings). Awaiting-minutes: at most **5** meetings, longest wait first; if more exist, a line “N older meetings awaiting minutes.” If a block has zero cards, omit that heading.

**Past (voted) block** — one card per subject that has a `SubjectVoteResult` and/or at least one `SubjectVote`, after filters. Sort: `CouncilMeeting.dateTime` desc, then `agendaItemIndex` asc.

Card:

- Local date in `city.timezone` · administrative body name · subject `name`
- Tally: `{yayCount}–{nayCount}` or `{yayCount}–{nayCount}–{abstainCount}` when `abstainCount > 0`
- Outcome: `PASSED` / `FAILED` from `SubjectVoteResult.outcome`. If only `SubjectVote` rows exist and no result row, derive with `calculateVoteResult` in `src/lib/utils/votes.ts` (`passed = forCount > againstCount`; PRESENT / DID_NOT_VOTE excluded from the counts). Map `passed` → PASSED, else FAILED. Do not write a second outcome rule.
- Named line, elected-order then name: `Stover FOR · King AGAINST · …` using `compareRanks` (`src/lib/sorting/people.ts`) and `formatSurnameFirst` (`src/lib/formatters/name.ts`).
- Collapse to **one row per person** before the named line, split test, agreement, `person` filter, badges, and any `calculateVoteResult` fallback. Preference: `decision` > `manual` > `transcript` > `inferred`. `@@unique([subjectId, personId, source])` allows more than one row.
- **Unreviewed** badge if the chosen row or the `SubjectVoteResult` has `reviewStatus === unreviewed`.
- **Inferred** badge if the chosen row or the result has `source === inferred`.
- Link: `/{cityId}/{meetingId}/subjects/{subjectId}`

Consent remains **one card** (the parent “Consent Agenda” subject). Do not explode child letters a–h.

### Filters (URL, shareable)

| Param | Values | Default |
|---|---|---|
| `tab` | `feed` \| `agreement` | `feed` |
| `body` | administrative body id, or `all` | the city’s council body (`AdministrativeBody.type === council`; for TS that is `thompsons-station-boma`). If the city has no council body, default `all`. |
| `person` | person id, or omitted | omitted |
| `view` | `splits` \| `named` \| `all` | `splits` |
| `from` / `to` | `YYYY-MM-DD` civil dates in `city.timezone` | omitted (no bound) |
| `page` | integer ≥ 1 | `1` |

**`view` definitions** (apply only to the past block):

- `splits` — a **split** (see below).
- `named` — subject has at least one `SubjectVote` row (includes unanimous named consent).
- `all` — subject has a `SubjectVoteResult` and/or any `SubjectVote`.

**Split** (locked):

- If the subject has any **chosen** row with `voteType` in `{FOR, AGAINST, ABSTAIN}`: more than one distinct type in that set.
- Else if only a `SubjectVoteResult`: `nayCount > 0` OR `abstainCount > 0`.
- `PRESENT` and `DID_NOT_VOTE` do not create a split.

`person` keeps a voted subject if that person’s **chosen** row is on it. Unvoted blocks ignore `person` and `view`.

Invalid query values (unknown body id, bad date, `page=0`) fall back to the default for that param. Do not 500.

`from` / `to` are inclusive civil days in `city.timezone`: `[from 00:00, to+1 00:00)`. Port the ingest helper (`ingest/src/votes/date.ts` `chicagoDayBoundsIso`) to web as a timezone-generic `civilDayBounds(date, timeZone)`. Do not pass `new Date("YYYY-MM-DD")` into `dateTime: { lte: to }` — that drops every evening meeting on `to`. Test: June 9 2026 18:00 CDT is inside `from=to=2026-06-09`.

Filters change via `<Link>` or `router.push` so the server page re-runs. **Do not** use `updateFilterURL` / `updateBodyFilterURL` (`src/lib/utils/filterURL.ts`): they `history.pushState` without a server re-render and they store `body` as a **label**, not an id. Meetings-tab `?body=` is a different convention.

### Pagination

Voted block only. Page size **25**. Offset via `page`. Show total count. Unvoted blocks are not paged (awaiting-minutes is capped at 5 meetings).

One algorithm: load **voted subjects** in the body+date+visibility window (Prisma `some` on `votes` / `voteResult`), classify `view` in the helper, then slice page 25. Cap is **2,000 subjects** in that window; over the cap, show a message that `from`/`to` is required. Do not offset 25 raw rows and then filter to splits (page 1 would be short; later pages would skip). Do not load every subject in the city. Do not add a new table.

### Agreement view

Same `body` / `from` / `to` as the feed (ignore `person`, `view`, `page`).

Compute only on subjects that have **named** votes (`SubjectVote` rows) in that window.

**Unanimous** (agreement counts only) = a named item that is not a split.

Show, in order:

1. Counts: named items, unanimous count, split count, date range actually present.
2. Pairwise matrix: for each pair of people who both have a chosen row on at least one named item, `agreed / both-voted (percent)`. Agreement = same chosen `voteType`. Omit people with zero chosen rows from the **matrix**.
3. Coverage: `{name} named on {n} of {m} items` for every person with an **active role** on the filtered body (`Role.administrativeBodyId` matches, `startDate`/`endDate` contains now). `m` is named items in the window. This is how a total-miss extract (White on 0 of 103) stays visible. Do **not** omit role-holders who never appear in `SubjectVote`.
4. Split list: each split subject with the named line and a link (same card body as the feed).

If named count is 0: show the counts as zeros and the sentence “No named votes in this range.” Do not render an empty matrix or empty split list.

No sentence that names a bloc. No “mostly vote together.”

### Empty and missing data

- No past rows after filters: “No votes match these filters.” Offer a control that sets `view=all`.
- No cards in an unvoted block: omit that heading (do not show “0 upcoming”).
- Meeting with votes but someone absent from named rows: still show the card; Agreement coverage handles the gap (including 0 of *m*).
- `released === false`: see Visibility above. One rule, all blocks.

## 3. Shared web constraints

- Locale files: add `City.elections`, `City.votes`, plus `Elections.*` and `Votes.*` namespaces. The fork build expects `messages/{en,el,fr,sr}.json`. New English strings; el/fr/sr get the same English for this increment (TS is `language: en`).
- Metadata: `generateMetadata` + `siteBranding(city.realm)` + `buildCanonicalAlternates`, same pattern as People.
- Timezone: `city.timezone` for vote dates, `from`/`to` bounds, and offset election datetimes. Thompson’s Station is seeded `America/Chicago`. Do not hardcode Chicago on the Votes page.
- Public pages. No auth to read. No `ServiceApiKey` use.
- Do not flip `NEXTAUTH_URL`. Do not register `glasshouse.town`.
- Deploy is a `glasshouse-web` image bump on thinkstation. `WEB_IMAGE` **and** `INGEST_IMAGE` must already be set before any `service sync`. Targeted deploys have dropped `openship-glasshouse-db`; restore from `openship-glasshouse-pgdata` if that happens.
- AGPL: deploy a pushed commit; `NEXT_PUBLIC_BUILD_COMMIT_SHA` matches HEAD.

## 4. Tests (minimum)

Elections:

- JSON with `candidates: []` renders seats and **does not** render a Name column or any `Person.name`.
- JSON with one mayor qualifier renders that name once, cited to `sourceUrl`.
- A known `cityId` with no matching file shows the no-file empty state, not Thompson’s Station’s ballot. An unknown `cityId` 404s from the city layout (do not test that as the empty state).
- Civil date `electionDate=2026-11-03` displays as Tuesday, November 3, 2026, not Monday, November 2.

Votes (pure helper `src/lib/votes/feed.ts` + `src/lib/votes/agreement.ts`):

- Split classifier: 3–2 named → split; 5–0 named → not split; result `2–3–0` with no names → split; result `5–0–0` → not split; `3–1–1` (abstain) → split; FOR+PRESENT only → not split.
- Two `SubjectVote` rows for the same person (`decision` FOR + `inferred` FOR) collapse to one FOR; mixed types keep `decision`.
- Default `view=splits` excludes the June 9 2026 consent 5–0 and includes the June 9 tax amendment 2–3. `from=to=2026-06-09` includes that 18:00 CDT meeting.
- Pagination: a window of 30 unanimous + 2 splits, `view=splits`, `page=1` returns both splits (not a short page of whatever raw rows were first).
- Agreement: on a two-item fixture (one unanimous, one 3–2), pairwise percents match hand math; a roster member with zero named rows still appears as `0 of 2` in coverage and is absent from the matrix. Zero named items → empty-state sentence, no matrix.
- Unvoted predicate excludes cancelled meetings and “Meeting Called to Order.” A **past** meeting with no vote rows is **Awaiting minutes**, not dropped. Fixture the skip list against flattened titles from `docs/research/champds/event-390.json` (must skip `Announcements:`, `Public Comments:`, `Agenda Items:`).

No browser E2E required for this increment. After deploy, spot-check LAN:

- `http://10.0.0.66:3100/thompsons-station/elections`
- `http://10.0.0.66:3100/thompsons-station/votes`

## 5. Implementation order

1. **PR A (web):** elections JSON + schema + page + nav + tests. Recapture remains a manual ops step on/after 20–21 August.
2. **PR B (web):** vote query helpers + feed page + agreement view + filters + tests.

Do not start PR B until PR A is on the live LAN image.

## 6. Relationship to the parent spec

This increment is the public face of Phase 1 “elections page” (stub only; historical results still later) and a slice of Phase 2 “split-vote spotlight” + “people-page vote/attendance stats” (agreement matrix here; per-person pages unchanged). Flags, digest, and guides stay on the parent timeline.
