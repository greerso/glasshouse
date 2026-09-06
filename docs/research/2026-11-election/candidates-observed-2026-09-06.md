# Thompson's Station candidates observed — 2026-09-06

**Election:** Town of Thompson's Station Municipal Election, Tuesday, November 3, 2026  
**Offices on the official notice:** Mayor and Two (2) Alderman  
**Qualifying deadline (closed):** Thursday, August 20, 2026, 12:00 noon prevailing time  
**Withdrawal deadline (closed):** Thursday, August 27, 2026, 12:00 noon prevailing time  
**Captured:** Sunday, September 6, 2026, ~16:05 America/Chicago  

The certification is now **scheduled**: the Williamson County Election Commission meets
**Friday, September 11, 2026 at 1:00 p.m.** and New Business item 1 is *"Approve the qualified
municipal candidates for the City of Fairview, Town of Nolensville, & Town of Thompson's Station
appearing on the November 3, 2026, State General Election ballot."* The agenda names no one.
Empty is still the correct candidate table.

## Official candidate table

| Office | Name | Source URL | Date of source | Status |
| --- | --- | --- | --- | --- |
| — | **NONE** | — | 2026-09-06 | No official source has published any qualifier or certified candidate for Thompson's Station Mayor or Alderman |

**Count: zero names.**

`glasshouse-web/src/content/elections/thompsons-station-2026-11.json` stays `candidates: []`.
No rebuild of names. `lastCapturedAt` / `sourceNote` updated to this recapture.

## What changed since 2026-09-01

1. **A September 11, 2026 WCEC meeting is on the Agenda Center** (`_09112026-813`) — it was not
   there on Sep 1. Agenda PDF is image-based, 61,659 bytes, SHA1 `b1218170…`, transcribed in
   `raw/2026-09-06/wcec-agenda-sep-11-2026.md`.
2. That agenda identifies the venue where the November municipal candidate list gets approved,
   plus early-voting locations/dates/hours for November 3 (Old Business also carries a continuing
   discussion of a T.C.A. § 2-5-204 ballot-placement policy and quasi-judicial hearing timeframes).
3. Nothing else moved. Aug 21 minutes are still unposted — and they are Sep 11 Old Business item 1,
   so they are not yet approved.

## What was rechecked

All fetched 2026-09-06 ~16:05 America/Chicago; details in `raw/2026-09-06/recapture-notes.md`.

- WCEC home, Candidate Information, Public Notices, Sample Ballots, Voting Information, Election Calendar — all unchanged; no November municipal name list.
- Sample Ballots: **August 6, 2026 only**. No November 3 sample ballot.
- Agenda Center: new Sep 11 row; Aug 21 row unchanged.
- Minutes URL `_08212026-800`: SHA1 `a3dfd2c7…`, **byte-identical** to the Sep 1 capture. Still the public-notice agenda, not post-meeting minutes.
- DocumentCenter GET 29565–**29900** (extends the Sep 1 probe, which stopped at 29700): 36 live IDs, all ≤ 29624, all county zoning / Board of Health / 2027 budget / building-inspection / a Labor Day graphic. No candidate list. Full log in `raw/2026-09-06/documentcenter-id-probe.md`.
- Town of Thompson's Station elections page and announcements (through Sep 4, 2026): no candidate posting; sitting BOMA only.
- TN SOS 2026 candidate lists: Governor, U.S. Senate, U.S. House, TN Senate, TN House. State/federal only.
- WCEC CivicEngage site search returned a JS shell to `curl` this pass, so it contributed nothing. Not relied on — the ID probe and the Sep 11 agenda are stronger evidence.

## What is deliberately excluded

Same as `candidates-observed-2026-09-01.md`: Brian Stover, Shaun Alexander, Bob Whitmer, Kreis
White, Harry King are the **sitting** BOMA; incumbency is not a 2026 filing. Andrew Zinn appears
only on an older MTAS municipal-code cover sheet. The Jan 2026 *Williamson Herald* seat preview is
not a filing list.

New this pass: a Williamson Herald article, *"Candidates enter the race for local offices in
Williamson County"*, `datePublished` **2026-04-16** — it covers the **August 6 county primary**
("61 candidates"), not the November municipal ballot, and names no Thompson's Station municipal
filer. A separate Herald piece that a web search paraphrased as WCEC approving qualified local
candidates for Fairview / Nolensville / Thompson's Station is **from 2024-09-13** and covers the
November 5, **2024** election (the meeting it reports was Thursday, September 12, 2024). Neither goes near the table.

## Certification status

Still **not certified and not published**, 17 days after qualifying closed and 10 days after
withdrawal closed — but no longer open-ended. The list is a scheduled agenda item for
**Friday, September 11, 2026, 1:00 p.m.**

## Next actions

1. **Fri Sep 11, 2026 after ~2:30 p.m. CDT** — recapture. Expect a DocumentCenter file (watch IDs
   above 29624) and/or an updated Public Notices / Candidate Information page. If names appear,
   write `candidates-observed-2026-09-11.md` and copy the exact printed names into the JSON.
2. **Email WCEC anyway** (issue #2 step 4): chad.gray@williamsoncounty-tn.gov / (615) 790-5711 —
   ask for the petitions-filed / qualified names for Thompson's Station Mayor and Alderman, and
   whether the approved list will be posted after the Sep 11 meeting. The office is closed Monday,
   September 7 (Labor Day), so Tuesday, September 8 is the first business day to send it.
3. Also watch for the **November 3 sample ballot** and the early-voting locations approved at the
   same meeting.
