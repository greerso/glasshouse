# 2026-11-03 municipal election capture — 2026-08-17

**Captured:** 2026-08-17  
**Scope:** What the Williamson County Election Commission (TN), Tennessee SOS, and Town of Thompson's Station have published about the Tuesday, November 3, 2026 municipal election, especially Thompson's Station (Mayor + 2 alderman).  
**Not done:** site features, candidate invention, git commit.

## Certification is still pending

Qualifying for November municipal offices is **still open**. Official close is **Thursday, August 20, 2026, 12:00 noon** prevailing time (T.C.A. § 2-5-101(a)). Withdrawal is **Thursday, August 27, 2026, 12:00 noon** (T.C.A. § 2-5-204(b)(1)).

**No certified (or even unofficial) November 2026 municipal candidate list exists on any official site as of this capture.** That is expected three days before the noon deadline. Empty is the correct candidate table.

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
| Next scheduled WCEC meeting: **Friday, August 21, 2026** (amended Aug 14) | Agenda Center; public notices |
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

### 1. Thursday, August 20, 2026, after 12:00 noon (and Friday, August 21)

Qualifying closes at noon Aug 20. Recapture immediately after noon and again after the Friday meeting:

1. Reload [WCEC home](https://www.williamsoncounty-tn.gov/40/Election-Commission), [Candidate Information](https://www.williamsoncounty-tn.gov/1743/Candidate-Information), and [Public Notices](https://www.williamsoncounty-tn.gov/619/Public-Notices-Press-Releases) for a new DocumentCenter file (expect a name like "Candidate List-November 3, 2026" or "Qualified Candidates" for Fairview / Nolensville / Thompson's Station).
2. Attend or fetch the **Friday, August 21, 2026** Election Commission packet and, when posted, minutes:  
   https://www.williamsoncounty-tn.gov/AgendaCenter/ViewFile/Agenda/_08212026-800  
   The live agenda mentions Town of Thompson's Station municipal offices on the Nov 3 ballot. This is the first public meeting after the noon deadline and the likeliest certification venue.
3. If nothing is posted Friday, call WCEC at (615) 790-5711 or email chad.gray@williamsoncounty-tn.gov and ask for the list of petitions filed / qualified names for Thompson's Station Mayor and Alderman. Save the written reply.
4. Write a new dated file `candidates-observed-2026-08-21.md` (or the actual fetch date). Do not edit today's zero-name table to invent names.

### 2. Thursday, August 27, 2026, after 12:00 noon

Withdrawal closes. Recapture the **ballot-final** list (anyone who qualified Aug 20 and did not withdraw). That is the list the elections page should ship. Also check again the week after for a posted sample ballot.

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

Text of the three municipal notices and the 2026 calendar is transcribed in `raw/`. The 2026 calendar PDF itself was not a stable DocumentCenter URL at capture time (the calendar page is a CivicEngage wrapper).

## Confidence

- **High** that no official November municipal candidate list is published today.
- **High** on offices, dates, and the three municipal notices.
- **High** that SOS does not list municipal candidates.
- **Medium** on the exact Aug 21 agenda item wording (image PDF; relies on the official URL's search-index snippet plus the live Agenda Center row).
- **Open:** petitions may already sit in the WCEC office unpublished. Only the office or a post-noon posting can answer that.
