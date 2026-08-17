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
