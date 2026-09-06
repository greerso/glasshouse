# 2026-11-03 municipal election capture

**Last recapture:** 2026-09-01 (~09:34 America/Chicago)  
**First capture:** 2026-08-17  
**Scope:** What the Williamson County Election Commission (TN), Tennessee SOS, and Town of Thompson's Station have published about the Tuesday, November 3, 2026 municipal election, especially Thompson's Station (Mayor + 2 alderman).  
**Not done:** site features, candidate invention. JSON left at `candidates: []`; no name rebuild. Qualifying closed Thu Aug 20 noon; withdrawal closed Thu Aug 27 noon.

## Certification is still unpublished

Qualifying closed **Thursday, August 20, 2026, 12:00 noon** (T.C.A. § 2-5-101(a)). Withdrawal closed **Thursday, August 27, 2026, 12:00 noon** (T.C.A. § 2-5-204(b)(1)).

**No certified (or even unofficial) November 2026 municipal candidate list exists on any official site as of the 2026-09-01 recapture**, 12 days after qualifying closed. Empty is still the correct candidate table. Observation files: `candidates-observed-2026-08-17.md`, `candidates-observed-2026-08-18.md`, `candidates-observed-2026-09-01.md`.

## What was searched

Official first:

- WCEC home, election calendar, public notices, candidate information, FAQ, qualifications, petitions/checklist, sample ballots, voting information, Agenda Center / minutes
- Direct DocumentCenter PDFs: Thompson's Station, Fairview, and Nolensville November 2026 notices
- August 21, 2026 Election Commission meeting agenda
- Existing August 6, 2026 and May/August 2026 candidate lists (to confirm they are not November municipal)
- TN SOS 2026 candidate lists and elections calendar
- Town of Thompson's Station elections page, BOMA, announcements, contact directory
- williamsonvotes.net (printed on the notices; fetch failed)
- EasyVote local campaign-finance portal (JS shell only)

Secondary (not used for the candidate table):

- *Williamson Herald* Jan 2026 seat-preview article
- WKRN July 2026 State of Town coverage
- General web / news search for 2026 TS mayor/alderman filers (no official names)

## What exists now

| Fact | Source |
| --- | --- |
| Election day Tuesday, November 3, 2026 | WCEC calendar; TS/Fairview/Nolensville notices; SOS calendar |
| Thompson's Station offices: **Mayor and Two (2) Alderman** | WCEC calendar; [TS public notice](https://www.williamsoncounty-tn.gov/DocumentCenter/View/29556/Public-Notice-Thompsons-Station-November-2026) |
| Also on the Nov 3 municipal ballot: Fairview Mayor + 2 Commissioners; Nolensville 2 Commissioners | Same calendar and notices |
| Petitions may be issued starting Monday, June 22, 2026 | WCEC 2026 calendar |
| Qualifying deadline Thu Aug 20, 2026, 12:00 noon | TS notice; SOS calendar; WCEC calendar |
| Withdrawal deadline Thu Aug 27, 2026, 12:00 noon | TS notice; SOS calendar |
| Voter registration deadline Mon Oct 5, 2026, 4:30 p.m. | TS notice |
| Early voting Wed Oct 14 – Thu Oct 29, 2026 | WCEC calendar; SOS calendar |
| Municipal races are generally non-partisan | WCEC Candidate FAQ (T.C.A. § 2-13-208) |
| TS candidate must meet T.C.A. § 8-18-101 and be a resident of the town for one year preceding the election | WCEC Qualifications |
| Sitting BOMA: Mayor Brian Stover; Vice Mayor Shaun Alexander; Aldermen Bob Whitmer, Kreis White, Harry King | Town elections page (incumbents, **not** 2026 filers) |
| 2022 result recorded by the town: Stover mayor (4 yr); Whitmer alderman (4 yr) | Town elections page (history only) |
| WCEC meeting Friday, August 21, 2026 | Agenda Center. Revised agenda posted (created Aug 20 11:18 CDT). Call for Elections; no names. Minutes URL is still the public-notice agenda. |
| Sample ballots on WCEC site: August 6, 2026 only | Sample Ballots page |
| SOS candidate lists: state/federal only | sos.tn.gov/elections/2026-candidate-lists |

WCEC contact on the notices: Chad Gray, Administrator of Elections, 405 Downs Blvd, Franklin, TN 37064, (615) 790-5711, chad.gray@williamsoncounty-tn.gov. Hours Mon–Fri 8:00 a.m.–4:30 p.m. Office closed Monday, September 7, 2026 (Labor Day).

## What is NOT yet certified / not yet published

- Any named qualifier for Thompson's Station Mayor
- Any named qualifier for Thompson's Station Alderman
- A rolling "petitions filed" log
- A certified or "final" November municipal candidate list
- November 3 sample ballots
- November early-voting locations/hours (WCEC says those are set ~six weeks out)
- Confirmation that any incumbent has filed for re-election

A January 2026 *Williamson Herald* article said Stover, Alexander, and Whitmer seats are up Nov 3. That is a seat preview, not a filing. Those names stay out of the official candidate table.

## Exact follow-up

### 1. Done — Thursday Aug 20 / Friday Aug 21 / Monday Sep 1

Qualifying and withdrawal are closed. Recapture 2026-09-01 found **no published names**. Revised Aug 21 agenda still has no names. Post-meeting minutes are not posted.

### 2. Now — email WCEC

Issue #2 step 4 is in force. Email chad.gray@williamsoncounty-tn.gov (or call (615) 790-5711) and ask for the petitions-filed / qualified names for Thompson's Station Mayor and Alderman. Save the written reply as a raw capture. Do not put names on `/elections` until that reply or a WCEC document names them.

### 3. When a list appears

Write `candidates-observed-YYYY-MM-DD.md`. Copy exact printed names into `thompsons-station-2026-11.json` (`officeId` `mayor`|`alderman`, `status: qualified`, `sourceUrl`, `sourceDate`) and rebuild. Also check for a posted November sample ballot.

### 3. Do not treat as certified

- Sitting BOMA roster
- 2022/2024 results
- News "seats up" copy
- Campaign websites or social posts unless later corroborated by WCEC

## Files in this folder

```
docs/research/2026-11-election/
  README.md                                          this file
  sources.md                                         URL / status / one-line inventory
  candidates-observed-2026-08-17.md                  official name table (ZERO names)
  candidates-observed-2026-08-18.md                  mid-window recapture (ZERO names; 17:18 GET probe)
  candidates-observed-2026-09-01.md                  post-deadline recapture (ZERO names)
  raw/2026-08-18/                                    recapture notes + DocumentCenter GET probe
  raw/2026-09-01/                                    post-deadline notes + revised Aug 21 agenda PDF
  raw/                                               page/PDF text captures (source URL at top of each)
    wcec-public-notice-thompsons-station-november-2026.md
    wcec-public-notice-fairview-november-2026.md
    wcec-public-notice-nolensville-november-2026.md
    wcec-election-calendar-2026.md
    wcec-election-commission.md
    wcec-candidate-information.md
    wcec-candidate-faq.md
    wcec-qualifications.md
    wcec-petitions-checklist.md
    wcec-sample-ballots.md
    wcec-voting-information.md
    wcec-public-notices-press-releases.md
    wcec-agenda-center-election-commission.md
    wcec-agenda-aug-21-2026.md
    tn-sos-2026-candidate-lists.md
    tn-sos-elections-calendar.md
    thompsons-station-elections-and-voting.md
    williamson-herald-2026-01-mayor-governor-races.md   (secondary)
```

Binary PDFs (byte-for-byte) are in `raw/pdf/`:

- `wcec-public-notice-thompsons-station-november-2026.pdf`
- `wcec-public-notice-fairview-november-2026.pdf`
- `wcec-public-notice-nolensville-november-2026.pdf`
- `wcec-agenda-aug-21-2026.pdf` (image-based)

`raw/2026-08-18/pdf/wcec-aug21-public-notice-agenda.pdf` is the CivicEngage Minutes URL as of 08-18 (text public notice, not post-meeting minutes).

Text of the three municipal notices and the 2026 calendar is transcribed in `raw/`. The 2026 calendar PDF itself was not a stable DocumentCenter URL at capture time (the calendar page is a CivicEngage wrapper).

## Confidence

- **High** that no official November municipal candidate list is published as of 2026-09-01 09:34 (rechecked home, Candidate Information, Public Notices, Sample Ballots, Agenda Center, site search, DocumentCenter GET 29565–29700). Revised Aug 21 agenda has no names. CivicEngage HEAD 404s on live files — do not trust HEAD for this probe.
- **High** on offices, dates, and the three municipal notices (29556 still offices + deadlines only).
- **High** that SOS does not list municipal candidates.
- **High** on the Aug 21 agenda items (Minutes URL is extractable text: Call for Elections, no names). Agenda PDF unchanged vs 08-17.
- **Open:** petitions may already sit in the WCEC office unpublished. Only the office or a post-noon Thursday / Friday posting can answer that.
