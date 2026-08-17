# Glasshouse operator runbook (Phase 0)

Procedures as executed on the thinkstation (10.0.0.66). Secrets live only in
untracked `/data/openship/projects/glasshouse/.env*` and the Openship stored
model. Do not commit `.env*`. Timezone: America/Chicago.

Project `proj_5AhrGz_cRgruBEi7`. Compose services share the Docker network
`openship-glasshouse` and resolve each other by service name (`db`, `es`,
`valkey`, `web`, `pgsync`, `minio`).

Openship CLI on the box: `~/.local/bin/openship` (not on a non-login `PATH`).
Do not run `openship up` on a laptop. Do not `docker compose run` against this
stack — Openship does not attach compose to `openship-glasshouse`.

## PGSync image

Pinned image `glasshouse-pgsync:7.3.0` (pgsync 7.3.0 on
`python:3.12.11-slim-bookworm` linux/amd64 digest in `pgsync/Dockerfile`).

```bash
cd /data/openship/projects/glasshouse
git pull --ff-only origin feature/phase0-bringup
docker build -t glasshouse-pgsync:7.3.0 ./pgsync
docker run --rm --entrypoint pgsync glasshouse-pgsync:7.3.0 --help
# 7.3.0 flags used here: --bootstrap / -b  and  -d / --daemon
docker run --rm --entrypoint pgsync glasshouse-pgsync:7.3.0 --version
# Version: 7.3.0
```

The daemon command is `["-d"]` (compose + stored `commandArgv`). Do not
`openship service update --command`.

## Bootstrap (one-time; re-run only if slots/triggers/`_view` are gone)

Not `docker compose run`. One-off on the project network, env from the
untracked file (never printed):

```bash
docker run --rm --network openship-glasshouse \
  --env-file /data/openship/projects/glasshouse/.env.pgsync \
  -e ELASTICSEARCH_TIMEOUT=120 -e ELASTICSEARCH_CHUNK_SIZE=50 \
  glasshouse-pgsync:7.3.0 --bootstrap
```

`pgsync --bootstrap` (7.3.0) creates triggers, the `glasshouse_subjects`
logical slot, materialized view `public._view`, the `subjects` ES index, then
does an initial pull and exits.

### GRANT after every bootstrap

pgsync creates `public._view`. Re-run this after every bootstrap even though
role `glasshouse` owns the object:

```bash
docker exec openship-glasshouse-db \
  psql -U glasshouse -d glasshouse \
  -c 'GRANT SELECT ON public._view TO glasshouse;'
```

## ES auth (pgsync vs web)

`xpack.security.enabled=true`. 9200 is not published on the host.

pgsync 7.3.0: if `ELASTICSEARCH_URL` is set, `get_search_url()` returns it
verbatim and ignores `ELASTICSEARCH_USER`/`ELASTICSEARCH_PASSWORD`.

Openship injects the web service env into sibling containers. Web sets
`ELASTICSEARCH_URL=http://es:9200` (API-key auth, no userinfo). That leaked
URL 401s pgsync unless basic auth is also supplied as
`ELASTICSEARCH_HTTP_AUTH=elastic,<password>` (comma-separated; password must
not contain a comma). That pair is in thinkstation `.env.pgsync` and in the
stored pgsync `environment`.

Web uses `ELASTICSEARCH_API_KEY` (minted after first ES boot), not basic auth.

## Verify `_cat/indices` (from inside the ES container)

Expand the password on the host from `.env`. Do not rely on a host export
inside `docker exec`.

```bash
ES_PASSWORD=$(sed -n 's/^ES_PASSWORD=//p' /data/openship/projects/glasshouse/.env)
docker exec -e ES_PASSWORD="$ES_PASSWORD" openship-glasshouse-es \
  curl -sS -u "elastic:${ES_PASSWORD}" 'http://localhost:9200/_cat/indices?v'
# expect a subjects row (yellow on single-node is normal: replica unassigned)
```

## Enable + deploy pgsync only

Prefer a prebuilt tag (same pattern as web). After the image exists:

- PATCH stored pgsync `svc_-SgMFWFVOx_0-N4B`: `image=glasshouse-pgsync:7.3.0`,
  `build=""`, `enabled=true`, `environment` from `.env.pgsync` (must include
  `ELASTICSEARCH_HTTP_AUTH`). Leave `commandArgv=['-d']`.
- `POST /api/deployments` with **only** that serviceId (or all currently
  enabled compose services if a targeted deploy drops a sibling).
- Do not enable `tasks`. Do not enable monorepo wrapper `svc_nzXk6h_WJBllRV6i`.

Do not `service sync` unless thinkstation `.env` already has `WEB_IMAGE` set
to the running web tag. After any sync, confirm stored web is still
`image=glasshouse-web:<sha>` `enabled=true`, pgsync `commandArgv=['-d']`,
wrapper disabled.

## LAN search

No public domain this session. Verify against the published web port:

```bash
curl -sS -X POST http://10.0.0.66:3100/api/search \
  -H 'content-type: application/json' \
  -d '{"query":"test"}'
# expect HTTP 200 (empty results are OK before meetings exist)
```

Self-hosted ES 8.17 basic license does not include RRF. The web search path
used in Phase 0 is BM25 (`enableSemanticSearch: false`). Do not start a
trial license just to keep the upstream RRF/semantic retrievers.

## Daemon health

```bash
docker ps --filter name=openship-glasshouse-pgsync
docker logs openship-glasshouse-pgsync --tail 20
# expect: Sync glasshouse:subjects Xlog: … (no 401 / schema errors)
```

`pg_replication_slots.glasshouse_subjects` may show `active=f`. pgsync 7.3.0
uses peek/get on the slot rather than a long-lived walsender.

## Nightly pg_dump (host crontab, user greer, America/Chicago)

Installed in Task 7:

```
0 3 * * * docker exec openship-glasshouse-db pg_dump -U glasshouse -d glasshouse | gzip > /data/openship/backups/glasshouse/glasshouse-$(date +\%F).sql.gz
```

## Web image rebuild (when glasshouse-web HEAD moves)

```bash
cd /data/openship/projects/glasshouse-web
git pull --ff-only origin glasshouse
SHA=$(git rev-parse --short HEAD)
docker build --build-arg USE_LOCAL_DB=false \
  --build-arg NEXT_PUBLIC_BUILD_COMMIT_SHA=$(git rev-parse HEAD) \
  -t glasshouse-web:$SHA .
# set thinkstation /data/openship/projects/glasshouse/.env WEB_IMAGE=glasshouse-web:$SHA
# PATCH stored web image= that tag, then POST /deployments for web only
```

The entrypoint runs `next build` at container start (minutes before :3100
opens).

## Task 11 — meeting proof (unblocked slice, 2026-08-17)

Transcription / Mux / `cdn.` stay blocked. No Anthropic, ElevenLabs,
pyannote, or Mux keys. `tasks` is still disabled. Do not call
`requestTranscribe`. Do not treat Phase 0 E2E as complete.

### What exists on thinkstation

- City `thompsons-station`, body `thompsons-station-boma`.
- Meeting `aug11_2026`: **Board of Mayor and Aldermen — Regular Meeting**,
  `dateTime` `2026-08-11T23:00:00.000Z` (ChampDS event **390**, local
  `2026-08-11 18:00` America/Chicago). Created via
  `POST /api/cities/thompsons-station/meetings` with the ingest service key
  (`Authorization: Bearer` from `/data/openship/projects/glasshouse/.ingest-api-key`,
  mode 600). `processAgenda: false`.
- POST always inserts `released=false`. Released afterward:
  `UPDATE "CouncilMeeting" SET released = true WHERE id = 'aug11_2026';`
- `youtubeUrl` **omitted** — no working direct MP4 (HTTP 200 + video
  content-type). ChampDS `MediaPath` is
  `/2026-08/9406ff0ae567d88b0dd4927b6eabb9c95b91b44e.mp4`. Probes:
  `securestream10` 404; `securestream2` NXDOMAIN; `securestream7` HTML
  “Not Found.” HLS **does** play at
  `https://securestream7.champds.com/ThompsonsStationTNOD/_definst_/2026-08/9406ff0ae567d88b0dd4927b6eabb9c95b91b44e.mp4/playlist.m3u8?PLAY`
  (`application/vnd.apple.mpegurl`). Do not store that as `youtubeUrl`;
  the tasks Direct-URL branch needs an MP4.
- **17 subjects** from the ChampDS agenda (7 top-level + 10 children of
  “Agenda Items”). No create-subject POST exists (only superadmin PATCH
  on `/subjects/:id`), so rows were inserted to match Prisma `Subject`
  (`name`, `description`, `agendaItemIndex`, no `name_en`, no votes).
  Top-level `agendaItemIndex` = ChampDS `OrderOrdinal` (0, 10, 20, 30,
  40, 50, 70). Child ordinals collide with those, so children use
  `51 + OrderOrdinal/10` (51–61) and sort between “Agenda Items” (50)
  and Adjourn (70).
- Official JSON: `docs/research/champds/event-390.json`.

Meeting id was passed as `aug11_2026`. If omitted, web
`formatDateAsMeetingId` uses `Europe/Athens` and would slug this UTC
instant as `aug12_2026`.

### Verify (LAN)

```bash
curl -sS http://10.0.0.66:3100/api/cities/thompsons-station/meetings
# one meeting, id aug11_2026, released true, 17 subjects

curl -sS http://10.0.0.66:3100/thompsons-station | grep -F 'Board of Mayor and Aldermen — Regular Meeting'

curl -sS http://10.0.0.66:3100/thompsons-station/aug11_2026 | grep -E 'Meeting Called to Order|Consent Agenda|FOG|Adjourn'
# "No subjects" in the HTML is the i18n bundle string, not an empty list
```

pgsync (if up) will show `Elasticsearch: [17]` for `glasshouse:subjects`.
Web image stays `glasshouse-web:a44a4018`. Do not enable `tasks` until
the keys exist.

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
