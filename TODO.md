# Glasshouse — TODO

Spec: `docs/superpowers/specs/2026-08-16-glasshouse-design.md` (approved 2026-08-16, critical-assessment complete)

## Time-critical (independent of build)
- [ ] **Week of Aug 20, 2026:** capture certified Nov 2026 candidate list from Williamson County Election Commission (qualifying closes Thu Aug 20 noon; withdrawal Aug 27). Preserve artifacts.
- [ ] User decision (pre-public-launch): TN attorney consult re LLC + media-liability insurance.

## Phase 0 — bring-up (weeks 1–2)
- [ ] Fork schemalabz/opencouncil → `glasshouse`, schemalabz/opencouncil-tasks → `glasshouse-tasks` (public, AGPL)
- [ ] Openship deploy full stack on thinkstation (project create → service sync → POST /deployments; see spec's Openship constraints)
- [ ] Elasticsearch auth + index bootstrap; PGSync service
- [ ] Cloudflare Tunnel for web app; host firewall for everything else
- [ ] Prisma migration: CityLanguage 'en', Realm 'us'
- [ ] Seed: City, 9 AdministrativeBodies, People/Roles (rosters in spec research)
- [ ] Manual E2E: one meeting → transcribe → summarize → review UI
- [ ] Contact Schema Labs (Discord) re first US instance

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
