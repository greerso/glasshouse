# Elections Stub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `/thompsons-station/elections` tab that shows Nov 3 2026 seats, WCEC deadlines, and how-to-file links — with no candidate name column until the content file has names.

**Architecture:** One checked-in JSON file under `src/content/elections/` (must be inside `src/` because `.dockerignore` excludes `data/`). Zod-parse at load. Pure view-model + a server page + a City nav link. No Prisma, no WCEC fetch.

**Tech Stack:** TypeScript, Zod, Next.js App Router, next-intl, Jest (`npm test` — node project for `*.test.ts`, jsdom for `*.test.tsx`). Web Node `>=24.15.0 <25`.

**Spec:** `docs/superpowers/specs/2026-08-18-elections-and-vote-feed-design.md`

**Sister plan:** `docs/superpowers/plans/2026-08-18-vote-feed.md` — do not start until this page is on the live LAN image.

## Global Constraints

- Web changes live in `/Users/greer/dev/glasshouse-web` on branch `glasshouse`. Do not rewrite `upstream`.
- Ops plan/spec live in `/Users/greer/dev/glasshouse`.
- No Prisma schema change. No ingest change.
- Do not invent candidate names. Do not read `Person` for this page.
- Do not put the JSON under `data/` (`.dockerignore` first line is `data`).
- Do not flip `NEXTAUTH_URL`. Do not register `glasshouse.town`.
- Do not `service sync` unless thinkstation `.env` already has both `WEB_IMAGE` and `INGEST_IMAGE`.
- Locale files: `messages/{en,el,fr,sr}.json` plus `messages/{en,el,fr,sr}/metadata.json`. New English strings; el/fr/sr get the same English this increment.
- AGPL: deploy only a pushed commit; `NEXT_PUBLIC_BUILD_COMMIT_SHA` equals web HEAD.

## File structure

| File | Role |
|---|---|
| `glasshouse-web/src/lib/dates/civil.ts` | `formatCivilDate`, `formatOffsetInZone` |
| `glasshouse-web/src/lib/dates/civil.test.ts` | civil-date tests (Nov 3 ≠ Nov 2) |
| `glasshouse-web/src/lib/elections/schema.ts` | Zod `electionFileSchema` + `ElectionFile` type |
| `glasshouse-web/src/lib/elections/schema.test.ts` | schema tests |
| `glasshouse-web/src/lib/elections/load.ts` | `loadElection(cityId)` registry |
| `glasshouse-web/src/lib/elections/load.test.ts` | missing file / cityId mismatch |
| `glasshouse-web/src/lib/elections/view.ts` | `buildElectionView` |
| `glasshouse-web/src/lib/elections/view.test.ts` | no name column when `candidates: []` |
| `glasshouse-web/src/content/elections/thompsons-station-2026-11.json` | WCEC-only content |
| `glasshouse-web/src/components/elections/ElectionsPage.tsx` | render view model |
| `glasshouse-web/src/components/elections/ElectionsPage.test.tsx` | jsdom: no Person names |
| `glasshouse-web/src/app/[locale]/(city)/[cityId]/(other)/(tabs)/elections/page.tsx` | route + metadata |
| `glasshouse-web/src/components/cities/CityNavigation.tsx` | Elections tab after People |
| `glasshouse-web/messages/{en,el,fr,sr}.json` | `City.elections`, `Elections.*` |
| `glasshouse-web/messages/{en,el,fr,sr}/metadata.json` | `metadata.elections` |

---

### Task 1: Civil dates + election schema

**Files:**
- Create: `glasshouse-web/src/lib/dates/civil.ts`
- Create: `glasshouse-web/src/lib/dates/civil.test.ts`
- Create: `glasshouse-web/src/lib/elections/schema.ts`
- Create: `glasshouse-web/src/lib/elections/schema.test.ts`

**Interfaces:**
- Consumes: Zod (`z` already a web dependency)
- Produces:
  - `formatCivilDate(ymd: string, locale: string): string`
  - `formatOffsetInZone(iso: string, timeZone: string, locale: string): string`
  - `electionFileSchema` (Zod)
  - `type ElectionFile = z.infer<typeof electionFileSchema>`
  - `parseElectionFile(data: unknown): ElectionFile` (throws `ZodError`)

- [ ] **Step 1: Write the failing civil-date tests**

```ts
import { formatCivilDate, formatOffsetInZone } from './civil';

describe('formatCivilDate', () => {
    it('prints Tuesday November 3 2026, not Monday November 2', () => {
        expect(formatCivilDate('2026-11-03', 'en')).toBe('Tuesday, November 3, 2026');
    });

    it('prints Wednesday October 14 2026', () => {
        expect(formatCivilDate('2026-10-14', 'en')).toBe('Wednesday, October 14, 2026');
    });

    it('rejects non YYYY-MM-DD', () => {
        expect(() => formatCivilDate('2026-11-03T00:00:00Z', 'en')).toThrow();
    });
});

describe('formatOffsetInZone', () => {
    it('keeps Aug 20 noon on Aug 20 in Chicago', () => {
        const text = formatOffsetInZone('2026-08-20T12:00:00-05:00', 'America/Chicago', 'en');
        expect(text).toMatch(/August 20, 2026/);
        expect(text).toMatch(/12:00/);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/greer/dev/glasshouse-web && npx jest src/lib/dates/civil.test.ts --selectProjects node`

Expected: FAIL — `Cannot find module './civil'`

- [ ] **Step 3: Implement civil dates**

Do **not** use `new Date("YYYY-MM-DD")`. Split the string and format with `Intl.DateTimeFormat` using `timeZone: 'UTC'` and `Date.UTC(year, month - 1, day, 12)` so the calendar day cannot slip.

```ts
const CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatCivilDate(ymd: string, locale: string): string {
    const m = CIVIL.exec(ymd);
    if (!m) throw new Error(`not a civil date: ${ymd}`);
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(date);
}

export function formatOffsetInZone(iso: string, timeZone: string, locale: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) throw new Error(`not an instant: ${iso}`);
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone,
    }).format(date);
}
```

- [ ] **Step 4: Run civil-date tests**

Run: `npx jest src/lib/dates/civil.test.ts --selectProjects node`

Expected: PASS

- [ ] **Step 5: Write failing schema tests**

```ts
import { parseElectionFile } from './schema';

const base = {
    cityId: 'thompsons-station',
    electionDate: '2026-11-03',
    title: "Town of Thompson's Station Municipal Election",
    offices: [
        { id: 'mayor', label: 'Mayor', seats: 1 },
        { id: 'alderman', label: 'Alderman', seats: 2 },
    ],
    candidates: [] as unknown[],
    dates: {
        qualifyingClose: '2026-08-20T12:00:00-05:00',
        withdrawalClose: '2026-08-27T12:00:00-05:00',
        registrationDeadline: '2026-10-05T16:30:00-05:00',
        earlyVoteStart: '2026-10-14',
        earlyVoteEnd: '2026-10-29',
        electionDay: '2026-11-03',
    },
    links: [{ label: 'Notice', href: 'https://example.com/notice' }],
    sourceNote: 'Captured 2026-08-17',
    lastCapturedAt: '2026-08-17',
};

describe('parseElectionFile', () => {
    it('accepts seats-only file', () => {
        expect(parseElectionFile(base).candidates).toEqual([]);
    });

    it('accepts a qualified mayor', () => {
        const file = parseElectionFile({
            ...base,
            candidates: [{
                officeId: 'mayor',
                name: 'Exact name as printed',
                sourceUrl: 'https://example.com/list',
                sourceDate: '2026-08-21',
                status: 'qualified',
            }],
        });
        expect(file.candidates[0].officeId).toBe('mayor');
    });

    it('rejects candidate officeId not in offices', () => {
        expect(() => parseElectionFile({
            ...base,
            candidates: [{
                officeId: 'commissioner',
                name: 'X',
                sourceUrl: 'https://example.com/x',
                sourceDate: '2026-08-21',
                status: 'qualified',
            }],
        })).toThrow();
    });

    it('rejects missing title', () => {
        const { title: _t, ...rest } = base;
        expect(() => parseElectionFile(rest)).toThrow();
    });
});
```

- [ ] **Step 6: Run schema tests to verify they fail**

Run: `npx jest src/lib/elections/schema.test.ts --selectProjects node`

Expected: FAIL — module not found

- [ ] **Step 7: Implement schema**

```ts
import { z } from 'zod';

const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.string().datetime({ offset: true });

const officeSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    seats: z.number().int().positive(),
});

const candidateSchema = z.object({
    officeId: z.string().min(1),
    name: z.string().min(1),
    sourceUrl: z.string().url(),
    sourceDate: civilDate,
    status: z.enum(['qualified', 'withdrawn']),
});

export const electionFileSchema = z.object({
    cityId: z.string().min(1),
    electionDate: civilDate,
    title: z.string().min(1),
    offices: z.array(officeSchema).min(1),
    candidates: z.array(candidateSchema),
    dates: z.object({
        qualifyingClose: instant,
        withdrawalClose: instant,
        registrationDeadline: instant,
        earlyVoteStart: civilDate,
        earlyVoteEnd: civilDate,
        electionDay: civilDate,
    }),
    links: z.array(z.object({
        label: z.string().min(1),
        href: z.string().url(),
    })).min(1),
    sourceNote: z.string().min(1),
    lastCapturedAt: civilDate,
}).superRefine((val, ctx) => {
    const ids = new Set(val.offices.map((o) => o.id));
    val.candidates.forEach((c, i) => {
        if (!ids.has(c.officeId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `unknown officeId ${c.officeId}`,
                path: ['candidates', i, 'officeId'],
            });
        }
    });
});

export type ElectionFile = z.infer<typeof electionFileSchema>;

export function parseElectionFile(data: unknown): ElectionFile {
    return electionFileSchema.parse(data);
}
```

Note: Zod 3 `z.string().datetime({ offset: true })` requires a timezone offset. The spec instants are `-05:00`. If the installed Zod rejects them, switch those three fields to `z.string().min(1)` plus `Date.parse` in the refine — do not change the JSON.

- [ ] **Step 8: Run schema tests**

Run: `npx jest src/lib/elections/schema.test.ts --selectProjects node`

Expected: PASS

- [ ] **Step 9: Commit (web repo)**

```bash
cd /Users/greer/dev/glasshouse-web
git add src/lib/dates/civil.ts src/lib/dates/civil.test.ts src/lib/elections/schema.ts src/lib/elections/schema.test.ts
git commit -m "feat(elections): civil dates and election JSON schema"
```

---

### Task 2: Content file + loader + view model

**Files:**
- Create: `glasshouse-web/src/content/elections/thompsons-station-2026-11.json`
- Create: `glasshouse-web/src/lib/elections/load.ts`
- Create: `glasshouse-web/src/lib/elections/load.test.ts`
- Create: `glasshouse-web/src/lib/elections/view.ts`
- Create: `glasshouse-web/src/lib/elections/view.test.ts`

**Interfaces:**
- Consumes: `parseElectionFile`, `ElectionFile`, `formatCivilDate`, `formatOffsetInZone`
- Produces:
  - `loadElection(cityId: string): ElectionFile | null`
  - `type ElectionView` (below)
  - `buildElectionView(file: ElectionFile, timeZone: string, locale: string): ElectionView`

```ts
export type ElectionView = {
    title: string;
    electionDateLabel: string;
    seats: { id: string; label: string; seats: number }[];
    showNameColumn: boolean;
    candidateRows: {
        officeLabel: string;
        name: string;
        status: 'qualified' | 'withdrawn';
        sourceUrl: string;
    }[];
    dates: { key: string; label: string }[];
    links: { label: string; href: string }[];
    sourceNote: string;
    lastCapturedAt: string;
};
```

- [ ] **Step 1: Write the TS JSON file**

Copy the spec’s JSON exactly (WCEC URLs, empty `candidates`, `lastCapturedAt: "2026-08-17"`). Path: `src/content/elections/thompsons-station-2026-11.json` — never `data/`.

- [ ] **Step 2: Write failing loader + view tests**

```ts
// load.test.ts
import { loadElection } from './load';

describe('loadElection', () => {
    it('returns the TS file for thompsons-station', () => {
        const file = loadElection('thompsons-station');
        expect(file?.cityId).toBe('thompsons-station');
        expect(file?.candidates).toEqual([]);
        expect(file?.offices.map((o) => o.id)).toEqual(['mayor', 'alderman']);
    });

    it('returns null for a known-looking city with no file', () => {
        expect(loadElection('athens')).toBeNull();
    });
});
```

```ts
// view.test.ts
import { parseElectionFile } from './schema';
import { buildElectionView } from './view';

const empty = parseElectionFile(/* same base as schema.test, candidates: [] */);

describe('buildElectionView', () => {
    it('hides the name column when candidates is empty', () => {
        const view = buildElectionView(empty, 'America/Chicago', 'en');
        expect(view.showNameColumn).toBe(false);
        expect(view.candidateRows).toEqual([]);
        expect(view.electionDateLabel).toBe('Tuesday, November 3, 2026');
    });

    it('shows one mayor row when qualified', () => {
        const file = parseElectionFile({
            ...empty,
            candidates: [{
                officeId: 'mayor',
                name: 'Exact name as printed',
                sourceUrl: 'https://example.com/list',
                sourceDate: '2026-08-21',
                status: 'qualified',
            }],
        });
        const view = buildElectionView(file, 'America/Chicago', 'en');
        expect(view.showNameColumn).toBe(true);
        expect(view.candidateRows).toEqual([{
            officeLabel: 'Mayor',
            name: 'Exact name as printed',
            status: 'qualified',
            sourceUrl: 'https://example.com/list',
        }]);
    });

    it('does not invent a name for an office with zero candidates', () => {
        const file = parseElectionFile({
            ...empty,
            candidates: [{
                officeId: 'mayor',
                name: 'Exact name as printed',
                sourceUrl: 'https://example.com/list',
                sourceDate: '2026-08-21',
                status: 'qualified',
            }],
        });
        const view = buildElectionView(file, 'America/Chicago', 'en');
        expect(view.candidateRows.some((r) => r.officeLabel === 'Alderman')).toBe(false);
        expect(view.seats.find((s) => s.id === 'alderman')?.seats).toBe(2);
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/lib/elections/load.test.ts src/lib/elections/view.test.ts --selectProjects node`

Expected: FAIL — modules not found

- [ ] **Step 4: Implement loader and view**

`load.ts` — static import of the one JSON, registry map. Parse with `parseElectionFile`. Return `null` if `cityId` missing from the map **or** `file.cityId !== cityId`.

```ts
import ts2026 from '@/content/elections/thompsons-station-2026-11.json';
import { parseElectionFile, type ElectionFile } from './schema';

const FILES: Record<string, unknown> = {
    'thompsons-station': ts2026,
};

export function loadElection(cityId: string): ElectionFile | null {
    const raw = FILES[cityId];
    if (!raw) return null;
    const file = parseElectionFile(raw);
    if (file.cityId !== cityId) return null;
    return file;
}
```

If `resolveJsonModule` is already on (it is in this Next app), the import works. If ts-jest complains, add `"resolveJsonModule": true` to `tsconfig.jest.json` only if missing.

`view.ts` — `showNameColumn = file.candidates.length > 0`. `candidateRows` from candidates only (join office label via `offices`). `dates` array in spec order: qualifying, withdrawal, registration, early vote range, election day. Early vote label is `${formatCivilDate(start)} – ${formatCivilDate(end)}` (two civil dates, no `Date` parse).

- [ ] **Step 5: Run tests**

Run: `npx jest src/lib/elections --selectProjects node`

Expected: PASS

- [ ] **Step 6: Commit (web repo)**

```bash
git add src/content/elections/thompsons-station-2026-11.json src/lib/elections/load.ts src/lib/elections/load.test.ts src/lib/elections/view.ts src/lib/elections/view.test.ts
git commit -m "feat(elections): TS 2026 content file, loader, and view model"
```

---

### Task 3: Page, nav, messages

**Files:**
- Create: `glasshouse-web/src/components/elections/ElectionsPage.tsx`
- Create: `glasshouse-web/src/components/elections/ElectionsPage.test.tsx`
- Create: `glasshouse-web/src/app/[locale]/(city)/[cityId]/(other)/(tabs)/elections/page.tsx`
- Modify: `glasshouse-web/src/components/cities/CityNavigation.tsx` — add Elections `NavLink` **after People**, `href=/${cityId}/elections`, `matchSegment="elections"`
- Modify: `glasshouse-web/messages/{en,el,fr,sr}.json` — `City.elections` = `"Elections"`; add `Elections` namespace (keys below)
- Modify: `glasshouse-web/messages/{en,el,fr,sr}/metadata.json` — `elections` block

**Interfaces:**
- Consumes: `loadElection`, `buildElectionView`, `getCityCached`, `siteBranding`, `buildCanonicalAlternates`
- Produces: public route `/{cityId}/elections`

`Elections` message keys (same English in all four locales):

```json
"Elections": {
    "empty": "No election file for this city.",
    "seatsHeading": "Seats",
    "namesPending": "Certified names appear here after the Williamson County Election Commission publishes the list.",
    "columnOffice": "Office",
    "columnName": "Name",
    "columnStatus": "Status",
    "statusWithdrawn": "Withdrawn",
    "datesHeading": "Dates",
    "dateQualifying": "Qualifying deadline",
    "dateWithdrawal": "Withdrawal deadline",
    "dateRegistration": "Voter registration deadline",
    "dateEarlyVote": "Early voting",
    "dateElectionDay": "Election day",
    "linksHeading": "How to vote / how to file",
    "sourceHeading": "Source"
}
```

`metadata.elections`:

```json
"elections": {
    "shortTitle": "Elections | {cityName}",
    "notFoundTitle": "Elections | {cityName}",
    "notFoundDescription": "No election file for this city.",
    "description": "Municipal election information for {cityName}.",
    "ogAlt": "Elections | {cityName}"
}
```

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react';
import ElectionsPage from './ElectionsPage';
import { buildElectionView } from '@/lib/elections/view';
import { loadElection } from '@/lib/elections/load';

const strings = {
    empty: 'No election file for this city.',
    seatsHeading: 'Seats',
    namesPending: 'Certified names appear here after the Williamson County Election Commission publishes the list.',
    columnOffice: 'Office',
    columnName: 'Name',
    columnStatus: 'Status',
    statusWithdrawn: 'Withdrawn',
    datesHeading: 'Dates',
    linksHeading: 'How to vote / how to file',
    sourceHeading: 'Source',
};

describe('ElectionsPage', () => {
    it('empty state has no name column', () => {
        render(<ElectionsPage view={null} strings={strings} />);
        expect(screen.getByText(strings.empty)).toBeInTheDocument();
        expect(screen.queryByText(strings.columnName)).toBeNull();
    });

    it('TS seats-only file has no Name header and no person-like cells', () => {
        const file = loadElection('thompsons-station')!;
        const view = buildElectionView(file, 'America/Chicago', 'en');
        render(<ElectionsPage view={view} strings={strings} />);
        expect(screen.getByText(/Mayor/)).toBeInTheDocument();
        expect(screen.getByText(/Alderman/)).toBeInTheDocument();
        expect(screen.queryByText(strings.columnName)).toBeNull();
        expect(screen.queryByText('Brian Stover')).toBeNull();
        expect(screen.queryByText('Shaun Alexander')).toBeNull();
        expect(screen.queryByText('Bob Whitmer')).toBeNull();
        expect(screen.getByText(strings.namesPending)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /public notice/i })).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
});
```

- [ ] **Step 2: Run component test to verify it fails**

Run: `npx jest src/components/elections/ElectionsPage.test.tsx --selectProjects jsdom`

Expected: FAIL — module not found

- [ ] **Step 3: Implement `ElectionsPage`**

Server-safe component (no `"use client"` unless you need it). Props: `{ view: ElectionView | null; strings: typeof strings }`.

When `view` is null: one paragraph `strings.empty`.

When `view` is set, render spec order: title + electionDateLabel; seats list; `namesPending` if `!showNameColumn`; table **only if** `showNameColumn` with Office/Name/Status (Withdrawn label only when `status === 'withdrawn'`; qualified shows empty status cell); each name is an `<a href={sourceUrl} rel="noopener noreferrer" target="_blank">`; dates; links (`rel="noopener noreferrer"` `target="_blank"`); sourceNote + lastCapturedAt.

Do not import `Person` or `getPeopleForCityCached`.

- [ ] **Step 4: Implement the route**

```tsx
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCityCached } from '@/lib/cache';
import { siteBranding } from '@/lib/siteBranding';
import { buildCanonicalAlternates } from '@/lib/utils/hreflang';
import { getOgLocale } from '@/i18n/config';
import { getLocalizedName } from '@/lib/formatters/name';
import { loadElection } from '@/lib/elections/load';
import { buildElectionView } from '@/lib/elections/view';
import ElectionsPage from '@/components/elections/ElectionsPage';
import type { Metadata } from 'next';

export async function generateMetadata(props: { params: Promise<{ cityId: string; locale: string }> }): Promise<Metadata> {
    const params = await props.params;
    const t = await getTranslations({ locale: params.locale, namespace: 'metadata.elections' });
    const city = await getCityCached(params.cityId);
    if (!city) {
        return { title: t('notFoundTitle'), description: t('notFoundDescription') };
    }
    const cityName = getLocalizedName(city, params.locale);
    const { title: siteName } = siteBranding(city.realm);
    return {
        title: `${t('shortTitle', { cityName })} | ${siteName}`,
        description: t('description', { cityName }),
        openGraph: {
            title: t('shortTitle', { cityName }),
            description: t('description', { cityName }),
            siteName,
            locale: getOgLocale(params.locale),
        },
        alternates: await buildCanonicalAlternates(`/${params.cityId}/elections`),
    };
}

export default async function Page(props: { params: Promise<{ cityId: string; locale: string }> }) {
    const { cityId, locale } = await props.params;
    const city = await getCityCached(cityId);
    if (!city) notFound();
    const t = await getTranslations({ locale, namespace: 'Elections' });
    const file = loadElection(cityId);
    const view = file ? buildElectionView(file, city.timezone, locale) : null;
    return (
        <ElectionsPage
            view={view}
            strings={{
                empty: t('empty'),
                seatsHeading: t('seatsHeading'),
                namesPending: t('namesPending'),
                columnOffice: t('columnOffice'),
                columnName: t('columnName'),
                columnStatus: t('columnStatus'),
                statusWithdrawn: t('statusWithdrawn'),
                datesHeading: t('datesHeading'),
                linksHeading: t('linksHeading'),
                sourceHeading: t('sourceHeading'),
            }}
        />
    );
}
```

Do **not** 404 when `file` is null.

- [ ] **Step 5: Add nav + messages**

`CityNavigation.tsx` — after the People `NavLink`, before Parties:

```tsx
<NavLink href={`/${cityId}/elections`} segment={currentSegment} matchSegment="elections">
    {t('elections')}
</NavLink>
```

Add `"elections": "Elections"` next to `"people"` in all four `messages/*.json` `City` objects.

Add the `Elections` namespace and `metadata.elections` block to all four locales (English text).

- [ ] **Step 6: Run tests**

Run:

```
npx jest src/lib/elections src/lib/dates/civil.test.ts src/components/elections/ElectionsPage.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit (web repo)**

```bash
git add src/components/elections src/app/[locale]/\(city\)/\[cityId\]/\(other\)/\(tabs\)/elections src/components/cities/CityNavigation.tsx messages
git commit -m "feat(elections): public elections tab for Thompson's Station"
```

---

### Task 4: Push web + deploy LAN check

**Files:** none new. Live image bump only.

- [ ] **Step 1: Push `glasshouse`**

```bash
cd /Users/greer/dev/glasshouse-web
git push origin glasshouse
WEB_SHA=$(git rev-parse --short=8 HEAD)
echo $WEB_SHA
```

- [ ] **Step 2: Build image on thinkstation and bump `WEB_IMAGE` only after confirming `INGEST_IMAGE` is already set**

Follow `docs/RUNBOOK.md` web deploy. Commands (on thinkstation):

```bash
grep -E '^(WEB_IMAGE|INGEST_IMAGE)=' /data/openship/projects/glasshouse/.env
# INGEST_IMAGE must already be a real tag. Do not sync if it is empty.
cd /data/openship/projects/glasshouse-web
git fetch && git checkout glasshouse && git pull
# build glasshouse-web:$WEB_SHA from that SHA (RUNBOOK)
# set WEB_IMAGE=glasshouse-web:$WEB_SHA in thinkstation .env
# openship service sync only if both image vars are set
```

If `openship-glasshouse-db` disappears: restore `openship-glasshouse-pgdata` per RUNBOOK. Do not invent a new database.

- [ ] **Step 3: Verify LAN**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://10.0.0.66:3100/thompsons-station/elections
# expect 200
curl -sS http://10.0.0.66:3100/thompsons-station/elections | grep -F 'Certified names appear here'
curl -sS http://10.0.0.66:3100/thompsons-station/elections | grep -F 'Brian Stover' && echo FAIL_HAS_INCUMBENT || echo OK_NO_INCUMBENT
```

Expected: 200, pending-names sentence present, no incumbent names.

- [ ] **Step 4: Commit ops note only if RUNBOOK needs a one-line pointer**

If RUNBOOK already documents web image bumps, skip. Do not edit TODO unless this session owns a TODO sync.

---

## Self-review

- Spec §1 placement, empty state, locked order, civil dates, JSON path, Zod `officeId`, forbidden copy, no Person — Tasks 1–3.
- Recapture remains ops (not a web task) — stated in Goal / Task 2 content; no scraper.
- Vote feed is the sister plan, not this one.
- No TBD / “add validation” placeholders.
- Types: `ElectionFile`, `ElectionView`, `loadElection`, `buildElectionView` match across tasks.
