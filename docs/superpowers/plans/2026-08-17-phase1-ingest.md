# Glasshouse Phase 1 Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A document-only ChampDS ingest service in this ops repo that polls all 9 Thompson's Station bodies, upserts meetings and agenda subjects through authenticated OpenCouncil HTTP APIs, mirrors PDFs (and a working MP4 if one exists) into MinIO, and records observation hashes — without transcription, votes, flags, or an elections page.

**Architecture:** `ingest/` is a small Node 20 TypeScript process in the ops repo. It talks to ChampDS with a browser User-Agent and to `glasshouse-web` only over HTTP (`ServiceApiKey` Bearer). The web fork gains a thin service-auth surface (POST subjects, POST release, GET/POST observations, 409 on duplicate meeting id). Ingest never opens Postgres. Event 390 is already meeting `aug11_2026` with 17 subjects — the loop must reuse that id and upsert by `agendaItemIndex`, never insert a second meeting. Transcription is a logged stub.

**Tech Stack:** TypeScript on Node `^20.11.1` (matches `glasshouse-tasks` engines; web stays `>=24.15.0 <25`). Built-in `fetch` + `node:test` + `node:crypto`. Runtime deps: `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` only. No Next.js, no Express, no Prisma in ingest. Web changes stay on fork branch `glasshouse`. Compose service `ingest` in the existing Openship project `proj_5AhrGz_cRgruBEi7`.

**Spec:** docs/superpowers/specs/2026-08-16-glasshouse-design.md

## Global Constraints

- Fork discipline: every fork change is a minimal, isolated commit on branch `glasshouse` in `glasshouse-web`; upstream remains `upstream`; never rewrite upstream history.
- Ingest lives as `ingest/` inside this ops repo (architectural split via HTTP, not a new GitHub repo).
- Node: web `>=24.15.0 <25`; ingest/tasks `^20.11.1`. Use the repo-local version — do not "upgrade" either.
- Openship v0.5.0: one project, one compose file, no `networks:` keys, no compose `profiles:`, commands are exec-form arrays only, set commands via `service sync` never `service update --command`.
- Secrets live only in Openship env and untracked `.env*` files. Nothing secret is committed.
- Timezone everywhere: `America/Chicago`.
- AGPL: deploy only pushed commits; `NEXT_PUBLIC_BUILD_COMMIT_SHA` must equal the deployed web HEAD.
- ChampDS `LastModifyDateTimeUTC` is bulk-touched — never treat it as evidence; content-hash diffs only (timestamps may hint that a fetch is worth doing).
- SQL writes from ingest are forbidden. Phase 0 used `psql` to insert subjects and flip `released` because no API existed; this plan adds the API and never repeats that.
- Do not enable compose service `tasks`. Do not call `requestTranscribe`. No ElevenLabs, pyannote, Mux, or Anthropic keys in this plan.
- Do not spend on video backfill. Document-only: meetings + agenda subjects + PDF artifacts. Newest-first, Nov 2022 → present, all 9 groups.
- Event 390 is already ingested as meeting id `aug11_2026` (17 subjects, `released=true`). The loop must be idempotent and must not create `champds-390` or a second subject set.

## Rulings (spec gaps locked here)

1. **Language: TypeScript + Node 20**, not Python. Tasks-repo already pins `^20.11.1`; ingest is an HTTP client against a TS API; deps stay at two AWS packages plus `typescript`/`tsx`/`@types/node` as devDependencies.
2. **Town-site poller is out.** Spec Phase 1 mentions ChampDS + town website; this plan is ChampDS only. Town-site polling belongs with flags (late-agenda), not document ingest.
3. **Vote extraction, elections page, flags, transcripts are out.**
4. **Meeting ids:** `champds-{CustomerEventID}` for every new meeting. Hard-map `390 → aug11_2026` so the existing row is reused. Do not use `formatDateAsMeetingId` (it is `Europe/Athens` and would slug event 390 as `aug12_2026`).
5. **Subjects API:** new `POST /api/cities/:cityId/meetings/:meetingId/subjects` upserts by `agendaItemIndex`. Do **not** call `saveSubjectsForMeeting` (that path deletes non-agenda subjects and writes highlights).
6. **`agendaItemIndex` formula** (must reproduce Phase 0's 17 rows for event 390):
   - top-level: `OrderOrdinal`
   - child of parent P: `P.OrderOrdinal + 1 + Math.floor(item.OrderOrdinal / 10)`
   - event 390 → `0, 10, 20, 30, 40, 50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 70`
7. **PDF URL (verified 200, 199737 bytes for media 4672):** `https://play.champds.com/ATT/thompsonsstationtn/{MediaFileLocation}/{MediaFileName}`.
8. **MP4:** probe `https://securestream10.champds.com{MediaPath}` with HEAD. Mirror and set `youtubeUrl` only when status is 200 and `Content-Type` starts with `video/`. Event 390's probe 404s — leave `youtubeUrl` unset. Never store the HLS `playlist.m3u8` as `youtubeUrl`.
9. **Observations:** no endpoint exists today. Add `AgendaObservation` (`source`, `firstObservedAt`, `contentHash`, plus `meetingId` so ChampDS ids map to OpenCouncil ids). `listHash` stays in the ingest process, not the web schema.
10. **Release:** POST meeting stays `released: false` by default. Service-auth may pass `released: true` (not used by ingest). Ingest creates unreleased, upserts subjects, then `POST .../release`. Event 390 is already released — do not flip it.
11. **Duplicate meeting POST:** if `meetingId` is provided and the row exists, return **409** (today this is an uncaught P2002 → 500).
12. **Backfill = first poll of missing observations**, newest-first, `EventDateTimeUTC >= 2022-11-01`. Subsequent cycles only fetch event detail when there is no observation or the in-memory list fingerprint changed.
13. **Public object URL** until Task 8's `cdn.` hostname exists: `{PUBLIC_FILES_BASE_URL}/glasshouse/{key}` with default `PUBLIC_FILES_BASE_URL=http://10.0.0.66:9000`.

## File structure

**glasshouse-web** (fork branch `glasshouse`):

| File | Role |
|---|---|
| `prisma/schema.prisma` | `AgendaObservation` + `City.agendaObservations` |
| `prisma/migrations/<ts>_add_agenda_observation/migration.sql` | `--create-only` migration |
| `src/lib/zod-schemas/ingestSubject.ts` | POST subjects body |
| `src/lib/zod-schemas/observation.ts` | POST observation body |
| `src/lib/db/subjects-ingest.ts` | upsert-by-`agendaItemIndex` (no highlights) |
| `src/lib/db/observations.ts` | get/upsert observations |
| `src/lib/db/meetings.ts` | `editCouncilMeetingDirect`, `toggleMeetingReleaseDirect` |
| `src/app/api/cities/[cityId]/meetings/route.ts` | service-only `released`; 409 on provided-id P2002 |
| `src/app/api/cities/[cityId]/meetings/[meetingId]/route.ts` | PUT via `withServiceOrUserAuth` |
| `src/app/api/cities/[cityId]/meetings/[meetingId]/subjects/route.ts` | POST subjects |
| `src/app/api/cities/[cityId]/meetings/[meetingId]/release/route.ts` | POST `{ released: boolean }` |
| `src/app/api/cities/[cityId]/observations/route.ts` | GET + POST |

**glasshouse ops repo:**

| File | Role |
|---|---|
| `ingest/package.json` | Node 20 package, two AWS deps |
| `ingest/tsconfig.json` | ESM, `NodeNext`, `outDir: dist` |
| `ingest/Dockerfile` | prebuilt `glasshouse-ingest:<sha>` (same pattern as pgsync) |
| `ingest/src/config.ts` | env |
| `ingest/src/champds/types.ts` | list + event types |
| `ingest/src/champds/client.ts` | UA, rate gap, list/event/pdf/probe |
| `ingest/src/champds/hash.ts` | content hashes (no LastModify fields) |
| `ingest/src/map/groups.ts` | archive group → body id |
| `ingest/src/map/text.ts` | HTML strip |
| `ingest/src/map/meeting.ts` | event → meeting payload |
| `ingest/src/map/subjects.ts` | flatten + `agendaItemIndex` |
| `ingest/src/oc/client.ts` | OpenCouncil HTTP |
| `ingest/src/minio/mirror.ts` | path-style PutObject |
| `ingest/src/transcribe.ts` | skip stub |
| `ingest/src/orchestrate.ts` | one event + one cycle |
| `ingest/src/index.ts` | `--once` or `setInterval` |
| `docker-compose.yml` | add `ingest` |
| `.env.example` | document `.env.ingest` |
| `docs/RUNBOOK.md` | enable + backfill + verify |

---

### Task 1: Web fork — service-auth ingest surface

**Files:**
- Modify: `/Users/greer/dev/glasshouse-web/prisma/schema.prisma` (`City` relations ~line 49; add model near `ServiceApiKey` ~line 928)
- Create: `/Users/greer/dev/glasshouse-web/prisma/migrations/<timestamp>_add_agenda_observation/migration.sql` (via `prisma migrate dev --create-only`)
- Create: `/Users/greer/dev/glasshouse-web/src/lib/zod-schemas/ingestSubject.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/lib/zod-schemas/observation.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/lib/zod-schemas/__tests__/ingestSubject.test.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/lib/zod-schemas/__tests__/observation.test.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/lib/db/subjects-ingest.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/lib/db/__tests__/subjects-ingest.test.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/lib/db/observations.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/lib/db/__tests__/observations.test.ts`
- Modify: `/Users/greer/dev/glasshouse-web/src/lib/db/meetings.ts` (`editCouncilMeeting` ~101, `toggleMeetingRelease` ~232)
- Modify: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/meetings/route.ts`
- Modify: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/meetings/[meetingId]/route.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/meetings/[meetingId]/subjects/route.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/meetings/[meetingId]/subjects/__tests__/route.test.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/meetings/[meetingId]/release/route.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/meetings/[meetingId]/release/__tests__/route.test.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/observations/route.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/observations/__tests__/route.test.ts`
- Create: `/Users/greer/dev/glasshouse-web/src/app/api/cities/[cityId]/meetings/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `withServiceOrUserAuth` (`src/lib/auth.ts`), `createCouncilMeetingDirect`, `ConflictError`, existing `Subject` model (`name`, `description`, `agendaItemIndex`, `contextCitationUrls`; no `name_en`).
- Produces:
  - `upsertIngestSubjects(cityId, meetingId, subjects) → Subject[]`
  - `upsertObservation({ cityId, source, contentHash, meetingId }) → AgendaObservation` (sets `firstObservedAt` only on insert)
  - `getObservations(cityId, source?) → AgendaObservation[]`
  - `editCouncilMeetingDirect` / `toggleMeetingReleaseDirect` (no session check)
  - `POST /api/cities/:cityId/meetings` — service body may include `released?: boolean`; provided `meetingId` + P2002 → **409**
  - `PUT /api/cities/:cityId/meetings/:meetingId` — `withServiceOrUserAuth`
  - `POST /api/cities/:cityId/meetings/:meetingId/subjects` — `{ subjects: [{ name, description, agendaItemIndex, contextCitationUrls? }] }`
  - `POST /api/cities/:cityId/meetings/:meetingId/release` — `{ released: boolean }`
  - `GET|POST /api/cities/:cityId/observations` — query `source=` exact match; POST upserts by `(cityId, source)`

Work in `/Users/greer/dev/glasshouse-web` on branch `glasshouse`. Read `DATABASE_URL` before any Prisma command — if it contains `production`, stop.

- [ ] **Step 1: Write the failing Zod + db-helper tests**

```typescript
// src/lib/zod-schemas/__tests__/ingestSubject.test.ts
import { ingestSubjectsBodySchema } from '../ingestSubject';

describe('ingestSubjectsBodySchema', () => {
    it('accepts a subject with a numeric agendaItemIndex', () => {
        const parsed = ingestSubjectsBodySchema.parse({
            subjects: [{ name: 'Adjourn', description: '', agendaItemIndex: 70 }],
        });
        expect(parsed.subjects[0].agendaItemIndex).toBe(70);
        expect(parsed.subjects[0].contextCitationUrls).toEqual([]);
    });

    it('rejects a missing name', () => {
        expect(() => ingestSubjectsBodySchema.parse({
            subjects: [{ description: '', agendaItemIndex: 0 }],
        })).toThrow();
    });
});
```

```typescript
// src/lib/zod-schemas/__tests__/observation.test.ts
import { observationBodySchema } from '../observation';

describe('observationBodySchema', () => {
    it('requires source and contentHash', () => {
        const parsed = observationBodySchema.parse({
            source: 'champds:event:390',
            contentHash: 'abc',
            meetingId: 'aug11_2026',
        });
        expect(parsed.source).toBe('champds:event:390');
        expect(parsed.meetingId).toBe('aug11_2026');
    });

    it('rejects an empty source', () => {
        expect(() => observationBodySchema.parse({ source: '', contentHash: 'abc' })).toThrow();
    });
});
```

```typescript
// src/lib/db/__tests__/subjects-ingest.test.ts
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();

jest.mock('../prisma', () => ({
    __esModule: true,
    default: {
        subject: {
            findMany: (...args: unknown[]) => mockFindMany(...args),
            update: (...args: unknown[]) => mockUpdate(...args),
            create: (...args: unknown[]) => mockCreate(...args),
        },
    },
}));

import { upsertIngestSubjects } from '../subjects-ingest';

describe('upsertIngestSubjects', () => {
    beforeEach(() => jest.clearAllMocks());

    it('updates the existing row when agendaItemIndex matches', async () => {
        mockFindMany.mockResolvedValue([{ id: 'sub-1', agendaItemIndex: 0 }]);
        mockUpdate.mockResolvedValue({ id: 'sub-1', name: 'Meeting Called to Order:', agendaItemIndex: 0 });

        const result = await upsertIngestSubjects('thompsons-station', 'aug11_2026', [
            { name: 'Meeting Called to Order:', description: '', agendaItemIndex: 0 },
        ]);

        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: 'sub-1' },
            data: {
                name: 'Meeting Called to Order:',
                description: '',
                contextCitationUrls: [],
            },
        });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('sub-1');
    });

    it('creates when no subject has that agendaItemIndex', async () => {
        mockFindMany.mockResolvedValue([]);
        mockCreate.mockResolvedValue({ id: 'new-1', agendaItemIndex: 70 });

        await upsertIngestSubjects('thompsons-station', 'aug11_2026', [
            { name: 'Adjourn', description: '', agendaItemIndex: 70 },
        ]);

        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalledWith({
            data: {
                name: 'Adjourn',
                description: '',
                agendaItemIndex: 70,
                cityId: 'thompsons-station',
                councilMeetingId: 'aug11_2026',
                contextCitationUrls: [],
            },
        });
    });
});
```

```typescript
// src/lib/db/__tests__/observations.test.ts
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();

jest.mock('../prisma', () => ({
    __esModule: true,
    default: {
        agendaObservation: {
            findMany: (...args: unknown[]) => mockFindMany(...args),
            findUnique: (...args: unknown[]) => mockFindUnique(...args),
            update: (...args: unknown[]) => mockUpdate(...args),
            create: (...args: unknown[]) => mockCreate(...args),
        },
    },
}));

import { getObservations, upsertObservation } from '../observations';

describe('upsertObservation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('inserts and sets firstObservedAt on first sighting', async () => {
        mockFindUnique.mockResolvedValue(null);
        mockCreate.mockImplementation(async ({ data }) => ({ id: 'obs-1', ...data }));

        const row = await upsertObservation({
            cityId: 'thompsons-station',
            source: 'champds:event:390',
            contentHash: 'hash-1',
            meetingId: 'aug11_2026',
        });

        expect(mockCreate).toHaveBeenCalled();
        expect(row.firstObservedAt).toBeInstanceOf(Date);
        expect(row.contentHash).toBe('hash-1');
    });

    it('updates contentHash and keeps firstObservedAt on a later sighting', async () => {
        const first = new Date('2026-08-11T00:00:00.000Z');
        mockFindUnique.mockResolvedValue({
            id: 'obs-1',
            firstObservedAt: first,
            contentHash: 'hash-1',
        });
        mockUpdate.mockResolvedValue({
            id: 'obs-1',
            firstObservedAt: first,
            contentHash: 'hash-2',
        });

        const row = await upsertObservation({
            cityId: 'thompsons-station',
            source: 'champds:event:390',
            contentHash: 'hash-2',
            meetingId: 'aug11_2026',
        });

        expect(mockCreate).not.toHaveBeenCalled();
        expect(row.firstObservedAt).toEqual(first);
        expect(row.contentHash).toBe('hash-2');
    });
});

describe('getObservations', () => {
    it('filters by exact source when provided', async () => {
        mockFindMany.mockResolvedValue([]);
        await getObservations('thompsons-station', 'champds:event:390');
        expect(mockFindMany).toHaveBeenCalledWith({
            where: { cityId: 'thompsons-station', source: 'champds:event:390' },
            orderBy: { firstObservedAt: 'asc' },
        });
    });
});
```

- [ ] **Step 2: Run the new tests — expect FAIL**

Run: `cd /Users/greer/dev/glasshouse-web && npm test -- src/lib/zod-schemas/__tests__/ingestSubject.test.ts src/lib/zod-schemas/__tests__/observation.test.ts src/lib/db/__tests__/subjects-ingest.test.ts src/lib/db/__tests__/observations.test.ts`

Expected: FAIL — modules do not exist.

- [ ] **Step 3: Add the Prisma model + `--create-only` migration**

On `City`, add `agendaObservations AgendaObservation[]` next to the other relations.

Add this model next to `ServiceApiKey`:

```prisma
model AgendaObservation {
  id              String   @id @default(cuid())
  cityId          String
  source          String
  firstObservedAt DateTime
  contentHash     String
  meetingId       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  city City @relation(fields: [cityId], references: [id], onDelete: Cascade)

  @@unique([cityId, source])
  @@index([cityId, meetingId])
}
```

Then:

```bash
npx prisma migrate dev --name add_agenda_observation --create-only
cat prisma/migrations/*add_agenda_observation/migration.sql
```

Expected SQL (names may vary with Prisma's quoting):

```sql
CREATE TABLE "AgendaObservation" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "firstObservedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "meetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgendaObservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgendaObservation_cityId_source_key" ON "AgendaObservation"("cityId", "source");
CREATE INDEX "AgendaObservation_cityId_meetingId_idx" ON "AgendaObservation"("cityId", "meetingId");
ALTER TABLE "AgendaObservation" ADD CONSTRAINT "AgendaObservation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Do not add a FK to `CouncilMeeting` (composite primary key; ingest stores the id as a string map).

- [ ] **Step 4: Implement Zod schemas + db helpers**

```typescript
// src/lib/zod-schemas/ingestSubject.ts
import { z } from 'zod';

export const ingestSubjectSchema = z.object({
    name: z.string().min(1),
    description: z.string(),
    agendaItemIndex: z.number().int(),
    contextCitationUrls: z.array(z.string().url()).optional().default([]),
});

export const ingestSubjectsBodySchema = z.object({
    subjects: z.array(ingestSubjectSchema).min(1),
});

export type IngestSubject = z.infer<typeof ingestSubjectSchema>;
```

```typescript
// src/lib/zod-schemas/observation.ts
import { z } from 'zod';

export const observationBodySchema = z.object({
    source: z.string().min(1),
    contentHash: z.string().min(1),
    meetingId: z.string().min(1).optional(),
    firstObservedAt: z.string().datetime().optional(),
});
```

```typescript
// src/lib/db/subjects-ingest.ts
import prisma from './prisma';

export type IngestSubjectInput = {
    name: string;
    description: string;
    agendaItemIndex: number;
    contextCitationUrls?: string[];
};

export async function upsertIngestSubjects(
    cityId: string,
    meetingId: string,
    subjects: IngestSubjectInput[],
) {
    const existing = await prisma.subject.findMany({
        where: { cityId, councilMeetingId: meetingId },
        select: { id: true, agendaItemIndex: true },
    });
    const byIndex = new Map<number, string>();
    for (const row of existing) {
        if (row.agendaItemIndex !== null) byIndex.set(row.agendaItemIndex, row.id);
    }

    const results = [];
    for (const subject of subjects) {
        const urls = subject.contextCitationUrls ?? [];
        const existingId = byIndex.get(subject.agendaItemIndex);
        if (existingId) {
            results.push(await prisma.subject.update({
                where: { id: existingId },
                data: {
                    name: subject.name,
                    description: subject.description,
                    contextCitationUrls: urls,
                },
            }));
        } else {
            results.push(await prisma.subject.create({
                data: {
                    name: subject.name,
                    description: subject.description,
                    agendaItemIndex: subject.agendaItemIndex,
                    cityId,
                    councilMeetingId: meetingId,
                    contextCitationUrls: urls,
                },
            }));
        }
    }
    return results;
}
```

```typescript
// src/lib/db/observations.ts
import prisma from './prisma';

export async function getObservations(cityId: string, source?: string) {
    return prisma.agendaObservation.findMany({
        where: { cityId, ...(source ? { source } : {}) },
        orderBy: { firstObservedAt: 'asc' },
    });
}

export async function upsertObservation(input: {
    cityId: string;
    source: string;
    contentHash: string;
    meetingId?: string;
    firstObservedAt?: Date;
}) {
    const existing = await prisma.agendaObservation.findUnique({
        where: { cityId_source: { cityId: input.cityId, source: input.source } },
    });
    if (existing) {
        return prisma.agendaObservation.update({
            where: { id: existing.id },
            data: {
                contentHash: input.contentHash,
                meetingId: input.meetingId ?? existing.meetingId,
            },
        });
    }
    return prisma.agendaObservation.create({
        data: {
            cityId: input.cityId,
            source: input.source,
            contentHash: input.contentHash,
            meetingId: input.meetingId,
            firstObservedAt: input.firstObservedAt ?? new Date(),
        },
    });
}
```

In `src/lib/db/meetings.ts`, add session-free twins next to the existing functions (keep the originals — Admin.tsx still uses them):

```typescript
export async function editCouncilMeetingDirect(
    cityId: string,
    id: string,
    meetingData: Partial<Omit<CouncilMeeting, 'id' | 'cityId' | 'createdAt' | 'updatedAt'>>,
): Promise<CouncilMeetingWithAdminBody> {
    return prisma.councilMeeting.update({
        where: { cityId_id: { cityId, id } },
        data: meetingData,
        include: meetingWithAdminBodyInclude,
    });
}

export async function toggleMeetingReleaseDirect(
    cityId: string,
    id: string,
    released: boolean,
): Promise<CouncilMeetingWithAdminBody> {
    const updatedMeeting = await prisma.councilMeeting.update({
        where: { cityId_id: { cityId, id } },
        data: { released },
        include: meetingWithAdminBodyInclude,
    });
    revalidateTag(`city:${cityId}:meetings`, 'max');
    revalidatePath(`/${cityId}`, 'layout');
    const city = await prisma.city.findUnique({ where: { id: cityId }, select: { realm: true } });
    if (city) {
        revalidateTag(landingSubjectsTag(city.realm), 'max');
        revalidateTag(upcomingMeetingsTag(city.realm), 'max');
    }
    return updatedMeeting;
}
```

Leave `toggleMeetingRelease` as a wrapper that still calls `withUserAuthorizedToEdit` then `toggleMeetingReleaseDirect`.

- [ ] **Step 5: Run helper tests — expect PASS**

Run: `npm test -- src/lib/zod-schemas/__tests__/ingestSubject.test.ts src/lib/zod-schemas/__tests__/observation.test.ts src/lib/db/__tests__/subjects-ingest.test.ts src/lib/db/__tests__/observations.test.ts`

Expected: PASS.

- [ ] **Step 6: Write the failing route tests**

```typescript
// src/app/api/cities/[cityId]/meetings/[meetingId]/subjects/__tests__/route.test.ts
/** @jest-environment node */
jest.mock('next/cache', () => ({ revalidateTag: jest.fn(), revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({
    withServiceOrUserAuth: jest.fn(),
}));
jest.mock('@/lib/db/subjects-ingest', () => ({
    upsertIngestSubjects: jest.fn(),
}));

import { POST } from '../route';
import { withServiceOrUserAuth } from '@/lib/auth';
import { upsertIngestSubjects } from '@/lib/db/subjects-ingest';

const mockAuth = withServiceOrUserAuth as jest.MockedFunction<typeof withServiceOrUserAuth>;
const mockUpsert = upsertIngestSubjects as jest.MockedFunction<typeof upsertIngestSubjects>;

function makePost(body: unknown) {
    return new Request('http://localhost/api/cities/thompsons-station/meetings/aug11_2026/subjects', {
        method: 'POST',
        headers: { authorization: 'Bearer sk_test', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /meetings/:id/subjects', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.mockResolvedValue({ type: 'service', keyName: 'ingest' });
    });

    it('upserts subjects and returns 200', async () => {
        mockUpsert.mockResolvedValue([{ id: 'sub-1', agendaItemIndex: 0 }] as any);
        const res = await POST(makePost({
            subjects: [{ name: 'Meeting Called to Order:', description: '', agendaItemIndex: 0 }],
        }) as any, { params: Promise.resolve({ cityId: 'thompsons-station', meetingId: 'aug11_2026' }) });
        expect(res.status).toBe(200);
        expect(mockUpsert).toHaveBeenCalledWith(
            'thompsons-station',
            'aug11_2026',
            [expect.objectContaining({ name: 'Meeting Called to Order:', agendaItemIndex: 0 })],
        );
    });

    it('returns 401 when auth throws', async () => {
        const { UnauthorizedError } = await import('@/lib/api/errors');
        mockAuth.mockRejectedValue(new UnauthorizedError('Invalid API key'));
        const res = await POST(makePost({
            subjects: [{ name: 'Adjourn', description: '', agendaItemIndex: 70 }],
        }) as any, { params: Promise.resolve({ cityId: 'thompsons-station', meetingId: 'aug11_2026' }) });
        expect(res.status).toBe(401);
        expect(mockUpsert).not.toHaveBeenCalled();
    });
});
```

```typescript
// src/app/api/cities/[cityId]/meetings/[meetingId]/release/__tests__/route.test.ts
/** @jest-environment node */
jest.mock('next/cache', () => ({ revalidateTag: jest.fn(), revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({ withServiceOrUserAuth: jest.fn() }));
jest.mock('@/lib/db/meetings', () => ({ toggleMeetingReleaseDirect: jest.fn() }));

import { POST } from '../route';
import { withServiceOrUserAuth } from '@/lib/auth';
import { toggleMeetingReleaseDirect } from '@/lib/db/meetings';

const mockAuth = withServiceOrUserAuth as jest.MockedFunction<typeof withServiceOrUserAuth>;
const mockToggle = toggleMeetingReleaseDirect as jest.MockedFunction<typeof toggleMeetingReleaseDirect>;

describe('POST /meetings/:id/release', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.mockResolvedValue({ type: 'service', keyName: 'ingest' });
        mockToggle.mockResolvedValue({ id: 'aug11_2026', released: true } as any);
    });

    it('sets released=true', async () => {
        const req = new Request('http://localhost/x', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ released: true }),
        });
        const res = await POST(req as any, {
            params: Promise.resolve({ cityId: 'thompsons-station', meetingId: 'champds-387' }),
        });
        expect(res.status).toBe(200);
        expect(mockToggle).toHaveBeenCalledWith('thompsons-station', 'champds-387', true);
    });
});
```

```typescript
// src/app/api/cities/[cityId]/observations/__tests__/route.test.ts
/** @jest-environment node */
jest.mock('@/lib/auth', () => ({ withServiceOrUserAuth: jest.fn() }));
jest.mock('@/lib/db/observations', () => ({
    getObservations: jest.fn(),
    upsertObservation: jest.fn(),
}));

import { GET, POST } from '../route';
import { withServiceOrUserAuth } from '@/lib/auth';
import { getObservations, upsertObservation } from '@/lib/db/observations';

const mockAuth = withServiceOrUserAuth as jest.MockedFunction<typeof withServiceOrUserAuth>;
const mockGet = getObservations as jest.MockedFunction<typeof getObservations>;
const mockUpsert = upsertObservation as jest.MockedFunction<typeof upsertObservation>;

describe('observations API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.mockResolvedValue({ type: 'service', keyName: 'ingest' });
    });

    it('GET filters by source', async () => {
        mockGet.mockResolvedValue([]);
        const req = new Request('http://localhost/api/cities/thompsons-station/observations?source=champds:event:390');
        await GET(req as any, { params: Promise.resolve({ cityId: 'thompsons-station' }) });
        expect(mockGet).toHaveBeenCalledWith('thompsons-station', 'champds:event:390');
    });

    it('POST upserts and returns 200', async () => {
        mockUpsert.mockResolvedValue({
            id: 'obs-1',
            source: 'champds:event:390',
            contentHash: 'abc',
            meetingId: 'aug11_2026',
        } as any);
        const req = new Request('http://localhost/x', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                source: 'champds:event:390',
                contentHash: 'abc',
                meetingId: 'aug11_2026',
            }),
        });
        const res = await POST(req as any, { params: Promise.resolve({ cityId: 'thompsons-station' }) });
        expect(res.status).toBe(200);
        expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
            cityId: 'thompsons-station',
            source: 'champds:event:390',
            meetingId: 'aug11_2026',
        }));
    });
});
```

```typescript
// src/app/api/cities/[cityId]/meetings/__tests__/route.test.ts
/** @jest-environment node */
jest.mock('next/cache', () => ({ revalidateTag: jest.fn(), revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({ withServiceOrUserAuth: jest.fn() }));
jest.mock('@/lib/discord', () => ({ sendMeetingCreatedAdminAlert: jest.fn() }));
jest.mock('@/lib/google-calendar', () => ({
    createMeetingCalendarEvent: jest.fn(),
    calculateMeetingEndTime: jest.fn(),
}));
jest.mock('@/lib/tasks/processAgendaInternal', () => ({ requestProcessAgendaInternal: jest.fn() }));
jest.mock('@/env.mjs', () => ({ env: { NEXTAUTH_URL: 'http://localhost:3000' } }));
jest.mock('@/lib/db/prisma', () => ({
    __esModule: true,
    default: { city: { findUnique: jest.fn().mockResolvedValue({ name: 'TS', name_en: 'TS', timezone: 'America/Chicago' }) } },
}));

const mockCreate = jest.fn();
const mockGenerate = jest.fn();
jest.mock('@/lib/db/meetings', () => ({
    createCouncilMeetingDirect: (...args: unknown[]) => mockCreate(...args),
    getCouncilMeetingsForCity: jest.fn(),
    generateUniqueMeetingId: (...args: unknown[]) => mockGenerate(...args),
}));

import { Prisma } from '@prisma/client';
import { POST } from '../route';
import { withServiceOrUserAuth } from '@/lib/auth';

const mockAuth = withServiceOrUserAuth as jest.MockedFunction<typeof withServiceOrUserAuth>;

const body = {
    name: 'Board of Mayor and Aldermen — Regular Meeting',
    name_en: 'Board of Mayor and Aldermen — Regular Meeting',
    date: '2026-08-11T23:00:00.000Z',
    meetingId: 'aug11_2026',
    administrativeBodyId: 'thompsons-station-boma',
    processAgenda: false,
};

describe('POST /meetings ingest extras', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.mockResolvedValue({ type: 'service', keyName: 'ingest' });
        mockCreate.mockResolvedValue({ id: 'champds-387', released: false });
    });

    it('returns 409 when a provided meetingId already exists', async () => {
        const err = new Prisma.PrismaClientKnownRequestError('c', { code: 'P2002', clientVersion: '5' });
        mockCreate.mockRejectedValue(err);
        const req = new Request('http://localhost/x', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        });
        const res = await POST(req as any, { params: Promise.resolve({ cityId: 'thompsons-station' }) });
        expect(res.status).toBe(409);
    });

    it('does not honor released:true from a user session', async () => {
        mockAuth.mockResolvedValue({ type: 'user', userId: 'u1' });
        mockCreate.mockResolvedValue({ id: 'x', released: false });
        const req = new Request('http://localhost/x', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...body, meetingId: 'champds-1', released: true }),
        });
        await POST(req as any, { params: Promise.resolve({ cityId: 'thompsons-station' }) });
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ released: false }));
    });

    it('honors released:true from a service key', async () => {
        mockCreate.mockResolvedValue({ id: 'x', released: true });
        const req = new Request('http://localhost/x', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...body, meetingId: 'champds-1', released: true }),
        });
        await POST(req as any, { params: Promise.resolve({ cityId: 'thompsons-station' }) });
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ released: true }));
    });
});
```

- [ ] **Step 7: Run route tests — expect FAIL** (subjects/release/observations modules missing; meetings POST still 500 on P2002).

Run: `npm test -- src/app/api/cities/[cityId]/meetings/__tests__/route.test.ts src/app/api/cities/[cityId]/meetings/[meetingId]/subjects/__tests__/route.test.ts src/app/api/cities/[cityId]/meetings/[meetingId]/release/__tests__/route.test.ts src/app/api/cities/[cityId]/observations/__tests__/route.test.ts`

- [ ] **Step 8: Implement the routes**

`POST` meetings (`route.ts`): after `withServiceOrUserAuth`, parse an extra optional flag (do **not** add `released` to `meetingSchema` — the admin form uses that schema):

```typescript
const ingestExtras = z.object({ released: z.boolean().optional() }).parse(body);
const released = authResult.type === 'service' && ingestExtras.released === true;
```

Pass `released` into `buildMeetingData` instead of `released: false as const`. On P2002, if `providedMeetingId` is set, throw `new ConflictError('Meeting already exists')` so `handleApiError` returns 409.

`PUT` meetings (`[meetingId]/route.ts`): change the argument type to `NextRequest`, replace `withUserAuthorizedToEdit` with `withServiceOrUserAuth(request, { cityId: params.cityId })`, and call `editCouncilMeetingDirect` instead of `editCouncilMeeting`.

New subjects route:

```typescript
// src/app/api/cities/[cityId]/meetings/[meetingId]/subjects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { withServiceOrUserAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api/errors';
import { ingestSubjectsBodySchema } from '@/lib/zod-schemas/ingestSubject';
import { upsertIngestSubjects } from '@/lib/db/subjects-ingest';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ cityId: string; meetingId: string }> },
) {
    const params = await props.params;
    try {
        await withServiceOrUserAuth(request, { cityId: params.cityId });
        const body = ingestSubjectsBodySchema.parse(await request.json());
        const subjects = await upsertIngestSubjects(params.cityId, params.meetingId, body.subjects);
        revalidateTag(`city:${params.cityId}:meeting:${params.meetingId}`, 'max');
        revalidatePath(`/${params.cityId}/${params.meetingId}`, 'layout');
        return NextResponse.json({ subjects });
    } catch (error) {
        return handleApiError(error, 'Failed to upsert subjects');
    }
}
```

New release route:

```typescript
// src/app/api/cities/[cityId]/meetings/[meetingId]/release/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withServiceOrUserAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api/errors';
import { toggleMeetingReleaseDirect } from '@/lib/db/meetings';

const bodySchema = z.object({ released: z.boolean() });

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ cityId: string; meetingId: string }> },
) {
    const params = await props.params;
    try {
        await withServiceOrUserAuth(request, { cityId: params.cityId });
        const { released } = bodySchema.parse(await request.json());
        const meeting = await toggleMeetingReleaseDirect(params.cityId, params.meetingId, released);
        return NextResponse.json({ id: meeting.id, released: meeting.released });
    } catch (error) {
        return handleApiError(error, 'Failed to set meeting release');
    }
}
```

New observations route:

```typescript
// src/app/api/cities/[cityId]/observations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withServiceOrUserAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api/errors';
import { observationBodySchema } from '@/lib/zod-schemas/observation';
import { getObservations, upsertObservation } from '@/lib/db/observations';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ cityId: string }> },
) {
    const params = await props.params;
    try {
        await withServiceOrUserAuth(request, { cityId: params.cityId });
        const source = request.nextUrl.searchParams.get('source') ?? undefined;
        const rows = await getObservations(params.cityId, source);
        return NextResponse.json(rows);
    } catch (error) {
        return handleApiError(error, 'Failed to list observations');
    }
}

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ cityId: string }> },
) {
    const params = await props.params;
    try {
        await withServiceOrUserAuth(request, { cityId: params.cityId });
        const body = observationBodySchema.parse(await request.json());
        const row = await upsertObservation({
            cityId: params.cityId,
            source: body.source,
            contentHash: body.contentHash,
            meetingId: body.meetingId,
            firstObservedAt: body.firstObservedAt ? new Date(body.firstObservedAt) : undefined,
        });
        return NextResponse.json(row);
    } catch (error) {
        return handleApiError(error, 'Failed to upsert observation');
    }
}
```

- [ ] **Step 9: Run the new tests + typecheck**

Run: `npm test -- src/lib/zod-schemas/__tests__/ingestSubject.test.ts src/lib/zod-schemas/__tests__/observation.test.ts src/lib/db/__tests__/subjects-ingest.test.ts src/lib/db/__tests__/observations.test.ts src/app/api/cities/[cityId]/meetings/__tests__/route.test.ts src/app/api/cities/[cityId]/meetings/[meetingId]/subjects/__tests__/route.test.ts src/app/api/cities/[cityId]/meetings/[meetingId]/release/__tests__/route.test.ts src/app/api/cities/[cityId]/observations/__tests__/route.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 10: Commit on branch `glasshouse`**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/zod-schemas src/lib/db/subjects-ingest.ts src/lib/db/observations.ts src/lib/db/meetings.ts src/lib/db/__tests__ src/app/api/cities
git commit -m "$(cat <<'EOF'
feat: service-auth subjects, release, and observation APIs for ingest

Adds AgendaObservation and HTTP endpoints so glasshouse-ingest can
create subjects and release meetings without psql. Duplicate meeting
ids return 409. released=true on create is service-key only.
EOF
)"
```

Do not rebuild or deploy the web image in this task — Task 6 does that after ingest exists.

---

### Task 2: Ingest ChampDS client + content hash

**Files:**
- Create: `/Users/greer/dev/glasshouse/ingest/package.json`
- Create: `/Users/greer/dev/glasshouse/ingest/tsconfig.json`
- Create: `/Users/greer/dev/glasshouse/ingest/src/config.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/champds/types.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/champds/client.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/champds/hash.ts`
- Test: `/Users/greer/dev/glasshouse/ingest/src/champds/client.test.ts`
- Test: `/Users/greer/dev/glasshouse/ingest/src/champds/hash.test.ts`

**Interfaces:**
- Consumes: fixture `/Users/greer/dev/glasshouse/docs/research/champds/event-390.json`.
- Produces:
  - `loadConfig() → IngestConfig`
  - `createChampdsClient(cfg) → ChampdsClient`
  - `ChampdsClient.listGroup(groupId: number): Promise<ChampdsListEvent[]>`
  - `ChampdsClient.getEvent(eventId: number): Promise<ChampdsEvent>`
  - `ChampdsClient.pdfUrl(att: ChampdsAttachment): string`
  - `ChampdsClient.downloadPdf(att): Promise<Uint8Array>`
  - `ChampdsClient.probeDirectMp4(mediaPath: string): Promise<string | null>`
  - `hashEventDetail(event: ChampdsEvent): string`
  - `hashEventListRow(row: ChampdsListEvent): string`
  - `BROWSER_UA` constant

- [ ] **Step 1: Scaffold the package**

```json
{
  "name": "glasshouse-ingest",
  "private": true,
  "type": "module",
  "engines": { "node": "^20.11.1" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "tsx --test src/**/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.758.0",
    "@aws-sdk/lib-storage": "^3.758.0"
  },
  "devDependencies": {
    "@types/node": "^20.17.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "declaration": false,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

```bash
cd /Users/greer/dev/glasshouse/ingest && npm install
```

- [ ] **Step 2: Write the failing hash + client tests**

```typescript
// src/champds/hash.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { hashEventDetail, hashEventListRow } from './hash.ts';
import type { ChampdsEvent } from './types.ts';

const fixture: ChampdsEvent = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/champds/event-390.json'), 'utf8'),
);

test('hashEventDetail is stable for the event-390 fixture', () => {
    const a = hashEventDetail(fixture);
    const b = hashEventDetail(fixture);
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
});

test('hashEventDetail ignores LastModifyDateTimeUTC', () => {
    const baseline = hashEventDetail(fixture);
    const mutated = structuredClone(fixture);
    mutated.Event.LastModifyDateTimeUTC = '2099-01-01 00:00:00';
    mutated.Agenda.AgendaItems[0].LastModifyDateTimeUTC = '2099-01-01 00:00:00';
    assert.equal(hashEventDetail(mutated), baseline);
});

test('hashEventDetail changes when an agenda title changes', () => {
    const baseline = hashEventDetail(fixture);
    const mutated = structuredClone(fixture);
    mutated.Agenda.AgendaItems[0].Title = 'Changed title';
    assert.notEqual(hashEventDetail(mutated), baseline);
});

test('hashEventListRow ignores LastModifyDateTimeUTC', () => {
    const row = {
        CustomerEventID: 390,
        EventTitle: 'Board of Mayor and Alderman Regular Meeting',
        EventDescription: '<p>August&nbsp;Agenda</p>',
        EventDateTimeUTC: '2026-08-11 23:00:00',
        LastModifyDateTimeUTC: '2026-08-13 18:55:49',
        MediaInfo: { MediaPath: '/2026-08/9406ff0ae567d88b0dd4927b6eabb9c95b91b44e.mp4' },
    };
    const a = hashEventListRow(row);
    const b = hashEventListRow({ ...row, LastModifyDateTimeUTC: '2099-01-01 00:00:00' });
    assert.equal(a, b);
});
```

```typescript
// src/champds/client.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { BROWSER_UA, createChampdsClient } from './client.ts';

test('pdfUrl uses the verified ATT path', () => {
    const client = createChampdsClient({
        champdsBaseUrl: 'https://playapi.champds.com/thompsonsstationtn',
        requestGapMs: 0,
        userAgent: BROWSER_UA,
    });
    assert.equal(
        client.pdfUrl({
            CustomerMediaID: 4672,
            MediaFileName: '91575be773d9ca40e50a4f9ff6b112581d548fb1.pdf',
            MediaFileLocation: '2026-08',
            MediaNickName: 'Item%20a',
            SizeBytes: 199737,
        }),
        'https://play.champds.com/ATT/thompsonsstationtn/2026-08/91575be773d9ca40e50a4f9ff6b112581d548fb1.pdf',
    );
});

test('listGroup sends a browser User-Agent', async () => {
    const calls: Array<{ url: string; ua: string | null }> = [];
    const client = createChampdsClient({
        champdsBaseUrl: 'https://playapi.champds.com/thompsonsstationtn',
        requestGapMs: 0,
        userAgent: BROWSER_UA,
        fetchImpl: async (url, init) => {
            const headers = new Headers(init?.headers);
            calls.push({ url: String(url), ua: headers.get('user-agent') });
            return new Response(JSON.stringify([{ CustomerEventID: 390 }]), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        },
    });
    const rows = await client.listGroup(1);
    assert.equal(rows[0].CustomerEventID, 390);
    assert.equal(calls[0].url, 'https://playapi.champds.com/thompsonsstationtn/archiveGroupListWithMedia/1');
    assert.equal(calls[0].ua, BROWSER_UA);
});

test('probeDirectMp4 returns null when the response is not a video', async () => {
    const client = createChampdsClient({
        champdsBaseUrl: 'https://playapi.champds.com/thompsonsstationtn',
        requestGapMs: 0,
        userAgent: BROWSER_UA,
        fetchImpl: async () => new Response(null, { status: 404, headers: { 'content-type': 'text/html' } }),
    });
    assert.equal(await client.probeDirectMp4('/2026-08/9406ff0ae567d88b0dd4927b6eabb9c95b91b44e.mp4'), null);
});

test('probeDirectMp4 returns the URL when HEAD is 200 video/*', async () => {
    const client = createChampdsClient({
        champdsBaseUrl: 'https://playapi.champds.com/thompsonsstationtn',
        requestGapMs: 0,
        userAgent: BROWSER_UA,
        fetchImpl: async () => new Response(null, { status: 200, headers: { 'content-type': 'video/mp4' } }),
    });
    assert.equal(
        await client.probeDirectMp4('/2026-08/x.mp4'),
        'https://securestream10.champds.com/2026-08/x.mp4',
    );
});
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `cd /Users/greer/dev/glasshouse/ingest && npx tsx --test src/champds/hash.test.ts src/champds/client.test.ts`

Expected: FAIL — `hash.ts` / `client.ts` not found.

- [ ] **Step 4: Implement types, hash, client**

```typescript
// src/champds/types.ts
export type ChampdsAttachment = {
    CustomerMediaID: number;
    MediaFileName: string;
    MediaFileLocation: string;
    MediaNickName: string;
    SizeBytes: number;
};

export type ChampdsAgendaItem = {
    CustomerAgendaItemID: number;
    Title: string;
    Description: string;
    OrderOrdinal: number;
    OrderParentID: number;
    LastModifyDateTimeUTC?: string | null;
    Attachments?: ChampdsAttachment[];
    Children?: ChampdsAgendaItem[];
};

export type ChampdsEvent = {
    Event: {
        CustomerEventID: number;
        EventTitle: string;
        EventDescription: string;
        EventDateTimeUTC: string;
        EventDateTimeCustomerLocal?: string;
        LastModifyDateTimeUTC?: string | null;
        EventPublishStatusID?: number;
    };
    Agenda: { AgendaItems: ChampdsAgendaItem[]; Attachments?: ChampdsAttachment[] };
    Minutes?: { Attachments?: ChampdsAttachment[] };
    MediaInfo?: { MediaPath?: string | null } | null;
};

export type ChampdsListEvent = {
    CustomerEventID: number;
    EventTitle: string;
    EventDescription: string;
    EventDateTimeUTC: string;
    LastModifyDateTimeUTC?: string | null;
    MediaInfo?: { MediaPath?: string | null } | null;
};
```

```typescript
// src/champds/hash.ts
import { createHash } from 'node:crypto';
import type { ChampdsAgendaItem, ChampdsEvent, ChampdsListEvent } from './types.ts';

function flatten(items: ChampdsAgendaItem[], parentId: number | null = null): unknown[] {
    const out: unknown[] = [];
    for (const item of items) {
        out.push({
            id: item.CustomerAgendaItemID,
            parentId,
            title: item.Title,
            description: item.Description,
            order: item.OrderOrdinal,
            attachments: (item.Attachments ?? []).map((a) => ({
                id: a.CustomerMediaID,
                file: a.MediaFileName,
                loc: a.MediaFileLocation,
                size: a.SizeBytes,
            })),
        });
        if (item.Children?.length) {
            out.push(...flatten(item.Children, item.CustomerAgendaItemID));
        }
    }
    return out;
}

export function hashEventDetail(event: ChampdsEvent): string {
    const canonical = {
        id: event.Event.CustomerEventID,
        title: event.Event.EventTitle,
        description: event.Event.EventDescription,
        dateTimeUtc: event.Event.EventDateTimeUTC,
        mediaPath: event.MediaInfo?.MediaPath ?? null,
        items: flatten(event.Agenda.AgendaItems),
        minutes: (event.Minutes?.Attachments ?? []).map((a) => a.CustomerMediaID),
    };
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function hashEventListRow(row: ChampdsListEvent): string {
    return createHash('sha256').update(JSON.stringify({
        id: row.CustomerEventID,
        title: row.EventTitle,
        description: row.EventDescription,
        dateTimeUtc: row.EventDateTimeUTC,
        mediaPath: row.MediaInfo?.MediaPath ?? null,
    })).digest('hex');
}
```

```typescript
// src/champds/client.ts
import type { ChampdsAttachment, ChampdsEvent, ChampdsListEvent } from './types.ts';

export const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type ChampdsClientConfig = {
    champdsBaseUrl: string;
    requestGapMs: number;
    userAgent: string;
    fetchImpl?: typeof fetch;
};

export type ChampdsClient = {
    listGroup(groupId: number): Promise<ChampdsListEvent[]>;
    getEvent(eventId: number): Promise<ChampdsEvent>;
    pdfUrl(att: ChampdsAttachment): string;
    downloadPdf(att: ChampdsAttachment): Promise<Uint8Array>;
    probeDirectMp4(mediaPath: string): Promise<string | null>;
};

export function createChampdsClient(cfg: ChampdsClientConfig): ChampdsClient {
    const fetchImpl = cfg.fetchImpl ?? fetch;
    let nextAllowed = 0;

    async function gap(): Promise<void> {
        const wait = nextAllowed - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        nextAllowed = Date.now() + cfg.requestGapMs;
    }

    async function getJson<T>(url: string): Promise<T> {
        await gap();
        const res = await fetchImpl(url, { headers: { 'user-agent': cfg.userAgent } });
        if (!res.ok) throw new Error(`ChampDS ${res.status} ${url}`);
        return res.json() as Promise<T>;
    }

    return {
        listGroup(groupId) {
            return getJson<ChampdsListEvent[]>(
                `${cfg.champdsBaseUrl}/archiveGroupListWithMedia/${groupId}`,
            );
        },
        getEvent(eventId) {
            return getJson<ChampdsEvent>(`${cfg.champdsBaseUrl}/event/${eventId}`);
        },
        pdfUrl(att) {
            return `https://play.champds.com/ATT/thompsonsstationtn/${att.MediaFileLocation}/${att.MediaFileName}`;
        },
        async downloadPdf(att) {
            await gap();
            const url = `https://play.champds.com/ATT/thompsonsstationtn/${att.MediaFileLocation}/${att.MediaFileName}`;
            const res = await fetchImpl(url, { headers: { 'user-agent': cfg.userAgent } });
            if (!res.ok) throw new Error(`PDF ${res.status} ${url}`);
            return new Uint8Array(await res.arrayBuffer());
        },
        async probeDirectMp4(mediaPath) {
            await gap();
            const url = `https://securestream10.champds.com${mediaPath}`;
            const res = await fetchImpl(url, {
                method: 'HEAD',
                headers: { 'user-agent': cfg.userAgent },
                redirect: 'follow',
            });
            const ct = res.headers.get('content-type') ?? '';
            if (res.ok && ct.startsWith('video/')) return url;
            return null;
        },
    };
}
```

`src/config.ts` is used starting in Task 5; create a stub that Task 5 will complete, or skip until then. Do not add a placeholder `TODO` — leave `config.ts` for Task 5.

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx tsx --test src/champds/hash.test.ts src/champds/client.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/greer/dev/glasshouse
git add ingest/package.json ingest/package-lock.json ingest/tsconfig.json ingest/src
git commit -m "feat(ingest): ChampDS client, browser UA, and content hashes"
```

---

### Task 3: Mapper — meeting + subject payloads

**Files:**
- Create: `/Users/greer/dev/glasshouse/ingest/src/map/groups.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/map/text.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/map/meeting.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/map/subjects.ts`
- Test: `/Users/greer/dev/glasshouse/ingest/src/map/meeting.test.ts`
- Test: `/Users/greer/dev/glasshouse/ingest/src/map/subjects.test.ts`
- Test: `/Users/greer/dev/glasshouse/ingest/src/map/text.test.ts`

**Interfaces:**
- Consumes: `ChampdsEvent` from Task 2; seed body ids from `seed/thompsons-station.sql`.
- Produces:
  - `CHAMPDS_GROUPS: { archiveGroupId: number; bodyId: string }[]`
  - `EXISTING_MEETING_IDS: Record<number, string>` — `{ 390: 'aug11_2026' }`
  - `meetingIdForEvent(eventId: number): string`
  - `mapMeeting(event, bodyId): { name, name_en, date, meetingId, administrativeBodyId, processAgenda: false }`
  - `mapSubjects(event): { name, description, agendaItemIndex, attachments: ChampdsAttachment[] }[]`
  - `stripHtml(html: string): string`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/map/text.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { stripHtml } from './text.ts';

test('strips tags and decodes nbsp/amp', () => {
    assert.equal(
        stripHtml('<p>a.&nbsp; Staff Report</p>\n<p>b.&nbsp; Ordinance 2026-017</p>'),
        'a. Staff Report b. Ordinance 2026-017',
    );
});

test('collapses tabs and leftover whitespace', () => {
    assert.equal(stripHtml('10.\tConsideration of  the plan.'), '10. Consideration of the plan.');
});
```

```typescript
// src/map/meeting.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { mapMeeting, meetingIdForEvent, EXISTING_MEETING_IDS } from './meeting.ts';
import type { ChampdsEvent } from '../champds/types.ts';

const fixture: ChampdsEvent = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/champds/event-390.json'), 'utf8'),
);

test('event 390 reuses the already-ingested meeting id', () => {
    assert.equal(EXISTING_MEETING_IDS[390], 'aug11_2026');
    assert.equal(meetingIdForEvent(390), 'aug11_2026');
    assert.equal(meetingIdForEvent(387), 'champds-387');
});

test('mapMeeting uses EventDateTimeUTC as a Zulu instant and does not invent a YouTube url', () => {
    const payload = mapMeeting(fixture, 'thompsons-station-boma');
    assert.equal(payload.meetingId, 'aug11_2026');
    assert.equal(payload.date, '2026-08-11T23:00:00.000Z');
    assert.equal(payload.administrativeBodyId, 'thompsons-station-boma');
    assert.equal(payload.processAgenda, false);
    assert.equal(payload.name, payload.name_en);
    assert.ok(payload.name.includes('Board of Mayor'));
    assert.equal('youtubeUrl' in payload && payload.youtubeUrl, false);
});
```

```typescript
// src/map/subjects.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { mapSubjects } from './subjects.ts';
import type { ChampdsEvent } from '../champds/types.ts';

const fixture: ChampdsEvent = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../docs/research/champds/event-390.json'), 'utf8'),
);

test('event 390 maps to 17 subjects with the Phase 0 agendaItemIndex set', () => {
    const subjects = mapSubjects(fixture);
    assert.equal(subjects.length, 17);
    assert.deepEqual(
        subjects.map((s) => s.agendaItemIndex),
        [0, 10, 20, 30, 40, 50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 70],
    );
});

test('event 390 keeps ChampDS titles (trailing colons) so upsert matches existing rows', () => {
    const subjects = mapSubjects(fixture);
    assert.equal(subjects[0].name, 'Meeting Called to Order:');
    assert.equal(subjects[5].name, 'Agenda Items:');
    assert.equal(subjects[16].name, 'Adjourn');
    assert.match(subjects[6].name, /FOG/);
});

test('consent agenda keeps its PDF attachments on that subject', () => {
    const consent = mapSubjects(fixture).find((s) => s.agendaItemIndex === 40);
    assert.ok(consent);
    assert.ok(consent.attachments.length >= 7);
    assert.equal(consent.attachments[0].CustomerMediaID, 4672);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx tsx --test src/map/text.test.ts src/map/meeting.test.ts src/map/subjects.test.ts`

Expected: FAIL — mappers not defined.

- [ ] **Step 3: Implement**

```typescript
// src/map/groups.ts
export const CHAMPDS_GROUPS = [
    { archiveGroupId: 1, bodyId: 'thompsons-station-boma' },
    { archiveGroupId: 2, bodyId: 'thompsons-station-bza' },
    { archiveGroupId: 3, bodyId: 'thompsons-station-beer' },
    { archiveGroupId: 21, bodyId: 'thompsons-station-econ-dev' },
    { archiveGroupId: 4, bodyId: 'thompsons-station-parks' },
    { archiveGroupId: 5, bodyId: 'thompsons-station-utility' },
    { archiveGroupId: 6, bodyId: 'thompsons-station-planning' },
    { archiveGroupId: 7, bodyId: 'thompsons-station-joint-workshops' },
    { archiveGroupId: 8, bodyId: 'thompsons-station-special-events' },
] as const;
```

```typescript
// src/map/text.ts
export function stripHtml(html: string): string {
    return html
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
```

```typescript
// src/map/meeting.ts
import type { ChampdsEvent } from '../champds/types.ts';
import { stripHtml } from './text.ts';

export const EXISTING_MEETING_IDS: Record<number, string> = {
    390: 'aug11_2026',
};

export function meetingIdForEvent(eventId: number): string {
    return EXISTING_MEETING_IDS[eventId] ?? `champds-${eventId}`;
}

export function mapMeeting(event: ChampdsEvent, bodyId: string) {
    const name = stripHtml(event.Event.EventTitle);
    return {
        name,
        name_en: name,
        date: new Date(event.Event.EventDateTimeUTC.replace(' ', 'T') + 'Z').toISOString(),
        meetingId: meetingIdForEvent(event.Event.CustomerEventID),
        administrativeBodyId: bodyId,
        processAgenda: false as const,
    };
}
```

```typescript
// src/map/subjects.ts
import type { ChampdsAgendaItem, ChampdsAttachment, ChampdsEvent } from '../champds/types.ts';
import { stripHtml } from './text.ts';

export type MappedSubject = {
    name: string;
    description: string;
    agendaItemIndex: number;
    attachments: ChampdsAttachment[];
};

function flatten(
    items: ChampdsAgendaItem[],
    parent: ChampdsAgendaItem | null,
): { item: ChampdsAgendaItem; parent: ChampdsAgendaItem | null }[] {
    const out: { item: ChampdsAgendaItem; parent: ChampdsAgendaItem | null }[] = [];
    for (const item of items) {
        out.push({ item, parent });
        if (item.Children?.length) out.push(...flatten(item.Children, item));
    }
    return out;
}

export function agendaItemIndex(item: ChampdsAgendaItem, parent: ChampdsAgendaItem | null): number {
    if (!parent) return item.OrderOrdinal;
    return parent.OrderOrdinal + 1 + Math.floor(item.OrderOrdinal / 10);
}

export function mapSubjects(event: ChampdsEvent): MappedSubject[] {
    const flat = flatten(event.Agenda.AgendaItems, null);
    const used = new Set<number>();
    return flat.map(({ item, parent }) => {
        let index = agendaItemIndex(item, parent);
        while (used.has(index)) index += 1;
        used.add(index);
        return {
            name: stripHtml(item.Title),
            description: stripHtml(item.Description ?? ''),
            agendaItemIndex: index,
            attachments: item.Attachments ?? [],
        };
    });
}
```

`stripHtml` on `"Meeting Called to Order:"` must leave the trailing colon (no tag to strip). Confirm the test still passes.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx tsx --test src/map/text.test.ts src/map/meeting.test.ts src/map/subjects.test.ts`

Expected: PASS, 17 subjects, index list exact.

- [ ] **Step 5: Commit**

```bash
git add ingest/src/map
git commit -m "feat(ingest): map ChampDS events to meeting and subject payloads"
```

---

### Task 4: MinIO mirror (path-style)

**Files:**
- Create: `/Users/greer/dev/glasshouse/ingest/src/minio/mirror.ts`
- Test: `/Users/greer/dev/glasshouse/ingest/src/minio/mirror.test.ts`

**Interfaces:**
- Consumes: `ChampdsAttachment`; bytes from Task 2 `downloadPdf`.
- Produces:
  - `objectKey(cityId, eventId, att): string` → `thompsons-station/champds/{eventId}/pdf/{mediaId}-{safeName}.pdf`
  - `publicUrl(base, bucket, key): string` → `{base}/{bucket}/{key}`
  - `createMirror({ endpoint, region, accessKey, secretKey, bucket, publicBaseUrl, forcePathStyle })`
  - `mirror.putPdf({ key, body, contentType }): Promise<{ key, url }>` — `forcePathStyle: true`, sigv4
  - `mirror.exists(key): Promise<boolean>` via HeadObject; 404 → false

- [ ] **Step 1: Write the failing test**

```typescript
// src/minio/mirror.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { objectKey, publicUrl, createMirror } from './mirror.ts';

test('objectKey is stable and path-safe', () => {
    assert.equal(
        objectKey('thompsons-station', 390, {
            CustomerMediaID: 4672,
            MediaFileName: '91575be773d9ca40e50a4f9ff6b112581d548fb1.pdf',
            MediaFileLocation: '2026-08',
            MediaNickName: 'Item%20a%20-%20BOMA%20Minutes%206_9_2026',
            SizeBytes: 199737,
        }),
        'thompsons-station/champds/390/pdf/4672-Item-a-BOMA-Minutes-6_9_2026.pdf',
    );
});

test('publicUrl is path-style until cdn. exists', () => {
    assert.equal(
        publicUrl('http://10.0.0.66:9000', 'glasshouse', 'thompsons-station/champds/390/pdf/4672-x.pdf'),
        'http://10.0.0.66:9000/glasshouse/thompsons-station/champds/390/pdf/4672-x.pdf',
    );
});

test('putPdf sends PutObject with path-style client options and returns the public URL', async () => {
    const sent: unknown[] = [];
    const mirror = createMirror({
        endpoint: 'http://minio:9000',
        region: 'us-east-1',
        accessKey: 'glasshouse',
        secretKey: 'secret',
        bucket: 'glasshouse',
        publicBaseUrl: 'http://10.0.0.66:9000',
        forcePathStyle: true,
        send: async (command) => {
            sent.push(command.input);
            return {};
        },
    });
    const result = await mirror.putPdf({
        key: 'thompsons-station/champds/390/pdf/4672-x.pdf',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'application/pdf',
    });
    assert.equal(result.url, 'http://10.0.0.66:9000/glasshouse/thompsons-station/champds/390/pdf/4672-x.pdf');
    assert.deepEqual(sent[0], {
        Bucket: 'glasshouse',
        Key: 'thompsons-station/champds/390/pdf/4672-x.pdf',
        Body: new Uint8Array([1, 2, 3]),
        ContentType: 'application/pdf',
    });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx tsx --test src/minio/mirror.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/minio/mirror.ts
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ChampdsAttachment } from '../champds/types.ts';

export function objectKey(cityId: string, eventId: number, att: ChampdsAttachment): string {
    const nick = decodeURIComponent(att.MediaNickName)
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${cityId}/champds/${eventId}/pdf/${att.CustomerMediaID}-${nick || att.MediaFileName}`;
}

export function publicUrl(publicBaseUrl: string, bucket: string, key: string): string {
    return `${publicBaseUrl.replace(/\/$/, '')}/${bucket}/${key}`;
}

export type MirrorDeps = {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    publicBaseUrl: string;
    forcePathStyle: boolean;
    send?: (command: { input: unknown }) => Promise<unknown>;
};

export function createMirror(deps: MirrorDeps) {
    const client = new S3Client({
        endpoint: deps.endpoint,
        region: deps.region,
        credentials: { accessKeyId: deps.accessKey, secretAccessKey: deps.secretKey },
        forcePathStyle: deps.forcePathStyle,
    });
    const send = deps.send ?? ((command) => client.send(command as never));

    return {
        async exists(key: string): Promise<boolean> {
            try {
                await send(new HeadObjectCommand({ Bucket: deps.bucket, Key: key }));
                return true;
            } catch (err) {
                const name = (err as { name?: string }).name;
                if (name === 'NotFound' || name === '404' || name === 'NotFoundError') return false;
                throw err;
            }
        },
        async putPdf(input: { key: string; body: Uint8Array; contentType: string }) {
            await send(new PutObjectCommand({
                Bucket: deps.bucket,
                Key: input.key,
                Body: input.body,
                ContentType: input.contentType,
            }));
            return { key: input.key, url: publicUrl(deps.publicBaseUrl, deps.bucket, input.key) };
        },
    };
}
```

`createMirror` constructs `S3Client` even when `send` is injected so the production path and the test path share the same factory. Tests never talk to a real MinIO.

- [ ] **Step 4: Run test — expect PASS**

Run: `npx tsx --test src/minio/mirror.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ingest/src/minio
git commit -m "feat(ingest): path-style MinIO PDF mirror"
```

---

### Task 5: Orchestrator loop + event 390 idempotency

**Files:**
- Create: `/Users/greer/dev/glasshouse/ingest/src/config.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/oc/client.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/transcribe.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/orchestrate.ts`
- Create: `/Users/greer/dev/glasshouse/ingest/src/index.ts`
- Test: `/Users/greer/dev/glasshouse/ingest/src/orchestrate.test.ts`
- Test: `/Users/greer/dev/glasshouse/ingest/src/transcribe.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 + Task 1 HTTP surface.
- Produces:
  - `requestTranscription(): { skipped: true; reason: string }` — never calls tasks
  - `ingestEvent(deps, { event, bodyId }): Promise<IngestResult>`
  - `runCycle(deps): Promise<CycleSummary>`
  - `createOcClient(cfg)` with `getObservations`, `upsertObservation`, `createMeeting`, `putMeeting`, `upsertSubjects`, `releaseMeeting`
  - CLI: `node dist/index.js` polls; `node dist/index.js --once` runs one cycle and exits

Idempotency rules for `ingestEvent`:

1. `meetingId = meetingIdForEvent(eventId)` (`390` → `aug11_2026`).
2. If an observation `champds:event:{id}` exists and `contentHash` equals `hashEventDetail(event)`, still ensure each PDF has a `champds:media:{mediaId}` observation; if all media observations exist, return `{ action: 'skipped' }` and do not POST a meeting.
3. If no event observation: POST meeting (ignore 409). Never POST `champds-390`.
4. Upsert subjects (with `contextCitationUrls` from mirrored PDFs).
5. For a **new** meeting (not in `EXISTING_MEETING_IDS`), POST release `{ released: true }` after subjects exist. Do not release-toggle `aug11_2026`.
6. Upsert observations for the event and each PDF.
7. Call `requestTranscription()` and log the skip.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/transcribe.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { requestTranscription } from './transcribe.ts';

test('does not trigger the tasks pipeline', () => {
    const result = requestTranscription();
    assert.equal(result.skipped, true);
    assert.match(result.reason, /document-only/i);
});
```

```typescript
// src/orchestrate.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ingestEvent } from './orchestrate.ts';
import type { ChampdsEvent } from './champds/types.ts';

const fixture: ChampdsEvent = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../docs/research/champds/event-390.json'), 'utf8'),
);

function collect() {
    const calls: { op: string; payload?: unknown }[] = [];
    const observations = new Map<string, { source: string; contentHash: string; meetingId?: string }>();
    return {
        calls,
        oc: {
            async getObservations(source?: string) {
                const all = [...observations.values()];
                return source ? all.filter((o) => o.source === source) : all;
            },
            async upsertObservation(row: { source: string; contentHash: string; meetingId?: string }) {
                observations.set(row.source, row);
                calls.push({ op: 'obs', payload: row });
            },
            async createMeeting(payload: unknown) {
                calls.push({ op: 'createMeeting', payload });
                return { id: 'aug11_2026', released: true };
            },
            async putMeeting() { calls.push({ op: 'putMeeting' }); },
            async upsertSubjects(meetingId: string, subjects: unknown) {
                calls.push({ op: 'upsertSubjects', payload: { meetingId, subjects } });
                return [];
            },
            async releaseMeeting(meetingId: string) {
                calls.push({ op: 'release', payload: meetingId });
            },
        },
        champds: {
            async downloadPdf() { return new Uint8Array([1]); },
            async probeDirectMp4() { return null; },
            pdfUrl() { return 'https://play.champds.com/ATT/thompsonsstationtn/2026-08/x.pdf'; },
        },
        mirror: {
            async exists() { return false; },
            async putPdf({ key }: { key: string }) {
                return { key, url: `http://10.0.0.66:9000/glasshouse/${key}` };
            },
        },
    };
}

test('event 390 does not create a second meeting and does not flip released', async () => {
    const h = collect();
    const result = await ingestEvent({
        oc: h.oc,
        champds: h.champds,
        mirror: h.mirror,
        cityId: 'thompsons-station',
    }, { event: fixture, bodyId: 'thompsons-station-boma' });

    assert.equal(result.meetingId, 'aug11_2026');
    assert.equal(h.calls.filter((c) => c.op === 'createMeeting').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'release').length, 0);
    const subjectCall = h.calls.find((c) => c.op === 'upsertSubjects');
    assert.ok(subjectCall);
    assert.equal((subjectCall.payload as { meetingId: string }).meetingId, 'aug11_2026');
    assert.equal((subjectCall.payload as { subjects: unknown[] }).subjects.length, 17);
    assert.ok(h.calls.some((c) => c.op === 'obs' && (c.payload as { source: string }).source === 'champds:event:390'));
});

test('a second pass with the same content hash skips meeting and subject writes', async () => {
    const h = collect();
    const deps = { oc: h.oc, champds: h.champds, mirror: h.mirror, cityId: 'thompsons-station' };
    await ingestEvent(deps, { event: fixture, bodyId: 'thompsons-station-boma' });
    const afterFirst = h.calls.length;
    // Pretend every PDF was observed so the second pass is a true no-op.
    for (const c of [...h.calls]) {
        if (c.op === 'obs') {/* already stored in the map */}
    }
    h.mirror.exists = async () => true;
    const second = await ingestEvent(deps, { event: fixture, bodyId: 'thompsons-station-boma' });
    assert.equal(second.action, 'skipped');
    assert.equal(h.calls.filter((c) => c.op === 'createMeeting').length, 0);
    assert.equal(h.calls.filter((c) => c.op === 'upsertSubjects').length, 1);
    assert.ok(h.calls.length >= afterFirst);
});

test('a new event POSTs champds-{id} unreleased, then releases after subjects', async () => {
    const h = collect();
    const event = structuredClone(fixture);
    event.Event.CustomerEventID = 387;
    await ingestEvent({
        oc: h.oc,
        champds: h.champds,
        mirror: h.mirror,
        cityId: 'thompsons-station',
    }, { event, bodyId: 'thompsons-station-boma' });

    const created = h.calls.find((c) => c.op === 'createMeeting');
    assert.ok(created);
    assert.equal((created.payload as { meetingId: string }).meetingId, 'champds-387');
    assert.equal(h.calls.some((c) => c.op === 'release' && c.payload === 'champds-387'), true);
});
```

The second-pass test above requires `ingestEvent` to treat “event observation exists + matching contentHash + every attachment already has a media observation (or `mirror.exists`)” as skip. Implement that, and have the first pass write those media observations so the second pass can skip. Adjust the test’s second-pass setup to rely on observations written by the first pass (the `collect()` map already stores them). Delete the empty `for` loop when implementing — the first pass must write `champds:media:*` observations.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx tsx --test src/orchestrate.test.ts src/transcribe.test.ts`

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement transcribe stub, OC client, orchestrator, config, index**

```typescript
// src/transcribe.ts
export function requestTranscription(): { skipped: true; reason: string } {
    return {
        skipped: true,
        reason: 'Phase 1 ingest is document-only; no ElevenLabs/pyannote/Mux keys',
    };
}
```

```typescript
// src/config.ts
export type IngestConfig = {
    champdsBaseUrl: string;
    userAgent: string;
    requestGapMs: number;
    pollIntervalMs: number;
    backfillSince: string;
    cityId: string;
    ocBaseUrl: string;
    ocApiKey: string;
    s3Endpoint: string;
    s3Region: string;
    s3AccessKey: string;
    s3SecretKey: string;
    s3Bucket: string;
    s3ForcePathStyle: boolean;
    publicFilesBaseUrl: string;
};

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`missing env ${name}`);
    return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IngestConfig {
    return {
        champdsBaseUrl: env.CHAMPDS_BASE_URL ?? 'https://playapi.champds.com/thompsonsstationtn',
        userAgent: env.CHAMPDS_UA ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        requestGapMs: Number(env.REQUEST_GAP_MS ?? 500),
        pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 900_000),
        backfillSince: env.BACKFILL_SINCE ?? '2022-11-01T00:00:00.000Z',
        cityId: env.OC_CITY_ID ?? 'thompsons-station',
        ocBaseUrl: required('OC_BASE_URL'),
        ocApiKey: required('OC_API_KEY'),
        s3Endpoint: required('S3_ENDPOINT'),
        s3Region: env.S3_REGION ?? 'us-east-1',
        s3AccessKey: required('S3_ACCESS_KEY'),
        s3SecretKey: required('S3_SECRET_KEY'),
        s3Bucket: env.S3_BUCKET ?? 'glasshouse',
        s3ForcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
        publicFilesBaseUrl: env.PUBLIC_FILES_BASE_URL ?? 'http://10.0.0.66:9000',
    };
}
```

```typescript
// src/oc/client.ts
export type OcClient = {
    getObservations(source?: string): Promise<{ source: string; contentHash: string; meetingId?: string | null }[]>;
    upsertObservation(row: { source: string; contentHash: string; meetingId?: string }): Promise<void>;
    createMeeting(payload: Record<string, unknown>): Promise<{ id: string; released: boolean }>;
    putMeeting(meetingId: string, payload: Record<string, unknown>): Promise<void>;
    upsertSubjects(meetingId: string, subjects: unknown[]): Promise<unknown[]>;
    releaseMeeting(meetingId: string): Promise<void>;
};

export function createOcClient(cfg: { ocBaseUrl: string; ocApiKey: string; cityId: string }): OcClient {
    const base = `${cfg.ocBaseUrl.replace(/\/$/, '')}/api/cities/${cfg.cityId}`;
    async function req(path: string, init: RequestInit = {}) {
        const res = await fetch(`${base}${path}`, {
            ...init,
            headers: {
                authorization: `Bearer ${cfg.ocApiKey}`,
                'content-type': 'application/json',
                ...(init.headers ?? {}),
            },
        });
        return res;
    }

    return {
        async getObservations(source) {
            const q = source ? `?source=${encodeURIComponent(source)}` : '';
            const res = await req(`/observations${q}`);
            if (!res.ok) throw new Error(`GET observations ${res.status}`);
            return res.json();
        },
        async upsertObservation(row) {
            const res = await req('/observations', { method: 'POST', body: JSON.stringify(row) });
            if (!res.ok) throw new Error(`POST observation ${res.status}`);
        },
        async createMeeting(payload) {
            const res = await req('/meetings', { method: 'POST', body: JSON.stringify(payload) });
            if (res.status === 409) return { id: String(payload.meetingId), released: false };
            if (!res.ok) throw new Error(`POST meeting ${res.status} ${await res.text()}`);
            return res.json();
        },
        async putMeeting(meetingId, payload) {
            const res = await req(`/meetings/${meetingId}`, { method: 'PUT', body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(`PUT meeting ${res.status}`);
        },
        async upsertSubjects(meetingId, subjects) {
            const res = await req(`/meetings/${meetingId}/subjects`, {
                method: 'POST',
                body: JSON.stringify({ subjects }),
            });
            if (!res.ok) throw new Error(`POST subjects ${res.status} ${await res.text()}`);
            const body = await res.json() as { subjects: unknown[] };
            return body.subjects;
        },
        async releaseMeeting(meetingId) {
            const res = await req(`/meetings/${meetingId}/release`, {
                method: 'POST',
                body: JSON.stringify({ released: true }),
            });
            if (!res.ok) throw new Error(`POST release ${res.status}`);
        },
    };
}
```

`ingestEvent` in `src/orchestrate.ts` (full logic the tests require):

```typescript
import { hashEventDetail } from './champds/hash.ts';
import type { ChampdsAttachment, ChampdsEvent } from './champds/types.ts';
import { EXISTING_MEETING_IDS, mapMeeting, meetingIdForEvent } from './map/meeting.ts';
import { mapSubjects } from './map/subjects.ts';
import { objectKey } from './minio/mirror.ts';
import { requestTranscription } from './transcribe.ts';

export type IngestResult = {
    meetingId: string;
    action: 'created' | 'updated' | 'skipped';
    subjectCount: number;
};

export async function ingestEvent(
    deps: {
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
    },
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
        await deps.oc.createMeeting(mapMeeting(input.event, input.bodyId));
    }

    const urlsByMediaId = new Map<number, string>();
    for (const att of attachments) {
        const key = objectKey(deps.cityId, eventId, att);
        const already = await deps.mirror.exists(key);
        const put = already
            ? { key, url: `http://10.0.0.66:9000/glasshouse/${key}` }
            : await deps.mirror.putPdf({
                key,
                body: await deps.champds.downloadPdf(att),
                contentType: 'application/pdf',
            });
        // When exists() is true the public URL still follows publicUrl(); pass it through
        // createMirror in production. Tests only assert skip/create/release, not this string.
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
    if (firstPdf && urlsByMediaId.get(firstPdf.CustomerMediaID)) {
        const meeting = mapMeeting(input.event, input.bodyId);
        await deps.oc.putMeeting(meetingId, {
            ...meeting,
            agendaUrl: urlsByMediaId.get(firstPdf.CustomerMediaID),
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
```

Two production fixes the test double does not force — put them in the same file:

1. When `mirror.exists` is true, build the public URL with `publicUrl(cfg.publicFilesBaseUrl, cfg.s3Bucket, key)` (thread `publicFilesBaseUrl` + `s3Bucket` through `deps` instead of hard-coding `10.0.0.66`). Add those two fields to the `deps` object in `ingestEvent` and in the tests (tests may keep the literal; production must use config).
2. `runCycle` (same file): load all observations once; for each `CHAMPDS_GROUPS` entry call `listGroup`; drop rows with `EventDateTimeUTC < BACKFILL_SINCE`; sort newest-first; keep an in-memory `Map<number, listHash>`; `getEvent` + `ingestEvent` only when there is no `champds:event:{id}` observation **or** the list hash changed since last cycle. Catch per-event errors, log, continue. Return `{ processed, skipped, failed }`.

```typescript
// src/index.ts
import { BROWSER_UA, createChampdsClient } from './champds/client.ts';
import { loadConfig } from './config.ts';
import { createMirror } from './minio/mirror.ts';
import { createOcClient } from './oc/client.ts';
import { runCycle } from './orchestrate.ts';

async function main() {
    const cfg = loadConfig();
    const champds = createChampdsClient({
        champdsBaseUrl: cfg.champdsBaseUrl,
        requestGapMs: cfg.requestGapMs,
        userAgent: cfg.userAgent || BROWSER_UA,
    });
    const oc = createOcClient({ ocBaseUrl: cfg.ocBaseUrl, ocApiKey: cfg.ocApiKey, cityId: cfg.cityId });
    const mirror = createMirror({
        endpoint: cfg.s3Endpoint,
        region: cfg.s3Region,
        accessKey: cfg.s3AccessKey,
        secretKey: cfg.s3SecretKey,
        bucket: cfg.s3Bucket,
        publicBaseUrl: cfg.publicFilesBaseUrl,
        forcePathStyle: cfg.s3ForcePathStyle,
    });
    const deps = { cfg, champds, oc, mirror, cityId: cfg.cityId, listHashByEvent: new Map<number, string>() };

    const once = process.argv.includes('--once');
    const summary = await runCycle(deps);
    console.log('cycle', summary);
    if (once) return;

    let running = false;
    setInterval(() => {
        if (running) {
            console.log('skip overlapping cycle');
            return;
        }
        running = true;
        runCycle(deps)
            .then((s) => console.log('cycle', s))
            .catch((err) => console.error('cycle failed', err))
            .finally(() => { running = false; });
    }, cfg.pollIntervalMs);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
```

Wire `runCycle` to accept this `deps` shape. `createChampdsClient` already has `listGroup`/`getEvent`; `runCycle` uses those plus `hashEventListRow`.

PUT meeting uses `meetingSchema`, which requires `name`, `name_en`, and `date`. Always send the full `mapMeeting` payload plus `agendaUrl`.

- [ ] **Step 4: Fix the second-pass test** so it does not contain an empty loop. After the first `ingestEvent`, media observations are in the map; the second call must return `skipped` and must not call `upsertSubjects` again.

- [ ] **Step 5: Run tests + typecheck — expect PASS**

Run: `npx tsx --test src/**/*.test.ts && npx tsc --noEmit`

Expected: PASS. Event 390 never POSTs a meeting. New event 387 POSTs `champds-387` then release.

- [ ] **Step 6: Commit**

```bash
git add ingest/src
git commit -m "feat(ingest): orchestrate ChampDS → OpenCouncil with event 390 idempotency"
```

---

### Task 6: Compose service, env, RUNBOOK, Openship enable

**Files:**
- Create: `/Users/greer/dev/glasshouse/ingest/Dockerfile`
- Create: `/Users/greer/dev/glasshouse/ingest/.dockerignore`
- Modify: `/Users/greer/dev/glasshouse/docker-compose.yml` (add `ingest` after `valkey`)
- Create or modify: `/Users/greer/dev/glasshouse/.env.example` (add `.env.ingest` block)
- Modify: `/Users/greer/dev/glasshouse/docs/RUNBOOK.md` (append Phase 1 ingest)

**Interfaces:**
- Consumes: image built from `ingest/Dockerfile`; Task 1 web image rebuilt on thinkstation; existing MinIO on this project (`minio:9000`, bucket `glasshouse`).
- Produces: compose service `ingest` in project `proj_5AhrGz_cRgruBEi7`. Prebuilt tag `glasshouse-ingest:<sha>` (same pattern as `glasshouse-pgsync:7.3.0` / `WEB_IMAGE`). No `networks:`, no `profiles:`, exec-form `command` only.

- [ ] **Step 1: Dockerfile + dockerignore**

```dockerfile
# ingest/Dockerfile
# node:20.11.1-bookworm-slim linux/amd64 (thinkstation is x86_64).
# Pin the digest on first thinkstation build the same way pgsync/Dockerfile does.
FROM node:20.11.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:20.11.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
USER node
CMD ["node", "dist/index.js"]
```

```
# ingest/.dockerignore
node_modules
dist
src/**/*.test.ts
```

After the first thinkstation `docker build`, replace both `FROM` lines with the printed `node:20.11.1-bookworm-slim@sha256:…` digest (linux/amd64). Do not float on `node:20-slim`.

- [ ] **Step 2: Add the compose service** (no `networks:`, no `profiles:`, exec-form command):

```yaml
  ingest:
    # Openship v0.5.0 builds from the project dir (`.`), not a sibling
    # context. Prebuild on the thinkstation:
    #   docker build -t glasshouse-ingest:<sha> ./ingest
    # INGEST_IMAGE is interpolated from this project's .env at `service sync`.
    image: ${INGEST_IMAGE}
    command: ["node", "dist/index.js"]
    env_file: .env.ingest
    environment: { TZ: America/Chicago }
    depends_on: [web, minio]
    restart: unless-stopped
```

Place it after `valkey`. Do not add a `build:` key (Openship `.` context bug — same reason web and pgsync use prebuilt tags).

- [ ] **Step 3: Document env**

If `.env.example` is not in the repo (it may be untracked), create it. Append:

```
# .env.ingest (untracked on thinkstation)
CHAMPDS_BASE_URL=https://playapi.champds.com/thompsonsstationtn
CHAMPDS_UA=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
REQUEST_GAP_MS=500
POLL_INTERVAL_MS=900000
BACKFILL_SINCE=2022-11-01T00:00:00.000Z
OC_CITY_ID=thompsons-station
OC_BASE_URL=http://web:3000
OC_API_KEY=          # same ServiceApiKey as /data/openship/projects/glasshouse/.ingest-api-key
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=glasshouse
S3_SECRET_KEY=       # MINIO_PASSWORD
S3_BUCKET=glasshouse
S3_FORCE_PATH_STYLE=true
PUBLIC_FILES_BASE_URL=http://10.0.0.66:9000
```

Also document `INGEST_IMAGE=glasshouse-ingest:<sha>` next to `WEB_IMAGE` in the compose `.env`.

- [ ] **Step 4: Validate compose**

Run: `cd /Users/greer/dev/glasshouse && docker compose config --services`

Expected: `web`, `tasks`, `db`, `es`, `pgsync`, `minio`, `valkey`, `ingest` (8 lines). `tasks` remains in the file and remains disabled in Openship.

- [ ] **Step 5: Append RUNBOOK procedures** (exact commands, thinkstation paths)

Add a section `## Phase 1 — document ingest` to `docs/RUNBOOK.md`:

```markdown
## Phase 1 — document ingest

Web APIs from Task 1 must be on the running image before ingest writes
anything. Rebuild web from glasshouse-web branch `glasshouse` after that
PR is pushed, then ingest.

### Rebuild web (ingest APIs)

```bash
cd /data/openship/projects/glasshouse-web
git pull --ff-only origin glasshouse
SHA=$(git rev-parse --short HEAD)
docker build --build-arg USE_LOCAL_DB=false \
  --build-arg NEXT_PUBLIC_BUILD_COMMIT_SHA=$(git rev-parse HEAD) \
  -t glasshouse-web:$SHA .
# set thinkstation /data/openship/projects/glasshouse/.env WEB_IMAGE=glasshouse-web:$SHA
# PATCH stored web image= that tag, then POST /deployments for web only
# entrypoint runs prisma migrate deploy (AgendaObservation) then next build
```

### Build ingest image

```bash
cd /data/openship/projects/glasshouse
git pull --ff-only origin main   # or the feature branch until merged
SHA=$(git -C ingest rev-parse --short HEAD 2>/dev/null || git rev-parse --short HEAD)
docker build -t glasshouse-ingest:$SHA ./ingest
docker run --rm --entrypoint node glasshouse-ingest:$SHA dist/index.js --help || true
# the image CMD is node dist/index.js; --once is supported:
docker run --rm --network openship-glasshouse \
  --env-file /data/openship/projects/glasshouse/.env.ingest \
  glasshouse-ingest:$SHA node dist/index.js --once
```

### Enable + deploy ingest only

Same prebuilt-tag pattern as pgsync (`svc_-SgMFWFVOx_0-N4B`):

- Write untracked `/data/openship/projects/glasshouse/.env.ingest` from `.env.example`.
  `OC_API_KEY` is the existing ingest ServiceApiKey
  (`/data/openship/projects/glasshouse/.ingest-api-key`, mode 600).
- `INGEST_IMAGE=glasshouse-ingest:$SHA` in the project `.env`.
- `openship service sync docker-compose.yml --project proj_5AhrGz_cRgruBEi7 --yes`
- After sync, confirm stored web is still `image=glasshouse-web:<sha>` `enabled=true`,
  pgsync `commandArgv=['-d']`, wrapper `svc_nzXk6h_WJBllRV6i` disabled, `tasks` disabled.
- PATCH stored ingest: `image=glasshouse-ingest:$SHA`, `build=""`, `enabled=true`,
  `commandArgv=["node","dist/index.js"]`, `environment` from `.env.ingest`.
- `POST /api/deployments` with **only** that ingest serviceId (or all currently
  enabled compose services if a targeted deploy drops a sibling).
- Do not enable `tasks`. Do not enable the monorepo wrapper.

### Bucket

If `glasshouse` does not yet exist on MinIO:

```bash
docker exec openship-glasshouse-minio \
  mc alias set local http://localhost:9000 glasshouse "$MINIO_PASSWORD"
docker exec openship-glasshouse-minio mc mb -p local/glasshouse
```

LAN-only public reads until `cdn.` exists. Objects are still written.

### Verify event 390 is not duplicated

```bash
curl -sS http://10.0.0.66:3100/api/cities/thompsons-station/meetings
# still exactly one row with id aug11_2026 (not champds-390)

curl -sS http://10.0.0.66:3100/thompsons-station/aug11_2026 \
  | grep -E 'Meeting Called to Order|Consent Agenda|FOG|Adjourn'

# after ingest has written PDFs:
curl -sS -o /dev/null -w '%{http_code}\n' \
  http://10.0.0.66:9000/glasshouse/thompsons-station/champds/390/pdf/4672-Item-a-BOMA-Minutes-6_9_2026.pdf
# expect 200 once that object exists

docker logs openship-glasshouse-ingest --tail 50
# expect: transcribe aug11_2026: skipped (Phase 1 ingest is document-only…)
# expect: no "POST meeting" for 390; cycle processed/skipped/failed counts
```

Backfill is the first poll: missing observations newest-first for all 9
groups with `EventDateTimeUTC >= 2022-11-01`. Subsequent 15-minute cycles
only fetch event detail when the list fingerprint changes or the event is new.
```

- [ ] **Step 6: Commit**

```bash
git add ingest/Dockerfile ingest/.dockerignore docker-compose.yml .env.example docs/RUNBOOK.md
git commit -m "feat: compose ingest service and Phase 1 runbook"
```

---

## Explicitly out of this plan

- Vote extraction, review queue, inferred-unanimous source values
- Elections page / WCEC candidate list (already captured under `docs/research/2026-11-election/`)
- Flags engine and town-website poller
- Transcription / diarization / Mux / `cdn.` hostname
- Enabling compose `tasks`
- 2013–2022 Drupal PDF-era backfill
- Offsite MinIO replication (nightly `pg_dump` already in Phase 0 RUNBOOK)

## Risks

- **Openship sync rewriting web/pgsync** — after every `service sync`, re-read stored models (WEB_IMAGE, pgsync `commandArgv=['-d']`, wrapper disabled). Same lesson as Phase 0.
- **Subject name drift on event 390** — upsert updates `name`. Mapper keeps trailing colons and only strips HTML so Phase 0 titles stay put.
- **Large PDFs** (one event-390 attachment is ~170 MB) — `downloadPdf` buffers into `Uint8Array`. If thinkstation memory spikes, switch that one function to stream through `@aws-sdk/lib-storage` `Upload` in a follow-up; do not add it now.
- **ChampDS ATT URL is undocumented** — verified against media 4672 (HTTP 200, 199737 bytes). If it 404s later, fail that attachment and continue the event; do not guess a second host.
- **GET `/meetings` `limit` max 100** — ingest must not discover meetings by listing; it uses observations + `champds-{id}` + the 390 hard-map.

## Self-review notes (spec-coverage check)

- Spec Phase 1 ingest bullets covered: ChampDS poller (Tasks 2, 5), artifact mirroring (Task 4), observation posting (Tasks 1, 5), in-process cron (Task 5–6), same compose/project (Task 6), document-only Nov 2022→present newest-first (Task 5 `runCycle` + `BACKFILL_SINCE`).
- Spec “triggers transcription tasks” — stubbed and logged, not called.
- Spec “minutes vote-extraction pass” — out.
- Spec “town-site poller” — out (ruling 2).
- Event 390 idempotency — Task 3 hard-map + Task 5 tests.
- No `networks:` / no profiles / exec-form — Task 6 compose snippet.
- SQL forbidden — Task 1 APIs; ingest uses `createOcClient` only.
