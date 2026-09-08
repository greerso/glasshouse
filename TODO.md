# Glasshouse — TODO

Spec: `docs/superpowers/specs/2026-08-16-glasshouse-design.md` (approved 2026-08-16, critical-assessment complete)

## Time-critical (independent of build)
- [x] **2026-08-17:** pre-deadline WCEC capture saved in `docs/research/2026-11-election/` (no names yet — qualifying still open).
- [x] **2026-08-18:** mid-window recapture — still zero names. Observation: `docs/research/2026-11-election/candidates-observed-2026-08-18.md`. JSON left `candidates: []`; no rebuild. #2
- [x] **Thu Aug 20 / Fri Aug 21 / Mon Sep 1:** recapture qualified Nov 2026 municipal list. WCEC still has **zero published names** (observation `candidates-observed-2026-09-01.md`). JSON left `candidates: []`. #2
- [x] **2026-09-06:** recapture — still zero names, but **WCEC certifies the list Fri Sep 11, 2026, 1:00 p.m.** (posted agenda, New Business item 1: approve qualified municipal candidates for Fairview / Nolensville / Thompson's Station). Observation `candidates-observed-2026-09-06.md`. JSON left `candidates: []`. #2
- [ ] **Fri Sep 11, 2026 after ~2:30 p.m. CDT:** recapture the approved list (Public Notices, Candidate Information, Sep 11 minutes, DocumentCenter IDs **above 29624**), plus Nov 3 sample ballot + approved early-voting locations. #2
- [ ] **Tue Sep 8, 2026 — email WCEC** (issue #2 step 4): chad.gray@williamsoncounty-tn.gov / (615) 790-5711 — ask for petitions filed / qualified names for TS Mayor + Alderman and whether the approved list gets posted after Sep 11. Save the written reply. Office closed Mon Sep 7 (Labor Day). Then copy into JSON and rebuild. #2
- [ ] User decision (pre-public-launch): TN attorney consult re LLC + media-liability insurance.

## Phase 0 — bring-up (weeks 1–2)
- [x] Fork schemalabz/opencouncil → `greerso/glasshouse-web`, opencouncil-tasks → `greerso/glasshouse-tasks` (public, branch `glasshouse` pushed; ops repo at `greerso/glasshouse`)
- [x] Prisma migration: CityLanguage 'en', Realm 'us' (+ US realm, en default, /en-invariant fix — glasshouse-web@8f6099ee)
- [x] English pipeline support in tasks fork (scribeCode eng + CLI validation — glasshouse-tasks@2e85a52)
- [x] S3_FORCE_PATH_STYLE + PUBLIC_FILES_BASE_URL for self-hosted MinIO (tasks fork)
- [x] Fail-closed registration allowlist (incl. petition/notification bypass paths) + AGPL SHA footer (web fork)
- [x] Compose stack for Openship (7 services, ES schema adapted for self-hosted) — feature/phase0-bringup
- [ ] **GATE (user):** register glasshouse.town + Cloudflare zone (confirmed **still unregistered** 2026-09-06 — Identity Digital RDAP returns 404 and no `glasshouse.*` zone exists in the Magnolia Tech Services CF account; site is staged on `glasshouse.greerso.com` meanwhile); API keys: Anthropic, ElevenLabs (speech-to-text), pyannote.ai, Mux, Resend, Mapbox, Google geocoding (NO Perplexity needed); confirm openship CLI access to thinkstation
- [ ] Openship deploy full stack on thinkstation (project create → service sync → POST /deployments; verify stored model incl. env fidelity)
- [x] Elasticsearch auth + index bootstrap (pgsync --bootstrap + GRANT); PGSync daemon
- [ ] Cloudflare Tunnel — **web + cdn done on staging.** web 2026-09-06: `https://glasshouse.greerso.com` → `http://glasshouse-os:3000`. cdn 2026-09-07: `https://cdn-glasshouse.greerso.com` → `http://glasshouse-minio-os:9000`, anonymous `s3:GetObject` only (not MinIO's canned `download`, which also grants `ListBucket` and left the bucket enumerable); object 206, listing 403. Both hosts are tunnel `magnolia-thinkstation` (now **v53**, 55 rules) plus an explicit proxied CNAME, with the container attached to `magnolia` through the `magnolia-mesh-attach` alias map so it survives redeploys. #5 — Still out: `tasks.` → pyannote callbacks (tasks service is not deployed), host firewall, and the swap to the real domain once registered.
- [x] **2026-09-06:** the `us` realm no longer advertises the unregistered `glasshouse.town` — `NEXT_PUBLIC_REALM_DOMAIN` is a Dockerfile build arg (glasshouse-web#1) and the web service env names `glasshouse.greerso.com`, so canonical/hreflang, sitemap, robots, notification emails and the country switcher point somewhere that resolves. Swap both to `glasshouse.town` at the GATE. #6
- [x] **2026-09-06:** rotated the Postgres password and `NEXTAUTH_SECRET` (exposed in a prior session transcript) and the Elasticsearch `elastic` password (exposed while diagnosing #7).
- [x] **2026-09-07:** AGPL footer source link now matches the running code. `next build` moved into the image (#4), so the build arg is the only source; both `NEXT_PUBLIC_*` were deleted from the service env store. Live footer links `/tree/543ea17ce38b…`, the commit the image was built from. #8 #4
- [x] **2026-09-07:** `service sync` declared unsupported and the second copy of the env deleted. The thinkstation `.env*` files did exist, but had drifted stale (db/es passwords, web `DATABASE_URL`/`DIRECT_URL`/`NEXTAUTH_SECRET`/`NEXTAUTH_URL`/`NEXT_PUBLIC_REALM_DOMAIN`, pgsync `PG_URL` + ES credentials), so a sync would have silently reverted the Sep 6 rotations across four services rather than blanking them. Compose now declares the credential keys store-only; the stale files are archived under `/data/openship/backups/glasshouse/env-archive-2026-09-07/`. #7
- [x] **2026-09-06:** pgsync → Elasticsearch auth broke on redeploy (same empty-stored-credential shape as minio); fixed by resetting the cluster password. No catch-up needed — ES `subjects` is at 2002 docs vs 2001 `"Subject"` rows. #7
- [x] Seed: superadmin, City, 9 AdministrativeBodies, People/Roles (rosters in spec)
- [ ] **Decide:** 161 `CouncilMeeting.agendaUrl` rows still hold `http://10.0.0.66:9000/...` (LAN, unreachable publicly). `ingest.PUBLIC_FILES_BASE_URL` now points at the CDN so new mirrors are fine, but the poller skips events whose `contentHash` is unchanged, so most existing rows will not self-heal. One reversible `UPDATE ... replace(...)` fixes them — needs a go-ahead before touching live rows.
- [ ] Web container has no stored healthcheck applied yet — `advanced.healthcheck` was `{}` and is now patched to `startPeriod: 90s`, but it only takes effect on the next container recreation.
- [ ] Manual E2E: one meeting (ChampDS MP4) → transcribe → summarize → review UI
- [ ] Contact Schema Labs (Discord) re first US instance (user action)

## Phase 1 — ingestion + backfill + elections (weeks 3–5)
- [x] `glasshouse-ingest`: ChampDS document-only poller live (meetings + subjects + PDF mirror + observations). Town-site poller / transcription trigger still out.
- [ ] Town-site poller (late-agenda observations) — not in the ChampDS ingest plan
- [x] Vote extraction from minutes PDFs (named Yay/Nay → SubjectVote; unreviewed badge). Transcript path still out.
- [ ] Vote review queue for *ongoing* meetings (full review before publish) — backfill already publishes unreviewed
- [ ] Backfill Nov 2022→present, newest-first, $500 cap w/ reassess at 20 videos
- [x] Elections stub live at `/thompsons-station/elections` (seats only; `candidates: []` until WCEC list)
- [x] Vote feed is the US city home; nav Votes / Elections / People / Archive; default `body=all`. Live `glasshouse-web@0d8bff3f`. Paths are city-scoped — `/thompsons-station`, `/thompsons-station/votes`, `/thompsons-station/meetings` (Archive) — and `/` 307s to the city. There are no root-level `/votes` or `/meetings` routes and none are wanted (#6).
- [ ] Put WCEC-qualified names on `/elections` after WCEC (or Chad Gray reply) names people (never invent names; never read `Person`) — #2. Sep 6 recapture still `candidates: []`; certification is Sep 11.
- [x] **2026-09-07:** OC contact chrome gone from the US realm — footer email/socials, and the error and both 404 pages. Contact channels are realm config now (`contactPhone`/`contactEmail`, both optional); `us` declares neither, so the block renders nothing rather than something wrong. Verified live: zero `hello@opencouncil.gr`, `opencouncil_gr`, `schemalabs.substack` on `/thompsons-station`. #3
- [ ] 10-meeting accuracy audit; quiet launch w/ About/methodology/corrections/redaction pages

## Phase 2 — scrutiny features (weeks 6–9)
- [ ] Flags engine + applicability table + methodology pages
- [ ] Digest drafter → listmonk (weekly + T-48h preview)
- [ ] RSS + iCal; people-page vote/attendance stats
- [ ] Backups: nightly pg_dump + rclone offsite; restore drill (launch gate)
- [ ] security-checker pass; PUBLIC LAUNCH + press outreach (before early voting ~Oct 14)

## Phase 3 — deep archive + distribution (weeks 10–14)
- [ ] 2013–2022 PDF backfill (document-only meetings)
- [ ] Guides completion; campaign-finance page
- [ ] Facebook auto-posts; SMS; de-Mux evaluation
