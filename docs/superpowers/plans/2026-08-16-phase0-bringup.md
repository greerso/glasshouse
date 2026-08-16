# Glasshouse Phase 0 (Bring-Up) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, US-localized OpenCouncil fork stack deployed via Openship on the thinkstation, seeded with Thompson's Station bodies/people, with one meeting processed end-to-end.

**Architecture:** Three repos — `glasshouse` (this repo: compose stack, ops docs, later the ingest service), `glasshouse-web` (fork of schemalabz/opencouncil at `/Users/greer/dev/glasshouse-web`, upstream HEAD `cdf4397`), `glasshouse-tasks` (fork of schemalabz/opencouncil-tasks at `/Users/greer/dev/glasshouse-tasks`, upstream HEAD `12dbc2a`). One Openship project runs all seven containers; Cloudflare Tunnel exposes only the web app plus a read-only artifact hostname.

**Tech Stack:** Next.js 15/16 + Prisma + Postgres/PostGIS, Express task server (Node 20), Elasticsearch 8/9 + PGSync, MinIO, Valkey, Openship v0.5.0, Cloudflare Tunnel.

**Spec:** `docs/superpowers/specs/2026-08-16-glasshouse-design.md`

## Global Constraints

- Fork discipline: every fork change is a minimal, isolated commit on branch `glasshouse` in each fork repo; upstream remains `upstream` remote; never rewrite upstream history.
- `<DOMAIN>` is a placeholder for the production domain (user decision, pending). Until chosen, use the Cloudflare Tunnel hostname for `NEXTAUTH_URL` and realm domain; all uses are parameterized so the swap is config-only.
- Node: web repo requires `>=24.15.0 <25`; tasks repo requires `^20.11.1`. Use the repo-local version (nvm/asdf or Docker) — do not "upgrade" either.
- Openship v0.5.0 rules (spec § Openship deployment constraints): one project, one compose file, no `networks:` keys (dropped anyway), no compose profiles (openship `service sync` runs `docker compose config`, which excludes profile-gated services), commands set only via `service sync`, verify stored model after every sync.
- Secrets live only in the Openship env config and local untracked `.env` files. Nothing secret is ever committed.
- Timezone everywhere: `America/Chicago`.
- AGPL: deploy only pushed commits; `NEXT_PUBLIC_BUILD_COMMIT_SHA` must equal the deployed HEAD.

## Prerequisites (user-provided, needed from Task 7 onward; Tasks 1–6 need none)

- [ ] Domain choice + registration (`<DOMAIN>`); Cloudflare account with the zone added.
- [ ] API keys: Anthropic; ElevenLabs (key must have `speech_to_text` permission); pyannote.ai; Mux (token id + secret); Resend (plus domain verification once `<DOMAIN>` exists); Mapbox public token; Google API key (geocoding). No Perplexity key (upstream README is stale; code uses Claude web search — verified `grep -rn PERPLEXITY src/` is empty in the tasks repo).
- [ ] GitHub: confirm account/org to own the two public forks + this repo's remote.

---

### Task 1: GitHub forks and fork branches

**Files:**
- No file edits; git/remote operations in `/Users/greer/dev/glasshouse-web` and `/Users/greer/dev/glasshouse-tasks`.

**Interfaces:**
- Produces: public GitHub repos `glasshouse-web` and `glasshouse-tasks` with branch `glasshouse` pushed; local clones with `origin` = our fork, `upstream` = schemalabz. All later fork tasks commit to branch `glasshouse`.

- [ ] **Step 1: Create the forks on GitHub**

```bash
gh repo fork schemalabz/opencouncil --fork-name glasshouse-web --clone=false
gh repo fork schemalabz/opencouncil-tasks --fork-name glasshouse-tasks --clone=false
```
Expected: two forks created under the user's account (`gh repo view <user>/glasshouse-web` succeeds).

- [ ] **Step 2: Re-point remotes on the existing clones**

```bash
GHUSER=$(gh api user -q .login)
cd /Users/greer/dev/glasshouse-web
git remote rename origin upstream
git remote add origin "https://github.com/$GHUSER/glasshouse-web.git"
git checkout -b glasshouse
git push -u origin glasshouse && git push origin main
cd /Users/greer/dev/glasshouse-tasks
git remote rename origin upstream
git remote add origin "https://github.com/$GHUSER/glasshouse-tasks.git"
git checkout -b glasshouse
git push -u origin glasshouse && git push origin main
```

- [ ] **Step 3: Verify**

Run: `git -C /Users/greer/dev/glasshouse-web remote -v && git -C /Users/greer/dev/glasshouse-web branch --show-current`
Expected: `origin` → our fork, `upstream` → schemalabz, branch `glasshouse`.

- [ ] **Step 4: Record pinned upstream SHAs**

```bash
cd /Users/greer/dev/glasshouse
cat > docs/UPSTREAM.md <<'EOF'
# Upstream pins (Phase 0 baseline)
- glasshouse-web forked from schemalabz/opencouncil @ cdf4397a5ad666d1cf53bfd04e66154e7e702713
- glasshouse-tasks forked from schemalabz/opencouncil-tasks @ 12dbc2adcac31a7c5dd87b7726dea0b11fd53242
Rebase policy: fast-follow upstream main; our changes live on branch `glasshouse` as a short patch series.
EOF
git add docs/UPSTREAM.md && git commit -m "docs: record upstream fork pins"
```

---

### Task 2: tasks fork — English language support

**Files:**
- Modify: `/Users/greer/dev/glasshouse-tasks/src/types.ts` (line ~41, `CityLanguage` union)
- Modify: `/Users/greer/dev/glasshouse-tasks/src/lib/language.ts` (`LANGUAGES` map, ~line 97)
- Test: `/Users/greer/dev/glasshouse-tasks/src/lib/language.test.ts` (create)

**Interfaces:**
- Consumes: `getLanguageConfig(language)` existing behavior (falls back to Greek for unknown).
- Produces: `getLanguageConfig('en')` → `{ scribeCode: 'eng', ... }`; `'en'` accepted wherever `CityLanguage` is typed (transcribe requests pass `cityLanguage: 'en'`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/language.test.ts
import { describe, it, expect } from 'vitest';
import { getLanguageConfig } from './language.js';

describe('English language config', () => {
    it('returns an English config with the eng Scribe code', () => {
        const cfg = getLanguageConfig('en');
        expect(cfg.scribeCode).toBe('eng');
        expect(cfg.outputDirective.toLowerCase()).toContain('english');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/greer/dev/glasshouse-tasks && npx vitest run src/lib/language.test.ts`
Expected: FAIL — `getLanguageConfig('en')` currently falls back to the Greek config (`scribeCode: 'ell'`), and/or a TS type error because `'en'` is not in `CityLanguage`.

- [ ] **Step 3: Add `'en'` to the CityLanguage union**

In `src/types.ts` (~line 41), change:
```typescript
export type CityLanguage = 'el' | 'fr' | 'sr';
```
to:
```typescript
export type CityLanguage = 'el' | 'fr' | 'sr' | 'en';
```

- [ ] **Step 4: Add the English entry to `LANGUAGES` in `src/lib/language.ts`**

Follow the exact shape of the existing `fr`/`sr` entries (read them first — copy the field set verbatim, do not invent fields). Content for the entry:
```typescript
en: {
    scribeCode: 'eng',
    promptName: 'English',
    outputDirective:
        'IMPORTANT: All of your output (summaries, subject names, descriptions, notes) must be written in clear American English.',
    defaultAdministrativeBodyName: 'Board of Mayor and Aldermen',
    summaryErrorText: 'A summary could not be generated for this item.',
    fixTranscriptNotes:
        'The transcript is in American English from a small-town Tennessee municipal meeting. Fix obvious mis-transcriptions of local terms: "Thompson\'s Station", "alderman/aldermen", "BOMA", "rezoning", "ordinance", "resolution", names of Tennessee places.',
},
```
(If the real `LanguageConfig` type has additional required fields, fill them by analogy with the `fr` entry — English-language values, same structure.)

- [ ] **Step 5: Run test to verify it passes, plus typecheck**

Run: `npx vitest run src/lib/language.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/language.ts src/lib/language.test.ts
git commit -m "feat: add English (en) language support with eng Scribe code"
```

---

### Task 3: tasks fork — storage/URL config for production MinIO

**Files:**
- Modify: `/Users/greer/dev/glasshouse-tasks/src/utils.ts` (`isUsingMinIO()`, ~lines 62–65)
- Modify: `/Users/greer/dev/glasshouse-tasks/src/tasks/utils/spacesUrl.ts` (public URL builder, ~lines 31–35)
- Test: `/Users/greer/dev/glasshouse-tasks/src/tasks/utils/spacesUrl.test.ts` (create)

**Interfaces:**
- Consumes: existing `DO_SPACES_*` env config.
- Produces: two new optional env vars — `S3_FORCE_PATH_STYLE=true` (forces path-style + sigv4 regardless of endpoint hostname) and `PUBLIC_FILES_BASE_URL` (e.g. `https://cdn.<DOMAIN>`; when set, public object URLs are `${PUBLIC_FILES_BASE_URL}/${bucket}/${key}`). Task 6's compose sets both. Without them, upstream behavior is unchanged (upstream-PR-friendly).

**Why:** upstream `isUsingMinIO()` keys off the endpoint hostname containing `'minio'`/`'localhost'` and then serves dev-only proxy URLs; production MinIO behind a tunnel needs explicit path-style and an explicit public base URL (verified in `src/utils.ts:62-65`, `src/tasks/utils/spacesUrl.ts:31-35`).

- [ ] **Step 1: Read both files fully** (`src/utils.ts`, `src/tasks/utils/spacesUrl.ts`) to capture the exact current function shapes before editing.

- [ ] **Step 2: Write the failing test**

```typescript
// src/tasks/utils/spacesUrl.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('public object URLs with PUBLIC_FILES_BASE_URL', () => {
    const saved = { ...process.env };
    beforeEach(() => {
        process.env.DO_SPACES_ENDPOINT = 'http://minio:9000';
        process.env.DO_SPACES_BUCKET = 'glasshouse';
        process.env.PUBLIC_FILES_BASE_URL = 'https://cdn.example.org';
    });
    afterEach(() => { process.env = { ...saved }; });

    it('builds public URLs from PUBLIC_FILES_BASE_URL', async () => {
        const { getPublicUrl } = await import('./spacesUrl.js');
        expect(getPublicUrl('glasshouse', 'media/x.mp4'))
            .toBe('https://cdn.example.org/glasshouse/media/x.mp4');
    });
});
```
(Adjust the imported function name to the real export in `spacesUrl.ts` found in Step 1 — the test must exercise the real public-URL builder, whatever its name; if env is read at module import time, use `vi.resetModules()` before the dynamic import.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/tasks/utils/spacesUrl.test.ts`
Expected: FAIL (current builder returns the dev-proxy or virtual-hosted URL).

- [ ] **Step 4: Implement**

In `spacesUrl.ts`, at the top of the public-URL builder add:
```typescript
if (process.env.PUBLIC_FILES_BASE_URL) {
    return `${process.env.PUBLIC_FILES_BASE_URL.replace(/\/$/, '')}/${bucket}/${key}`;
}
```
In `utils.ts`, change `isUsingMinIO()` (or the S3 client options it feeds) so that `process.env.S3_FORCE_PATH_STYLE === 'true'` also enables `s3ForcePathStyle: true, signatureVersion: 'v4'` — without altering the existing hostname heuristic.

- [ ] **Step 5: Run test + typecheck + full test suite**

Run: `npx vitest run src/tasks/utils/spacesUrl.test.ts && npm run typecheck && npm test`
Expected: new test PASS; no regressions in existing tests.

- [ ] **Step 6: Commit**

```bash
git add src/utils.ts src/tasks/utils/spacesUrl.ts src/tasks/utils/spacesUrl.test.ts
git commit -m "feat: explicit S3_FORCE_PATH_STYLE and PUBLIC_FILES_BASE_URL for self-hosted S3"
```

---

### Task 4: web fork — US realm, English default, en/us enums

**Files:**
- Modify: `/Users/greer/dev/glasshouse-web/prisma/schema.prisma` (lines 68–72 `CityLanguage`, 75–80 `Realm`)
- Create: `prisma/migrations/<timestamp>_add_en_us_enums/migration.sql` (via prisma)
- Modify: `src/lib/realm.ts` (REALMS const lines 24–48, defaultLocale union line 43, `realmForHost` default lines 120–122, `REALM_DEFAULT_MAP_VIEW` lines 72–77)
- Modify: `src/i18n/config.ts` (line 14 `DEFAULT_LOCALE`)
- Modify: `src/auth.config.ts` (hardcoded `from: 'OpenCouncil <auth@opencouncil.gr>'` → env-driven)
- Test: colocated with existing realm/i18n tests (find with `git grep -l "realmForHost\|DEFAULT_LOCALE" -- 'src/**/*.test.*'`)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: Prisma enums `CityLanguage.en`, `Realm.us`; `REALMS.us = { domain: <realm domain env/placeholder>, defaultLocale: 'en', country: 'US', ... }`; unknown hosts resolve to realm `us`; `AUTH_EMAIL_FROM` env var. Task 8 seeds a City with `language: en, realm: us`.

- [ ] **Step 1: Locate the existing realm/i18n tests and test runner**

Run: `cd /Users/greer/dev/glasshouse-web && cat package.json | python3 -c "import json,sys; print(json.load(sys.stdin)['scripts'].get('test'))" && git grep -l "realmForHost" -- 'src/**/*.test.*' 'src/**/*.spec.*'`
Note the runner and file conventions; the next steps' test files follow them.

- [ ] **Step 2: Write the failing test** (in the discovered convention; content:)

```typescript
import { realmForHost, REALMS } from '@/lib/realm';

it('exposes a US realm with English default locale', () => {
    expect(REALMS.us.defaultLocale).toBe('en');
    expect(REALMS.us.country).toBe('US');
});

it('defaults unknown hosts to the us realm', () => {
    expect(realmForHost('some-unknown-host.example')).toBe('us');
});
```

- [ ] **Step 3: Run it — expect FAIL** (`REALMS.us` undefined; unknown hosts currently → `'greece'`).

- [ ] **Step 4: Prisma enum additions + migration**

In `prisma/schema.prisma`: add `en` to `enum CityLanguage` and `us` to `enum Realm`. Then:
```bash
npx prisma migrate dev --name add_en_us_enums --create-only
cat prisma/migrations/*add_en_us_enums/migration.sql
```
Expected SQL: `ALTER TYPE "CityLanguage" ADD VALUE 'en'; ALTER TYPE "Realm" ADD VALUE 'us';` (needs a running dev DB — `./run.sh` with-db profile or a throwaway `docker run postgis/postgis:16-3.5`).

- [ ] **Step 5: realm.ts changes**

Widen the union at line 43 to include `'en'`, add to `REALMS` (mirror the exact field set of the `serbia` entry — read it first):
```typescript
us: {
    domain: process.env.NEXT_PUBLIC_REALM_DOMAIN ?? 'glasshouse.localhost',
    defaultLocale: 'en',
    country: 'US',
    // contact/phone fields: reuse the shape; use a contact email, no phone
},
```
Add `REALM_DEFAULT_MAP_VIEW.us` centered on Thompson's Station: `{ center: [-86.9114, 35.8023], zoom: 11 }` (match the existing entries' exact shape). Change `realmForHost` fallback (lines 120–122) from `'greece'` to `'us'`.

- [ ] **Step 6: i18n + auth email**

`src/i18n/config.ts` line 14: `DEFAULT_LOCALE = 'en'`. (`LOCALES` already contains `'en'`; `next.config.mjs` locale regexes already include `en` — verify with `grep -n "en|el|fr|sr" next.config.mjs`.)
`src/auth.config.ts`: replace the hardcoded from-address with `process.env.AUTH_EMAIL_FROM ?? 'Glasshouse <auth@glasshouse.localhost>'`.

- [ ] **Step 7: Run the new test + the locale-prefix drift guard test + typecheck**

Run: the discovered test command scoped to realm/i18n tests, then `npx tsc --noEmit` (or the repo's typecheck script).
Expected: PASS. If other existing tests assert `'greece'` as the unknown-host default, update those assertions in the same commit — that behavior change is deliberate.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/realm.ts src/i18n/config.ts src/auth.config.ts <test files>
git commit -m "feat: US realm with English default; en/us enums; env-driven auth from-address"
```

---

### Task 5: web fork — registration allowlist + build SHA in footer

**Files:**
- Modify: `/Users/greer/dev/glasshouse-web/src/auth.ts` (add `signIn` callback)
- Modify: `src/components/layout/Footer.tsx` (source links lines ~131/168, add SHA)
- Test: colocated per Task 4's discovered convention

**Interfaces:**
- Consumes: NextAuth v5 config in `src/auth.ts` (PrismaAdapter + Resend magic-link — currently NO gate: any email gets a User row).
- Produces: `AUTH_ALLOWED_EMAILS` env (comma-separated; unset = closed to everyone except existing users — fail-closed); footer shows deployed SHA from `NEXT_PUBLIC_BUILD_COMMIT_SHA` linking to our fork.

- [ ] **Step 1: Write the failing test** for the allowlist helper:

```typescript
import { isEmailAllowed } from '@/lib/auth/allowlist';

it('allows listed emails case-insensitively', () => {
    expect(isEmailAllowed('Daniel@Example.com', 'daniel@example.com,x@y.z')).toBe(true);
});
it('fails closed when the allowlist is unset or empty', () => {
    expect(isEmailAllowed('daniel@example.com', undefined)).toBe(false);
    expect(isEmailAllowed('daniel@example.com', '')).toBe(false);
});
```

- [ ] **Step 2: Run — expect FAIL** (module doesn't exist).

- [ ] **Step 3: Implement `src/lib/auth/allowlist.ts`**

```typescript
export function isEmailAllowed(email: string, allowlist: string | undefined): boolean {
    if (!allowlist) return false;
    const allowed = allowlist.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return allowed.includes(email.toLowerCase());
}
```
Wire into `src/auth.ts` callbacks (alongside the existing session/redirect callbacks):
```typescript
async signIn({ user }) {
    if (!user.email) return false;
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) return true; // existing users keep access
    return isEmailAllowed(user.email, process.env.AUTH_ALLOWED_EMAILS);
},
```
(Use the prisma import pattern already present in `src/auth.ts`; read the file first and match it.)

- [ ] **Step 4: Footer SHA**

In `Footer.tsx`: point the two GitHub links at `https://github.com/<GHUSER>/glasshouse-web` and append next to the copyright line:
```tsx
{process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA && (
    <a href={`https://github.com/<GHUSER>/glasshouse-web/tree/${process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA}`}>
        source@{process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA.slice(0, 7)}
    </a>
)}
```

- [ ] **Step 5: Run tests + typecheck — expect PASS. Commit**

```bash
git add src/lib/auth/allowlist.ts src/auth.ts src/components/layout/Footer.tsx <test file>
git commit -m "feat: fail-closed email allowlist for registration; AGPL source SHA in footer"
```

---

### Task 6: ops repo — the Openship compose stack

**Files:**
- Create: `/Users/greer/dev/glasshouse/docker-compose.yml`
- Create: `/Users/greer/dev/glasshouse/.env.example`
- Create: `/Users/greer/dev/glasshouse/elasticsearch/schema.json` (adapted copy) and `elasticsearch/views.sql` (verbatim copy from web repo)

**Interfaces:**
- Consumes: fork branches from Tasks 1–5 (images built from `/Users/greer/dev/glasshouse-web` and `/Users/greer/dev/glasshouse-tasks` Dockerfiles).
- Produces: the single profile-less compose file Task 7 syncs into Openship. Service names (= in-project DNS): `web`, `tasks`, `db`, `es`, `pgsync`, `minio`, `valkey`.

- [ ] **Step 1: Write `docker-compose.yml`** — no `networks:` keys, no profiles, exec-form commands only:

```yaml
services:
  web:
    build: { context: /Users/greer/dev/glasshouse-web }
    ports: ["3000:3000"]
    env_file: .env.web
    depends_on: [db, valkey]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 5
  tasks:
    build: { context: /Users/greer/dev/glasshouse-tasks }
    ports: ["3005:3005"]
    env_file: .env.tasks
    environment: { TZ: America/Chicago }
    volumes:
      - ./volumes/tasks-data:/app/data
      - ./volumes/tasks-logs:/app/logs
    restart: unless-stopped
  db:
    image: postgis/postgis:16-3.5
    command: ["postgres", "-c", "wal_level=logical", "-c", "max_connections=200"]
    environment:
      POSTGRES_USER: glasshouse
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: glasshouse
    volumes: ["./volumes/pgdata:/var/lib/postgresql/data"]
    restart: unless-stopped
  es:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.17.0
    environment:
      discovery.type: single-node
      xpack.security.enabled: "true"
      ELASTIC_PASSWORD: ${ES_PASSWORD}
      ES_JAVA_OPTS: "-Xms1g -Xmx1g"
    volumes: ["./volumes/esdata:/usr/share/elasticsearch/data"]
    restart: unless-stopped
  pgsync:
    image: toluaina1/pgsync:latest
    command: ["-d"]
    env_file: .env.pgsync
    depends_on: [db, es, valkey]
    restart: unless-stopped
  minio:
    image: minio/minio:latest
    command: ["server", "/data", "--console-address", ":9001"]
    environment:
      MINIO_ROOT_USER: glasshouse
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes: ["./volumes/miniodata:/data"]
    ports: ["9000:9000", "9001:9001"]
    restart: unless-stopped
  valkey:
    image: valkey/valkey:8-alpine
    restart: unless-stopped
```
Notes locked in: PGSync checkpoints to Valkey (`REDIS_URL=redis://valkey:6379/1` — no separate redis container); the app cache uses `CACHE_URL=redis://valkey:6379/0`. If Openship's stored model later shows it cannot express `build.context` outside the project dir, vendor the two forks as git submodules or prebuild images — decide at Task 7 sync time, preferring prebuilt images tagged with the git SHA.

- [ ] **Step 2: Write `.env.example`** documenting every var consumed above plus the three env files:
`.env.web` (the 17 required vars from `src/env.mjs` — DATABASE_URL/DIRECT_URL → `postgresql://glasshouse:...@db:5432/glasshouse`, `TASK_API_URL=http://tasks:3005`, `ELASTICSEARCH_URL=http://es:9200`, `DO_SPACES_ENDPOINT=http://minio:9000`, `CDN_URL=https://cdn.<DOMAIN>`, `NEXTAUTH_URL=https://<DOMAIN>`, plus `AUTH_ALLOWED_EMAILS`, `AUTH_EMAIL_FROM`, `NEXT_PUBLIC_REALM_DOMAIN=<DOMAIN>`, `NEXT_PUBLIC_BUILD_COMMIT_SHA`, `CRON_SECRET`);
`.env.tasks` (`PORT=3005`, `API_TOKENS=["<generated>"]`, `PUBLIC_URL=https://tasks.<DOMAIN>` (pyannote result callbacks — hostname created in Task 8 step 4), `DO_SPACES_*` → minio, `S3_FORCE_PATH_STYLE=true`, `PUBLIC_FILES_BASE_URL=https://cdn.<DOMAIN>`, `ELEVENLABS_API_KEY`, `PYANNOTE_*`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `MUX_TOKEN_ID/SECRET`, `CORS_ORIGINS_ALLOWED=https://<DOMAIN>`);
`.env.pgsync` (`PG_URL`, `ELASTICSEARCH_URL=http://es:9200`, `ELASTICSEARCH_API_KEY_ID/KEY` or basic-auth per image docs, `REDIS_URL=redis://valkey:6379/1`, `REDIS_CHECKPOINT=true`, `ELASTICSEARCH=true`, `SCHEMA_URL` → raw URL of our vendored `elasticsearch/schema.json` on GitHub).

- [ ] **Step 3: Vendor + adapt the ES schema**

```bash
cp /Users/greer/dev/glasshouse-web/elasticsearch/views.sql elasticsearch/views.sql
cp /Users/greer/dev/glasshouse-web/elasticsearch/schema.json elasticsearch/schema.json
```
Edit `elasticsearch/schema.json`: replace every `semantic_text` field mapping (they reference inference endpoint `opencouncil-multilingual-e5-small-elasticsearch`, which only exists on their Elastic Cloud) with standard `text` mappings. Record the diff in a comment block at the top of a new `elasticsearch/README.md`.

- [ ] **Step 4: Validate compose renders with no dropped services**

Run: `cd /Users/greer/dev/glasshouse && docker compose config --services`
Expected output: exactly `web tasks db es pgsync minio valkey` (7 lines).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example elasticsearch/
git commit -m "feat: single-project compose stack for Openship deployment"
```

---

### Task 7: Deploy to Openship on the thinkstation

**Files:**
- No repo edits; Openship CLI operations on the thinkstation from the repo checkout there. Real `.env.web`/`.env.tasks`/`.env.pgsync` assembled from `.env.example` + user-provided keys (Prerequisites).

**Interfaces:**
- Consumes: Task 6 compose file; fork branches pushed (Task 1–5).
- Produces: running stack; the deployed-commit rule satisfied (`git status` clean at deploy, `NEXT_PUBLIC_BUILD_COMMIT_SHA=$(git -C ../glasshouse-web rev-parse HEAD)`).

- [ ] **Step 1: Generate secrets**

```bash
openssl rand -hex 32   # NEXTAUTH_SECRET
openssl rand -hex 32   # tasks API token → API_TOKENS=["<value>"] and .env.web TASK_API_KEY
openssl rand -hex 16   # DB_PASSWORD; repeat for ES_PASSWORD, MINIO_PASSWORD, CRON_SECRET
```

- [ ] **Step 2: Create project + sync (the compose-only path — `openship deploy` 400s)**

```bash
openship project create --name glasshouse --type docker --port 3000
openship service sync docker-compose.yml --project <projId> --yes
openship api /deployments -X POST -d '{"projectId":"<projId>","environment":"production"}'
```

- [ ] **Step 3: Verify the stored model, not the YAML**

```bash
for s in web tasks db es pgsync minio valkey; do openship service get $s --project <projId> --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('name'), d.get('command'), d.get('commandArgv'))"; done
docker ps --format '{{.Names}}\t{{.Ports}}'
docker inspect <web-container> --format '{{json .NetworkSettings.Networks}}'
```
Expected: every service present; `commandArgv` non-null for db/es/minio/pgsync (exec-form preserved); all containers on `openship-glasshouse`; ports published as declared. If any service was dropped or `commandArgv` is null: re-run `openship service sync` (never `service update --command`).

- [ ] **Step 4: Postgres post-deploy setup (one-time)**

```bash
docker exec -it <db-container> psql -U glasshouse -d glasshouse -c "SHOW wal_level;"   # expect: logical
docker exec -i <db-container> psql -U glasshouse -d glasshouse < elasticsearch/views.sql
```
Web app migrations run via its entrypoint (`prisma migrate deploy`); confirm: `docker logs <web-container> | grep -i migrate` shows applied migrations including `add_en_us_enums`.

- [ ] **Step 5: Health checks**

```bash
curl -s http://localhost:3005/health          # tasks: yt-dlp + token status JSON
curl -s http://localhost:3000/ -o /dev/null -w '%{http_code}\n'   # expect 200
curl -su elastic:$ES_PASSWORD http://localhost:9200/_cluster/health   # expect yellow|green
```

- [ ] **Step 6: Host firewall**

Openship strips loopback binds to 0.0.0.0 — verify then block: only 3000 (web, and only until the tunnel is up), nothing else, reachable from off-host. Configure macOS/Linux firewall on the thinkstation accordingly; verify from another machine that 5432/9200/9000/9001/3005 are NOT reachable.

---

### Task 8: Cloudflare Tunnel + artifact hostname

**Files:**
- Create: `/Users/greer/dev/glasshouse/docs/RUNBOOK.md` (start it: tunnel + deploy + verify procedures as executed)

**Interfaces:**
- Consumes: running stack (Task 7); Cloudflare zone (prerequisite).
- Produces: `https://<DOMAIN>` → `web:3000`; `https://cdn.<DOMAIN>` → `minio:9000` (read-only); no port 3000 exposure needed afterward.

- [ ] **Step 1: Create the tunnel** (`cloudflared tunnel create glasshouse`; config maps `<DOMAIN>` → `http://localhost:3000`, `cdn.<DOMAIN>` → `http://localhost:9000`). Run `cloudflared` as a host service (launchd/systemd), not an Openship container (it needs no inbound ports and outlives redeploys).

- [ ] **Step 2: MinIO read-only public policy** for the artifact bucket only:

```bash
docker exec <minio-container> mc alias set local http://localhost:9000 glasshouse $MINIO_PASSWORD
docker exec <minio-container> mc mb local/glasshouse
docker exec <minio-container> mc anonymous set download local/glasshouse
```

- [ ] **Step 3: Verify end-to-end**

`curl -s -o /dev/null -w '%{http_code}' https://<DOMAIN>` → 200; upload a test object, fetch `https://cdn.<DOMAIN>/glasshouse/<key>` → 200; verify a write attempt against cdn host fails (405/403). Then close port 3000 at the host firewall and re-verify the site still serves via the tunnel.

- [ ] **Step 4: pyannote callback route** — pyannote.ai's hosted API POSTs results back to `PUBLIC_URL/callback/:id` on the tasks server. Set `.env.tasks` `PUBLIC_URL=https://tasks.<DOMAIN>` and add a third tunnel hostname `tasks.<DOMAIN>` → `http://localhost:3005`, protected by adding `/callback` to the tasks server's `PUBLIC_ENDPOINTS` (callbacks are unauthenticated) while everything else on that hostname still requires the Bearer token. Verify: `curl https://tasks.<DOMAIN>/health` → 200, `curl https://tasks.<DOMAIN>/transcribe -X POST` → 401.

- [ ] **Step 5: Commit RUNBOOK.md** with the exact procedures as executed.

---

### Task 9: Superadmin bootstrap + Thompson's Station seed

**Files:**
- Create: `/Users/greer/dev/glasshouse/seed/thompsons-station.sql` (bodies + people + roles, idempotent inserts)

**Interfaces:**
- Consumes: running site (Task 8), `AUTH_ALLOWED_EMAILS` containing Daniel's email.
- Produces: superadmin account; City `thompsons-station` (`language: en`, `realm: us`, timezone `America/Chicago`); 9 AdministrativeBodies; People/Roles for BOMA, Planning Commission, BZA. Task 10 creates a meeting under this city.

- [ ] **Step 1: First login + superadmin flip** — sign in via magic link (Resend must be live), then:

```bash
docker exec -it <db-container> psql -U glasshouse -d glasshouse \
  -c "UPDATE \"User\" SET \"isSuperAdmin\" = true WHERE email = '<daniel-email>';"
```
Verify: `/admin` loads.

- [ ] **Step 2: Create the City** via the superadmin UI (`CityForm` → POST `/api/cities`): id/slug `thompsons-station`, name "Thompson's Station" (name_en same), authorityType municipality, language `en`, realm `us`, timezone `America/Chicago`, population 7485. (Do NOT use the AI populate flow — we seed deterministically.)

- [ ] **Step 3: Create the 9 AdministrativeBodies** (UI or SQL seed file; `type` uses enum `council|committee|community` — map: BOMA → `council`; Planning Commission, BZA, Beer Board, Econ Dev & Infrastructure Acceleration Board, Utility Advisory Board, Parks & Recreation Advisory Board → `committee`; Joint Workshops, Special Events → `community`).

- [ ] **Step 4: Seed People + Roles** (write `seed/thompsons-station.sql` with `INSERT ... ON CONFLICT DO NOTHING`, or use the admin UI; either way the data is):
BOMA: Brian Stover (Mayor), Shaun Alexander (Vice Mayor), Bob Whitmer (Alderman), Kreis White (Alderman), Harry King (Alderman).
Planning Commission: Tara Rumpler (Chair), Sean Cagle (Vice-Chair), Kreis White (Alderman member — same Person as BOMA's, second Role), Trent Harris, Tom Stephenson, Sarah Alexander, Charles Starck.
BZA: Mary Herring (Chair), Lori Clemons, Bryce Levet, Jeff Risden, Amy Griffin.
(Source: town website rosters captured 2026-08-16 — see spec. No parties: leave Party empty; these are nonpartisan offices.)

- [ ] **Step 5: Create a ServiceApiKey** at `/admin/settings/api-keys` (superadmin UI) — save the raw key for Phase 1's ingest service in the ops secret store.

- [ ] **Step 6: Verify** — city page renders at `https://<DOMAIN>/thompsons-station` listing the bodies and people; commit `seed/thompsons-station.sql`.

---

### Task 10: PGSync bootstrap + search verification

**Interfaces:**
- Consumes: running db/es/pgsync (Task 7), views installed (Task 7 step 4).
- Produces: `subjects` index live; `/api/search` returns 200.

- [ ] **Step 1: Bootstrap** (one-time; from the thinkstation checkout):

```bash
docker compose run --rm -e ELASTICSEARCH_TIMEOUT=120 -e ELASTICSEARCH_CHUNK_SIZE=50 pgsync --bootstrap
docker exec -i <db-container> psql -U glasshouse -d glasshouse -c 'GRANT SELECT ON public._view TO glasshouse;'
```
(The GRANT must be re-run after every future bootstrap — record in RUNBOOK.md.)

- [ ] **Step 2: Verify index + daemon**

```bash
curl -su elastic:$ES_PASSWORD http://localhost:9200/_cat/indices | grep subjects
docker logs <pgsync-container> --tail 20   # syncing, no auth/schema errors
curl -s -X POST https://<DOMAIN>/api/search -H 'content-type: application/json' -d '{"query":"test"}' -o /dev/null -w '%{http_code}\n'   # expect 200 (empty results), NOT 500
```

---

### Task 11: End-to-end pipeline proof (one real meeting)

**Interfaces:**
- Consumes: everything above.
- Produces: one Thompson's Station BOMA meeting with video, synced transcript, and summaries visible in the review UI — the Phase 0 exit criterion.

- [ ] **Step 1: Pick a recent BOMA meeting with video** from the ChampDS API:

```bash
curl -s -A "Mozilla/5.0" "https://playapi.champds.com/thompsonsstationtn/archiveGroupListWithMedia/1" | python3 -m json.tool | head -80
```
Note its `CustomerEventID`, date, and MP4 `MediaPath` URL (direct MP4 — the tasks pipeline's Direct-URL branch handles it; HLS would not work).

- [ ] **Step 2: Create the meeting** in the admin UI (AddMeetingForm) under city `thompsons-station`, body BOMA: name e.g. "Board of Mayor and Aldermen — Regular Meeting", date from the event, `youtubeUrl` = the MP4 MediaPath URL (the field accepts any URL; the pipeline branches on it).

- [ ] **Step 3: Trigger transcription** from the meeting Admin panel (`requestTranscribe`). Watch:

```bash
docker logs -f <tasks-container>    # pipeline stages: download → spaces upload → mux → diarize → split → scribe
```
Expected wall time: roughly real-time-ish for a 1–3h meeting; cost ≈ $1–3.

- [ ] **Step 4: Verify the result** — meeting page shows video player + speaker-attributed transcript; trigger summarize from the admin panel; verify agenda subjects/summaries render in English; verify TaskStatus rows completed (`/api/cities/thompsons-station/meetings/<id>/taskStatuses` via admin).

- [ ] **Step 5: Verify artifact provenance** — the video/audio now live in MinIO (`mc ls local/glasshouse/council-meeting-videos/`), public URLs resolve via `https://cdn.<DOMAIN>/...`.

- [ ] **Step 6: Record Phase 0 completion** — update `TODO.md` (check off Phase 0 items), append actuals (cost, duration, gotchas) to `docs/RUNBOOK.md`, commit.

---

## Explicitly deferred to Phase 1+ (do not build now)

`glasshouse-ingest` service, vote extraction, backfill, flags, digests, elections page, RSS/iCal, offsite backups (spec Phase 2 gate — but enable a nightly `pg_dump` cron on the host as soon as Task 7 completes; one line in RUNBOOK.md), Schema Labs outreach (do send the Discord intro during Phase 0 — it's a message, not code).

## Self-review notes (spec-coverage check)

- Spec Phase 0 bullets → Tasks: forks (1), Openship deploy (6–7), ES/PGSync (6, 10), Tunnel (8), enums migration (4), seed city/bodies/people (9), E2E meeting (11), Schema Labs contact (deferred-note above), candidate-list capture (ops TODO, week of Aug 20 — not a code task).
- Perplexity dropped from prerequisites (verified stale README; Claude web search in code).
- Mux kept (spec decision) — mock-fallback exists but playback + egress favor keeping it.
- English pipeline caveat carried from recon: upstream prompt bodies are Greek prose with an English output directive appended; acceptable for Phase 0 E2E, revisit prompt quality in Phase 1 (flag any nonsense summaries in Task 11 step 4).
