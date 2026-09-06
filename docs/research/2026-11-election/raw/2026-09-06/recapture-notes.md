# Source

- Fetched: 2026-09-06 ~16:05 America/Chicago (Sunday)
- Purpose: routine recapture, 17 days after qualifying closed and 10 days after withdrawal closed
- Method: `curl` with a browser UA, following redirects. Bare `/<id>/` paths 301 — always use `-L`.

## Headline

**The Williamson County Election Commission has scheduled the certification.** A new
`Sep 11, 2026` row appeared on the WCEC Agenda Center since the 2026-09-01 recapture.
The agenda for that meeting (Friday, September 11, 2026, 1:00 p.m., 405 Downs Blvd) has as
New Business item 1: *"Approve the qualified municipal candidates for the City of Fairview,
Town of Nolensville, & Town of Thompson's Station appearing on the November 3, 2026, State
General Election ballot."*

That is why no list has been published: the commission has not voted on it yet. **The agenda
names no candidates.** Item 2 is early voting locations/dates/hours for November 3 — also
still unset, consistent with WCEC's "about six weeks out" practice.

Old Business item 2 is a continuing discussion on adopting a policy for placing qualified
names on the ballot under T.C.A. § 2-5-204, "pertinent to Reasonable Timeframes for a
Quasi-Judicial Hearing." Noted, not interpreted — it is not evidence of any specific
qualification dispute in Thompson's Station.

## Pages re-fetched

| Page | HTTP | Notes |
| --- | --- | --- |
| WCEC home `/40/Election-Commission` | 200 | Unchanged. Aug 6 material only. |
| Candidate Information `/1743` | 200 | Unchanged. County list May/August 2026 only. |
| Public Notices `/619` | 200 | Unchanged. Three Nov municipal notices + Aug 21 meeting. Sep 11 notice not posted here. |
| Sample Ballots `/2173` | 200 | August 6, 2026 only (29485/29486/29487). No November 3 sample ballot. |
| Voting Information `/1576` | 200 | Nov 3 absentee form 29561 still posted; no candidate list. |
| Election Calendar `/2142` | 200 | Unchanged. |
| Agenda Center Election-Commission-5 | 200 | **NEW `Sep 11, 2026` row.** Aug 21 row unchanged (Amended Aug 14). |
| Agenda `_09112026-813` | 200 | **New.** 61,659 bytes, image PDF, SHA1 `b1218170…`. Transcribed in `wcec-agenda-sep-11-2026.md`. |
| Minutes `_08212026-800` | 200 | 35,486 bytes, SHA1 `a3dfd2c7…` — **byte-identical to the 2026-09-01 capture**. Still the public-notice agenda, not post-meeting minutes. Aug 21 minutes are Sep 11 Old Business item 1, so they are not yet approved. |
| DocumentCenter GET 29565–29900 | — | 36 live, all ≤ 29624. No candidate list. See `documentcenter-id-probe.md`. |
| Town elections page (thompsons-station.gov) | 200 | Unchanged. Sitting BOMA; "next election November 2026". |
| Town announcements | 200 | Newest Sep 4, 2026 (park race, 9/8 BOMA agenda, September meeting schedule). No candidate posting. |
| TN SOS 2026 candidate lists | 200 | Governor, U.S. Senate, U.S. House, TN Senate, TN House. State/federal only. |
| WCEC CivicEngage site search | 200 | **Shell only this pass** — results render client-side and the curl fetch returns the search form, not hits. Not relied on; the DocumentCenter ID probe and the Sep 11 agenda are the stronger evidence. |
| williamsonvotes.net | not retried | SSL failure in both prior captures. |

## Secondary (not used for the candidate table)

- *Williamson Herald*, "Candidates enter the race for local offices in Williamson County",
  `datePublished` **2026-04-16** (modified 2026-07-16). Opens: "As the 2026 election cycle
  begins with county primary races, several candidates have officially qualified to run for
  public office across Williamson County… 61 candidates." That is the **August 6 county
  primary**, not the November municipal ballot. It names no Thompson's Station municipal filer.
- Web search surfaced a Williamson Herald summary phrased as though WCEC had "approved
  qualified local candidates… for Fairview, Nolensville, Thompson's Station and County
  Commission District 10". Fetched and checked: that article is *"Williamson County Election
  Commission adopts early voting locations and hours"*, `datePublished` **2024-09-13**, and it
  covers the **November 5, 2024** state general election ("The Williamson County Election
  Commission met Thursday to discuss preparations for the Nov. 5 state general election. Along
  with approving qualified candidates to appear on local ballots and appointing poll officials,
  the commission approved locations and polling hours for seven early voting centers…").
  Do not treat it as 2026. It is, however, a useful precedent: WCEC approves the qualified
  local candidates and the early-voting locations together at a mid-September meeting — exactly
  the shape of the Sep 11, 2026 agenda. Note the meeting itself was **Thursday, September 12,
  2024** ("met Thursday", published Friday 2024-09-13); the article date is not the meeting date.
- No 2026 municipal names were found in any news source.

**Zero names. JSON `candidates` left `[]`. No name rebuild.**
