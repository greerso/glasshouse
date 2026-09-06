# Sources — 2026-11 Williamson / Thompson's Station municipal election

## Recapture — 2026-09-06 (~16:05 America/Chicago)

**Certification is scheduled.** A new WCEC meeting appeared on the Agenda Center: **Friday, September 11, 2026, 1:00 p.m.**, New Business item 1 = approve the qualified municipal candidates for Fairview, Nolensville and Thompson's Station on the November 3, 2026 ballot. The agenda names no one. Everything else unchanged. DocumentCenter GET 29565–29900: 36 live IDs, all ≤ 29624, no candidate list. JSON `candidates` left `[]`; `lastCapturedAt` / `sourceNote` updated.

| # | URL | HTTP | Fetched | What it contains |
| --- | --- | --- | --- | --- |
| T1 | https://www.williamsoncounty-tn.gov/40/Election-Commission | 200 | 2026-09-06 | Unchanged. Aug 6 material only. |
| T2 | https://www.williamsoncounty-tn.gov/1743/Candidate-Information | 200 | 2026-09-06 | Unchanged. County list May/August 2026 only. |
| T3 | https://www.williamsoncounty-tn.gov/619/Public-Notices-Press-Releases | 200 | 2026-09-06 | Unchanged. Three Nov municipal notices + Aug 21 meeting. Sep 11 notice not posted here. |
| T4 | https://www.williamsoncounty-tn.gov/2173/Sample-Ballots | 200 | 2026-09-06 | August 6 only (29485/29486/29487). No November 3 sample ballot. |
| T5 | https://www.williamsoncounty-tn.gov/1576/Voting-Information | 200 | 2026-09-06 | Nov 3 absentee form 29561; no candidate list. |
| T6 | https://www.williamsoncounty-tn.gov/AgendaCenter/Election-Commission-5 | 200 | 2026-09-06 | **New `Sep 11, 2026` row.** Aug 21 row unchanged. |
| T7 | https://www.williamsoncounty-tn.gov/AgendaCenter/ViewFile/Agenda/_09112026-813 | 200 | 2026-09-06 | **New.** Sep 11 agenda, image PDF 61,659 bytes, SHA1 `b1218170…`. Approve qualified municipal candidates + early voting. **No names.** |
| T8 | https://www.williamsoncounty-tn.gov/AgendaCenter/ViewFile/Minutes/_08212026-800 | 200 | 2026-09-06 | SHA1 `a3dfd2c7…` — byte-identical to 09-01. Still the public-notice agenda. Aug 21 minutes are Sep 11 Old Business item 1. |
| T9 | https://thompsons-station.gov/elections-and-voting | 200 | 2026-09-06 | Unchanged. Sitting BOMA; next election Nov 2026. |
| T10 | https://thompsons-station.gov/announcements | 200 | 2026-09-06 | Newest Sep 4, 2026. No candidate or election posting. |
| T11 | https://sos.tn.gov/elections/2026-candidate-lists | 200 | 2026-09-06 | State/federal only (curl w/ browser UA; WebFetch 403). |
| T12 | DocumentCenter GET 29565–29900 | — | 2026-09-06 | 36 live, all ≤ 29624. No candidate list. |
| T13 | https://www.williamsoncounty-tn.gov/Search?searchPhrase=… | 200 | 2026-09-06 | JS shell only to curl; contributed nothing this pass. |
| T14 | williamsonherald.com `article_4779d6c9-…` | 200 | 2026-09-06 | Secondary. Published **2026-04-16**; covers the Aug 6 county primary (61 candidates). No municipal filer. |
| T15 | williamsonherald.com `article_e7c1b28c-7204-11ef-…` | 200 | 2026-09-06 | Secondary. Published **2024-09-13** reporting a **Thursday, September 12, 2024** meeting; the Nov 5 **2024** election. Precedent for the mid-September approve-and-early-vote meeting. |

Prior recaptures below.

---

## Recapture — 2026-09-01 (~09:34 America/Chicago)

Post-qualifying and post-withdrawal. Same official URLs re-fetched. No November municipal name list. Aug 21 agenda revised (new PDF, still no names). Minutes URL still the public-notice agenda. DocumentCenter GET 29565–29700: no candidate list. JSON `candidates` left `[]`; `lastCapturedAt` updated.

| # | URL | HTTP | Fetched | What it contains |
| --- | --- | --- | --- | --- |
| S1 | https://www.williamsoncounty-tn.gov/40/Election-Commission | 200 | 2026-09-01 | Unchanged. Aug 6 list only. |
| S2 | https://www.williamsoncounty-tn.gov/1743/Candidate-Information | 200 | 2026-09-01 | Unchanged. May/August 2026 county list only. |
| S3 | https://www.williamsoncounty-tn.gov/619/Public-Notices-Press-Releases | 200 | 2026-09-01 | Unchanged. Three Nov municipal notices; no name list. |
| S4 | https://www.williamsoncounty-tn.gov/2173/Sample-Ballots | 200 | 2026-09-01 | August 6 sample ballots only. |
| S5 | https://www.williamsoncounty-tn.gov/AgendaCenter/ElectionCommission-5 | 200 | 2026-09-01 | Latest meeting still Fri Aug 21. No Sep WCEC meeting. |
| S6 | https://www.williamsoncounty-tn.gov/AgendaCenter/ViewFile/Agenda/_08212026-800 | 200 | 2026-09-01 | **Revised** agenda PDF (94,227 bytes, created Aug 20 11:18). Call for Elections; no names. |
| S7 | https://www.williamsoncounty-tn.gov/AgendaCenter/ViewFile/Minutes/_08212026-800 | 200 | 2026-09-01 | Still public-notice agenda, not post-meeting minutes. |
| S8 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29556/Public-Notice-Thompsons-Station-November-2026 | 200 | 2026-09-01 | TS notice. SHA1 unchanged. Offices + deadlines. No names. |
| S9 | https://thompsons-station.gov/elections-and-voting | 200 | 2026-09-01 | Next election Nov 2026. Sitting BOMA. No 2026 filers. |
| S10 | https://thompsons-station.gov/boards-commissions/board-mayor-alderman | 200 | 2026-09-01 | Stover, Alexander, Whitmer, White, King. |
| S11 | https://sos.tn.gov/elections/2026-candidate-lists | 200 | 2026-09-01 | State/federal only. |
| S12 | https://www.williamsonvotes.net/ | FAIL | 2026-09-01 | SSL fail. |
| S13 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29599 | 200 | 2026-09-01 | County Commission Sep 9 special meeting (hospital). Not WCEC. |

Prior recapture below.

---

## Recapture — 2026-08-18 (~17:18 America/Chicago; first pass ~17:05)

Same official URLs re-fetched. No new November municipal name list. CivicEngage HEAD 404s on live files; GET of 29565–29620 found only 29567 (GRT agenda) and 29569 (flu memo). JSON not updated.

| # | URL | HTTP | Fetched | What it contains |
| --- | --- | --- | --- | --- |
| R1 | https://www.williamsoncounty-tn.gov/40/Election-Commission | 200 | 2026-08-18 | Unchanged. Aug 6 list only. |
| R2 | https://www.williamsoncounty-tn.gov/1743/Candidate-Information | 200 | 2026-08-18 | Unchanged. May/August 2026 county list only. |
| R3 | https://www.williamsoncounty-tn.gov/619/Public-Notices-Press-Releases | 200 | 2026-08-18 | Unchanged. Three Nov municipal notices; no name list. |
| R4 | https://www.williamsoncounty-tn.gov/2173/Sample-Ballots | 200 | 2026-08-18 | August 6 sample ballots only. |
| R5 | https://www.williamsoncounty-tn.gov/AgendaCenter/ElectionCommission-5 | 200 | 2026-08-18 | Next meeting Fri Aug 21. Minutes link is the Aug 14 public-notice agenda. |
| R6 | https://www.williamsoncounty-tn.gov/AgendaCenter/ViewFile/Agenda/_08212026-800 | 200 | 2026-08-18 | Agenda PDF byte-identical to 08-17 capture. |
| R7 | https://www.williamsoncounty-tn.gov/AgendaCenter/ViewFile/Minutes/_08212026-800 | 200 | 2026-08-18 | Public-notice agenda (not post-meeting minutes). Call for Elections; no names. |
| R8 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29556/Public-Notice-Thompsons-Station-November-2026 | 200 | 2026-08-18 | TS notice. Offices + deadlines. No names. |
| R9 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29353 | 200 | 2026-08-18 | Aug 6 state + Fairview Municipal Court Clerk. Not Nov municipal. |
| R10 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29313 | 200 | 2026-08-18 | May/August 2026 county list. Not Nov municipal. |
| R11 | https://www.williamsoncounty-tn.gov/Search/Results?searchPhrase=Candidate+List+November+2026 | 200 | 2026-08-18 | Hits are notices/calendar/Aug 6 lists. No Nov municipal name list. |
| R12 | https://sos.tn.gov/elections/2026-candidate-lists | 200 | 2026-08-18 | State/federal only. |
| R13 | https://thompsons-station.gov/elections-and-voting | 200 | 2026-08-18 | Next election Nov 2026. Sitting BOMA. No 2026 filers. |
| R14 | https://thompsons-station.gov/announcements | 200 | 2026-08-18 | Ordinances / workshops / jobs. No candidate posting. |
| R15 | https://www.williamsoncounty-tn.gov/2142/Election-Calendar | 200 | 2026-08-18 | Calendar PDF. TS Mayor & Two Alderman; qualify Aug 20 noon. |
| R16 | https://www.williamsonvotes.net/ | FAIL | 2026-08-18 | Same as 08-17. |
| R17 | https://sos.tn.gov/elections/calendar | 403 | 2026-08-18 | CloudFront blocked this fetch. SOS candidate-lists page succeeded. |
| R18 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29567 | 200 | 2026-08-18 17:18 | GRT Agenda 8-12-26. Not elections. Missed at 17:05 because HEAD 404s. |
| R19 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29569 | 200 | 2026-08-18 17:18 | County employee flu-vaccine memo. Not elections. |
| R20 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29382 | 200 | 2026-08-18 17:18 | “2026 NOVEMBER” = circuit court schedule. Not a candidate list. |

First-capture table below is the 2026-08-17 inventory (unchanged).

---

Capture date: **2026-08-17**. HTTP status is the result of this session's fetch (successful page/PDF retrieval recorded as 200). Times are the capture day; fetches ran during the 2026-08-17 research session (America/Chicago).

## Official — primary

| # | URL | HTTP | Fetched | What it contains |
| --- | --- | --- | --- | --- |
| 1 | https://www.williamsoncounty-tn.gov/40/Election-Commission | 200 | 2026-08-17 | WCEC home. Aug 6 unofficial results, Aug 13 audit, Aug 6 candidate list only. No Nov municipal list. |
| 2 | https://www.williamsoncounty-tn.gov/2142/Election-Calendar | 200 | 2026-08-17 | 2026 election calendar PDF. Nov 3 municipal qualifying noon Aug 20; petitions from Jun 22. TS: Mayor & Two Alderman. |
| 3 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29556/Public-Notice-Thompsons-Station-November-2026 | 200 | 2026-08-17 | Official TS notice of election PDF. Offices, Aug 20/27 deadlines. **No names.** |
| 4 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29554/Public-Notice-Fairview-City-November-2026 | 200 | 2026-08-17 | Fairview Nov 3 notice. Same dates. Mayor + 2 Commissioners. No names. |
| 5 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29555/Public-Notice-Nolensville-November-2026 | 200 | 2026-08-17 | Nolensville Nov 3 notice. Same dates. Two Commissioners. No names. |
| 6 | https://www.williamsoncounty-tn.gov/619/Public-Notices-Press-Releases | 200 | 2026-08-17 | Current notices index. Three Nov municipal PDFs + Aug 21 EC meeting. No candidate list. |
| 7 | https://www.williamsoncounty-tn.gov/1743/Candidate-Information | 200 | 2026-08-17 | Candidate landing. Local list is May/August 2026 county only. |
| 8 | https://www.williamsoncounty-tn.gov/2136/Candidate-FAQ | 200 | 2026-08-17 | Qualifying/withdrawal/ballot-order FAQ. Municipal races non-partisan. |
| 9 | https://www.williamsoncounty-tn.gov/2133/Qualifications | 200 | 2026-08-17 | TS municipal quals: TCA 8-18-101 + 1-year town residency. |
| 10 | https://www.williamsoncounty-tn.gov/2135/Petitions-Checklist-Resources | 200 | 2026-08-17 | Petition, treasurer, ethics-disclosure checklist. |
| 11 | https://www.williamsoncounty-tn.gov/2173/Sample-Ballots | 200 | 2026-08-17 | August 6, 2026 sample ballots only. No Nov 3 sample ballot. |
| 12 | https://www.williamsoncounty-tn.gov/1576/Voting-Information | 200 | 2026-08-17 | Voting info. Nov 3 absentee request form already posted. |
| 13 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29561/nov-3-2026-absentee | linked | 2026-08-17 | Nov 3 absentee request form (linked; not transcribed). |
| 14 | https://www.williamsoncounty-tn.gov/AgendaCenter/ElectionCommission-5 | 200 | 2026-08-17 | EC agenda index. Next meeting Fri Aug 21, 2026. |
| 15 | https://www.williamsoncounty-tn.gov/2140/Election-Commission-Minutes | 200 | 2026-08-17 | Same CivicEngage EC agenda/minutes table. |
| 16 | https://www.williamsoncounty-tn.gov/AgendaCenter/ViewFile/Agenda/_08212026-800 | 200 | 2026-08-17 | Aug 21, 2026 EC agenda PDF (image). Mentions TS municipal offices on Nov 3 ballot. No names. |
| 17 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29353 | linked | 2026-08-17 | Candidate List — Aug 6, 2026 State Primary & Fairview Municipal Court Clerk. Not Nov municipal. |
| 18 | https://www.williamsoncounty-tn.gov/DocumentCenter/View/29313 | linked | 2026-08-17 | County candidate list May/August 2026. Not Nov municipal. |
| 19 | https://sos.tn.gov/elections/2026-candidate-lists | 200 | 2026-08-17 | SOS state/federal candidate lists only. No municipal names. |
| 20 | https://sos.tn.gov/elections/calendar | 200 | 2026-08-17 | SOS calendar. Nov municipal qualify Aug 20 noon; withdraw Aug 27 noon. Lists Town of Thompson's Station on 11/03/2026. |
| 21 | https://sos.tn.gov/elections/guides/qualifying-procedures-for-running-for-political-offices | 200 | 2026-08-17 | SOS qualifying-procedure index (state/federal offices). |
| 22 | https://thompsons-station.gov/elections-and-voting | 200 | 2026-08-17 | Town elections page. Next election Nov 2026. Current BOMA roster. 2022 results. No 2026 filers. |
| 23 | https://thompsons-station.gov/boards-commissions/board-mayor-alderman | 200 (title only) | 2026-08-17 | Town BOMA page (Drupal; body not extracted). |
| 24 | https://thompsons-station.gov/contact-directory | 200 (title only) | 2026-08-17 | Town contact directory (Drupal; body not extracted). |
| 25 | https://thompsons-station.gov/announcements | 200 (title only) | 2026-08-17 | Town announcements (Drupal; no 2026 candidate posting extracted). |

## Official — attempted / failed

| # | URL | HTTP | Fetched | What it contains |
| --- | --- | --- | --- | --- |
| 26 | https://www.williamsonvotes.net/ | FAIL | 2026-08-17 | Alternate WCEC hostname printed on the municipal notices. Fetch failed. Content lives on williamsoncounty-tn.gov. |
| 27 | http://williamsoncountytn.easyvotecampaignfinance.com/ | 200 (JS shell) | 2026-08-17 | Local campaign-finance portal. JS app; no crawlable November municipal table. |

## Secondary — news (not for the candidate table)

| # | URL | HTTP | Fetched | What it contains |
| --- | --- | --- | --- | --- |
| 28 | https://www.williamsonherald.com/news/mayor-governor-races-loom-in-2026/article_de94d63f-1d7f-4966-91f5-e7e0dfbea4ce.html | 200 | 2026-08-17 | Jan 2026 preview. Says Stover, Alexander, Whitmer seats are up Nov 3. Not a filing list. |
| 29 | https://www.wkrn.com/news/local-news/thompsons-station-mayor-highlights-accomplishments-during-annual-state-of-town-address/ | indexed | 2026-08-17 | Jul 23, 2026 WKRN State of Town coverage. Incumbent mayor acting as mayor; no candidacy announcement extracted. |
| 30 | https://www.williamsonherald.com/communities/four-vie-for-two-thompson-s-station-aldermanic-seats/article_e7b6e7ae-1ad7-11eb-a201-afe3e04d5e95.html | indexed | 2026-08-17 | Historical (prior cycle) alderman race. Do not use for 2026 names. |

## Not found (searched; nothing official published)

- WCEC "certified" / "qualified" / "final" candidate list for November 2026 municipal offices
- WCEC November 2026 sample ballot
- Town of Thompson's Station candidate announcement or qualifying roster
- SOS municipal candidate list
- Rolling in-office qualifying log naming TS filers
