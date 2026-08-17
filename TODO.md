# Glasshouse — TODO

Spec: `docs/superpowers/specs/2026-08-16-glasshouse-design.md` (approved 2026-08-16, critical-assessment complete)

## Time-critical (independent of build)
- [x] **2026-08-17:** pre-deadline WCEC capture saved in `docs/research/2026-11-election/` (no names yet — qualifying still open).
- [ ] **Thu Aug 20, 2026 after noon + Fri Aug 21 WCEC meeting:** recapture certified/qualified Nov 2026 municipal list (TS Mayor + 2 alderman).
- [ ] **Thu Aug 27, 2026 after noon:** recapture ballot-final list after withdrawal.
- [ ] User decision (pre-public-launch): TN attorney consult re LLC + media-liability insurance.

## Phase 0 — bring-up (weeks 1–2)
- [x] Fork schemalabz/opencouncil → `greerso/glasshouse-web`, opencouncil-tasks → `greerso/glasshouse-tasks` (public, branch `glasshouse` pushed; ops repo at `greerso/glasshouse`)
- [x] Prisma migration: CityLanguage 'en', Realm 'us' (+ US realm, en default, /en-invariant fix — glasshouse-web@8f6099ee)
- [x] English pipeline support in tasks fork (scribeCode eng + CLI validation — glasshouse-tasks@2e85a52)
- [x] S3_FORCE_PATH_STYLE + PUBLIC_FILES_BASE_URL for self-hosted MinIO (tasks fork)
- [x] Fail-closed registration allowlist (incl. petition/notification bypass paths) + AGPL SHA footer (web fork)
- [x] Compose stack for Openship (7 services, ES schema adapted for self-hosted) — feature/phase0-bringup
- [ ] **GATE (user):** register glasshouse.town + Cloudflare zone; API keys: Anthropic, ElevenLabs (speech-to-text), pyannote.ai, Mux, Resend, Mapbox, Google geocoding (NO Perplexity needed); confirm openship CLI access to thinkstation
- [ ] Openship deploy full stack on thinkstation (project create → service sync → POST /deployments; verify stored model incl. env fidelity)
- [x] Elasticsearch auth + index bootstrap (pgsync --bootstrap + GRANT); PGSync daemon
- [ ] Cloudflare Tunnel (glasshouse.town → web, cdn. → MinIO read-only, tasks. → pyannote callbacks); host firewall
- [x] Seed: superadmin, City, 9 AdministrativeBodies, People/Roles (rosters in spec)
- [ ] Manual E2E: one meeting (ChampDS MP4) → transcribe → summarize → review UI
- [ ] Contact Schema Labs (Discord) re first US instance (user action)

## Phase 1 — ingestion + backfill + elections (weeks 3–5)
- [ ] `glasshouse-ingest`: ChampDS + town-site poller, MinIO mirroring, task triggering, observation posting
- [ ] Vote extraction (roll-call > transcript > voice-vote inference rule) + review queue
- [ ] Backfill Nov 2022→present, newest-first, $500 cap w/ reassess at 20 videos
- [ ] Elections page (candidate list, historical results)
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
