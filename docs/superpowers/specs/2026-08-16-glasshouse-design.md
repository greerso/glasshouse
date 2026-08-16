# Glasshouse — Thompson's Station Government Transparency Site

## Context

Thompson's Station, TN (2025 certified pop. 7,485 per MTAS; actual likely higher given growth) is governed by a 5-member Board of Mayor and Aldermen whose recent elections have been effectively uncontested: Mayor Brian Stover ran unopposed in 2022 (2,355 votes); the 2024 race had exactly two candidates for two seats. The dominant local controversy (Simon's "Sagefield" development) required **no public vote** because zoning was already in place — the consequential decisions happen upstream in the Planning Commission and land-use process, largely unwatched. Daniel (a resident) wants a website that makes what the town government discusses, votes on, and spends visible to residents — "sunlight is the best disinfectant" — and that makes officials aware they operate under scrutiny.

**Hard external deadline:** Mayor + 2 alderman seats (Stover, Alexander, Whitmer) are on the **Nov 3, 2026 ballot**. Candidate qualifying closes **Thursday Aug 20, 2026, 12:00 noon** (withdrawal Aug 27) per the Williamson County Election Commission calendar — days after this plan was written. The certified candidate list must be fetched the week of Aug 20 regardless of build progress, and the elections page ships early (Phase 1), not last.

## Decisions (made with user, 2026-08-16)

| Decision | Choice |
|---|---|
| Editorial posture | **Hybrid: neutral facts + automated factual flags** (no opinion/characterization) |
| Operations | **Solo, near-zero touch** — automated pipeline, ~1–2 hrs/wk (review + fork upkeep) |
| Distribution | Email digest + pre-meeting previews, RSS + iCal (phase 2); Facebook auto-posts, SMS (phase 3) |
| Attribution | **Named** — run openly by Daniel, a Thompson's Station resident |
| Coverage | **All 9 public bodies**, full backfill: structured era (Nov 2022+, ChampDS) AND PDF era (Feb 2013–2022) |
| Participation layer | **Yes, full**: elections info, campaign finance, how-to-run / how-to-be-appointed / how-to-comment guides |
| Approach | **Fork OpenCouncil** (github.com/schemalabz/opencouncil, AGPL-3.0) + thin adaptations + custom modules |
| Hosting | **Openship on the thinkstation** (single project/compose stack; not Coolify) |

## Key research findings (verified 2026-08-16)

### Data sources
- **ChampDS JSON API (primary, verified live):** `https://playapi.champds.com/thompsonsstationtn/` — unauthenticated. `archive/1` lists 9 archive groups (BOMA, Planning Commission, BZA, Beer Board, Econ Dev & Infrastructure Acceleration Board, Parks & Rec, Utility Advisory, Joint Workshops, Special Events); `archiveGroupListWithMedia/{groupID}`, `archiveGroupDate/{groupID}/LOCAL/{startISO}/{endISO}`, `event/{CustomerEventID}` return **structured itemized agendas** with per-item PDF attachments, minutes PDFs, and video (MP4 `MediaPath` + HLS via EarthChannel CDN). Coverage ~Nov 2022→present; 42 of 45 BOMA events have video. Send a browser User-Agent (root site 403s without one). **Caveat (verified): all 9 archive groups carry an identical `LastModifyDateTimeUTC` — the vendor bulk-touches records, so modify-timestamps are a hint requiring content diff, never evidence on their own.**
- **Pre-2023 archive:** `thompsons-station.gov/agendas-minutes-and-videos/archives-2022-and-older` — ~15 paginated Drupal pages of PDF links under `/sites/default/files/uploads/{agendas,minutes,other-agenda-files}/`, filename pattern `_MMDDYYYY-{nodeid}.pdf`, back to Feb 26, 2013. One-time scrape.
- **Meeting calendar JSON:** `thompsons-station.gov/vc3-fullcalendar-events-feed?id=events_calendar&display=events_overview&start=…&end=…` (verified). No iCal/RSS exists today — we will provide both.
- **Budgets/audits:** scrape the Finance page (`/departments/finance/financial-budgets-and-audits`) for links — **do not construct URLs** (the guessed `{YEAR}-town-budget.pdf` pattern 404s; real files use fiscal-span names in varying directories, e.g. `/uploads/documents/2014-2015-annual-audit-report.pdf`).
- **Municipal code:** MTAS-hosted PDFs (last codified 2025-02-11). Low churn.
- **Campaign finance:** local candidates file with the **Williamson County Election Commission** (not the state Registry) — county-level, likely PDFs or records requests. Quarterly manual fetch (accepted recurring manual task).
- **Not scrapeable:** GeoCivix permitting portal (login-gated). ArcGIS Online maps exist (queryable later, not in scope).

### Legal grounding (Tennessee)
- **Votes in minutes (T.C.A. §8-44-104):** minutes must record persons present, motions, and vote results — but individual member votes **only in the event of a roll call**. The statutory default "public vote" is a voice vote recording only the outcome. Consequence for extraction: many items will read "motion carried unanimously" with no per-member breakdown — see the vote-inference rule below. Secret votes are prohibited.
- **Agendas (T.C.A. §8-44-110, expanded May 2025 by PC 360):** covered bodies must post agendas ≥48h before **regular** meetings, including on their website. Coverage extends to legislative bodies, planning commissions, BZAs, utility boards, and several authority types — but NOT necessarily to every advisory body, and not to special/called meetings. See the flag-applicability rule below.
- Public comment period required (2023 PC 300). Actions violating the Open Meetings Act are void (§8-44-105); any TN citizen can sue (§8-44-106).
- Records: any TN citizen may inspect free; 7-business-day response (§10-7-503). Office of Open Records Counsel provides free forms/mediation.
- Publishing accurate public records about elected officials is low-risk: actual-malice standard, TN fair-report privilege (Burke v. Sparta Newspapers, 2019 — covers public proceedings/records, NOT private one-on-one statements), and the TN Public Participation Act (anti-SLAPP, §20-17-101 et seq., fee-shifting).

### OpenCouncil evaluation (basis for the fork decision)
- **Has (verified against repo):** per-member votes (`SubjectVote`: FOR/AGAINST/ABSTAIN/PRESENT/DID_NOT_VOTE per Person per Subject, `source: decision|transcript|manual`), per-meeting/per-subject attendance, video player synced to speaker-attributed transcripts (word-level timestamps), cross-meeting speaker ID (voiceprints), Claude summaries with inline utterance citations, people/party pages, Elasticsearch full-text search, geocoded subjects, notification pipeline (before/after-meeting, topic + proximity, email/SMS/WhatsApp via Resend + Bird), MCP server (`UserMcpToken` model verified in schema; live at opencouncil.gr/mcp), admin/review UI, complete English UI locale.
- **Stack:** Next.js 16 + React 19, Postgres+PostGIS, Prisma, Elasticsearch (required; **synced from Postgres via PGSync**, which their compose does NOT ship — we must run it), Resend, Mapbox; separate task server (`schemalabz/opencouncil-tasks`) doing media/AI via hosted APIs — ElevenLabs Scribe (STT), pyannote.ai (diarization), Anthropic, Perplexity (agenda processing — likely bypassable for us since ChampDS provides structured agendas; verify in Phase 1), **Mux (required by the media pipeline: `muxPlaybackId` on CouncilMeeting/Highlight; keep it in v1**, see video decision below). No GPU anywhere. Self-hosting documented. Very active upstream: ~1,965 commits, daily activity, 2 maintainers, public Discord.
- **Gaps we fill:** ChampDS ingestion; minutes-based vote extraction (replacing Greece's Diavgeia extraction); `CityLanguage`/`Realm` enums lack en/US (small migration); document-only meeting mode for the 2013–2022 PDF era; flags engine; elections/participation layer.
- **AGPL-3.0 §13:** public forks + a footer source link satisfy it — **process rule: deploy only from pushed commits and pin the footer link to the deployed SHA** (Openship local-path deploys can otherwise run uncommitted drift, silently breaking compliance).

## Architecture

Deployed as **one Openship project on the thinkstation** (all services in a single compose stack — Openship drops `networks:` keys and puts every container of a project on one `openship-<slug>` network with service-name aliases, so cross-project containers can't see each other natively). Code in public GitHub repos:

1. **`glasshouse` (fork of `schemalabz/opencouncil`)** — the web app, and the home of all logic that needs its database: US realm/language enums, document-only meeting rendering, theming/branding, the **flags engine** (new tables + a scheduled job computing flags from transcripts/votes/attendance in its own DB; renders as badges), the **digest drafter** (assembles weekly digest + T-48h preview drafts from meeting summaries, pushes to listmonk as paused campaigns), the **elections/guides pages**, and one small API endpoint accepting agenda-observation events from ingest. Kept as thin as those modules allow; upstream generalizable pieces (US realm, generic ingestion hooks) as PRs.
2. **`glasshouse-tasks` (fork of `schemalabz/opencouncil-tasks`)** — transcription/diarization/summarization pipeline, near-stock **including Mux** (de-Muxing touches the pipeline, schema, and player — deferred to a later optimization/upstream PR; Mux's CDN also solves serving video from a residential uplink). English prompt review pass.
3. **`glasshouse-ingest` (new, small)** — a pure source adapter. Cron loop in-process (Openship has no hooks/cron): polls the ChampDS API (browser UA, gentle rate limits) AND the town website's agenda pages → creates/updates meetings, bodies, agenda subjects via the OpenCouncil API (`ServiceApiKey`) → mirrors every artifact (agenda PDFs, packets, minutes, MP4 video) into MinIO the moment it appears → triggers transcription tasks → runs the **minutes vote-extraction** pass (below) → posts agenda-observation records (source, first-observed-at, content hash) to the fork's observation endpoint → polls the calendar feed. Also runs the one-time backfills. Talks to the fork only over HTTP.
4. **Infra (same Openship project):** Postgres+PostGIS, Elasticsearch (with auth + index bootstrap), **PGSync** (Postgres→ES sync — required, absent from upstream compose), MinIO, Valkey.
5. **listmonk (existing, wherever it already runs)** — receives auto-drafted campaigns via HTTPS API; Daniel reviews and sends. OpenCouncil's Resend-based notifications handle per-user topic/location alerts.

External API keys: Anthropic, ElevenLabs, pyannote.ai, Mux, Resend, Mapbox, Google (geocoding); Perplexity only if the agenda task proves non-bypassable. Steady state ~$50–100/mo (incl. Mux). One-time backfill: cap initial spend at **$500 with a hard abort** — transcribe newest-first so the most-relevant meetings land first; reassess per-meeting cost after the first 20 videos before continuing.

### Vote extraction & review policy
- **Sources, in order of authority:** roll-call votes in minutes PDFs; roll-call moments in transcripts (`discussionStatus: VOTE`); voice votes in minutes ("motion carried," "carried unanimously").
- **Inference rule (voice votes):** a unanimous voice vote + recorded attendance yields per-member FOR rows **labeled as inferred** (distinct `source` value, visible "inferred from unanimous voice vote" badge). Non-unanimous voice votes without names are recorded as outcome-only — never guessed.
- **Review policy (resolves full-review vs. sampling):** ongoing meetings (~10/mo) get **full human review before publish** — sustainable at solo scale. Backfill meetings publish immediately with a per-row **"machine-extracted, not yet human-reviewed"** badge, a 10-meeting random-sample accuracy audit before launch (100% match required or extraction is fixed and re-run), and progressive review over time. The About page describes exactly this split — no overclaiming.

### Flags engine (all machine-checkable; each links to a methodology page stating rule, basis, and data source)
**Statute-applicability rule:** each flag that cites a statute carries a per-body, per-meeting-type applicability table (maintained in config). §8-44-110 flags apply only to covered bodies (BOMA, Planning Commission, BZA, Utility board) and only to **regular** meetings. Non-covered bodies/meeting types get "town practice" badges with no statute citation — a statute-branded flag on a body the statute doesn't reach is a false accusation of law-breaking.

**Observation epistemics:** timing flags state evidence, not conclusions — "first observed on {source} at {time}" — and fire only when a continuous polling window covers the whole relevant period (a poller outage suppresses the flag rather than accusing the town). Late-added-item detection diffs actual agenda content, never `LastModifyDateTimeUTC` alone (verified bulk-touch false-positive source).

- **Late agenda** (statutory where applicable; observation-based per above; town website + ChampDS both polled).
- **Late minutes** (methodology, not statute — §8-44-104 sets no deadline): N = not published within 7 days after the body's *next* regular meeting (minutes are conventionally approved at the next meeting); labeled as site methodology.
- **Unanimity streak** — "Nth consecutive unanimous vote by this body."
- **No-discussion passage** — item passed with < 30 seconds of deliberation in the transcript; **consent-agenda items excluded** (detected from agenda structure); threshold published in methodology.
- **Split vote spotlight** — any non-unanimous vote (rare here = newsworthy).
- **Attendance** — per-member absence rates.
- **Late-added items** — content-diff based, per above.
- **Uncontested-election context** — on people pages: "elected unopposed, N votes."

### Participation layer (pages in the fork)
- **Elections (Phase 1, not last):** Nov 3 2026 ballot; certified candidate list (fetch from Williamson County Election Commission the week of Aug 20, 2026 — do this even before the site exists; preserve the artifacts); filing requirements; historical results/turnout; campaign-finance disclosures (county PDFs, quarterly).
- **Guides (static, sourced):** how to run for office; how to apply for board/commission appointment (town's interest form); how to speak at a meeting (PC 300 comment period); how to file a TN public records request (OORC forms).

### Privacy & residents (not just officials)
- **Speaker attribution is officials/staff-only by default.** Private citizens at public comment render as "Public commenter" unless they hold office; voiceprint identification is restricted to office-holders and senior staff.
- **Redaction/takedown policy (published):** spoken personal details (home addresses at sign-in, minors' names) are redacted from transcripts/summaries on detection or request; requests handled via the corrections channel. The official record remains the town's — we redact our copy.

### Security & operations
- **Edge:** Cloudflare Tunnel in front of the web app (home IP hidden, DDoS absorbed); only the web app is reachable from outside. Openship strips loopback port binds to 0.0.0.0 (verified v0.5.0 behavior), so non-web services are firewalled at the thinkstation host — never rely on bind addresses.
- **Video egress:** via Mux's CDN (stock pipeline), not the residential uplink.
- **Admin surface:** open registration disabled; single admin account (+ allowlist if upstream supports it); `ServiceApiKey` and all secrets live in Openship env config, never in repos; keys rotated on any suspicion; edge rate limiting via Cloudflare. Run the `security-checker` agent on the fork's auth/admin surface before launch.
- **Backups (the "archival independence" claim is false without them):** nightly `pg_dump` + MinIO replicated offsite (rclone to B2/S3, ~$1–5/mo at this volume); **restore drill** is a launch gate in Verification.
- **Operator unavailability:** published content keeps serving with zero operator input; new vote data holds in the review queue (visibly "awaiting review," never silently skipped); a RUNBOOK.md in the repo documents the full pipeline so a successor or future contributor can operate it.
- **Liability shield (user decision, pre-launch):** recommend consulting a TN attorney about an LLC and media-liability insurance before public launch — fair-report privilege and anti-SLAPP are defenses, not cost shields, and attribution is named. Tracked as a Phase 2 launch-checklist item.

### Openship deployment constraints (v0.5.0, verified)
- All services (web, tasks, ingest, Postgres, ES, PGSync, MinIO, Valkey) go in **one compose file, one project** — service-name DNS works only within the project's `openship-<slug>` network.
- Deploy via the working path for compose-only projects: `openship project create --name glasshouse --type docker`, then `openship service sync docker-compose.yml --project <id> --yes`, then `POST /deployments`. (`openship deploy` 400s on compose-only folders.)
- Always set service commands via `service sync` (never `service update --command`) so `commandArgv` is populated — otherwise exec-form commands get `sh -c`-wrapped and images with flag args crash-loop.
- No post-deploy hooks: `glasshouse-ingest` schedules itself in-process.
- After deploy, verify the stored model, not the YAML: `openship service get <svc> --project <id> --json`, `docker ps --format '{{.Ports}}'`.

## Phases (solo-builder-realistic estimates)

**Phase 0 — bring-up (weeks 1–2):** public forks; Openship deploy of the full stack (path above) incl. ES auth/bootstrap + PGSync; Cloudflare Tunnel; schema migration adding `en`/`us` enums; seed City, 9 AdministrativeBodies, People/Roles (rosters collected in research); verify one meeting end-to-end manually (create → transcribe → summarize → review UI). **Immediate side task regardless of build state: capture the certified Nov 2026 candidate list from the Williamson County Election Commission (week of Aug 20).** Reach out to Schema Labs (Discord) — a first US instance is likely welcome and may shrink our diff.

**Phase 1 — ingestion, structured backfill, elections page (weeks 3–5):** build `glasshouse-ingest` (ChampDS + town-site poller, artifact mirroring, task triggering, observation posting); vote-extraction pass + review queue; backfill Nov 2022→present newest-first under the spend cap; elections page with the certified candidate list + historical results; 10-meeting accuracy audit; quiet launch with About/methodology/corrections/redaction pages.

**Phase 2 — scrutiny features (weeks 6–9):** flags engine + methodology pages; digest drafter → listmonk weekly digest + T-48h pre-meeting preview (with "how to comment" box); RSS + iCal feeds; people pages with vote/attendance stats; liability-shield decision resolved; **public launch** + tell local press (Williamson Herald covered the mall uproar; a resident-built transparency tool is a story — and it's live before early voting starts ~Oct 14).

**Phase 3 — deep archive + remaining distribution (weeks 10–14):** 2013–2022 PDF backfill (OCR + LLM agenda/vote extraction into document-only meetings — catches the Two Farms 4-1 votes, 2016–2019); guides section completion; campaign-finance page; Facebook auto-posting; SMS alerts (Bird or Twilio) last; de-Mux evaluation.

## Verification

- **Pipeline E2E:** one recent BOMA meeting and one Planning Commission meeting (different agenda structures): ingest → transcription → summarization → vote extraction; diff extracted votes/attendance against the official minutes PDF by hand.
- **Accuracy gate before any public launch:** random-sample 10 meetings across bodies; 100% of published votes must match minutes (fix and re-run extraction otherwise); summaries spot-checked — every sentence must carry its citation.
- **Flag correctness:** unit-test each flag rule against synthetic fixtures + one known real case; verify the applicability table blocks statute flags on non-covered bodies; verify a simulated poller gap suppresses (not fires) timing flags.
- **Privacy:** verify a public commenter renders unattributed; verify voiceprint matching is scoped to officials.
- **Restore drill:** restore Postgres dump + MinIO copy to a scratch environment and bring the site up from it — launch gate.
- **Ops:** compose healthchecks (Openship honors them via `advanced`); post-deploy verify stored service models and published ports; confirm only the web app is reachable from outside; ingest failure alerting via Grafana (existing); digest renders in listmonk preview before first send.
- **Legal review pass:** About/methodology/corrections copy reviewed against the fair-report-privilege boundary (record-based statements only) before launch.

## Risks

- **ChampDS API undocumented, could change/block** → mirror every artifact to MinIO immediately + offsite backup (the archive survives even if the tap closes); polite UA + rate limiting; calendar feed and Drupal site are fallbacks.
- **Fork drift vs. a daily-moving upstream** → thin fork discipline, module isolation, upstream PRs, Schema Labs contact; fork upkeep is budgeted in the 1–2 hr/wk ops figure.
- **Hidden Greek assumptions in prompts/pipeline** → budgeted in Phase 0–1; seed-data repo and docs help.
- **Vote-extraction errors** → review policy above; provenance labels; corrections policy.
- **Town switches platforms** → all town-specific knowledge isolated in `glasshouse-ingest`.
- **Small-town blowback** → posture guardrails, statute-applicability discipline, TN anti-SLAPP backstop, accuracy gate, liability-shield decision before launch.
- **Solo timeline slip** → the only hard date is externally fixed (Nov 3 election; early voting ~Oct 14). Phase order puts election-relevant content earliest; everything after Phase 2 degrades gracefully.

## Out of scope (explicitly)

GeoCivix permit data (login-gated), ArcGIS layers, county/school-board coverage, opinion content, user comments/forums (moderation burden violates near-zero-touch), Documenters-style contributor workflows (solo model chosen).
