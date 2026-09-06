# Source

- Fetched: 2026-08-18 ~17:18 America/Chicago
- Purpose: second same-day recapture; GET probe of DocumentCenter IDs (HEAD is unreliable on CivicEngage)

Official URLs re-fetched. HTTP 200 unless noted. Content unchanged vs ~17:05.

| Page | HTTP | Notes |
| --- | --- | --- |
| WCEC home `/40/Election-Commission` | 200 | Aug 6 list only |
| Candidate Information `/1743` | 200 | May/August 2026 county + state lists only |
| Public Notices `/619` | 200 | Three Nov municipal notices; no name list |
| Sample Ballots `/2173` | 200 | August 6 only |
| Agenda Center ElectionCommission-5 | 200 | Next meeting Fri Aug 21 |
| Agenda `_08212026-800` | 200 | SHA1 `95145e08…` identical to 08-17/08-18 17:05 |
| Minutes `_08212026-800` | 200 | SHA1 `a3dfd2c7…` identical; public-notice agenda, not post-meeting minutes |
| TS notice 29556 | 200 | SHA1 `63965e68…` identical; offices + deadlines; no names |
| Calendar `/2142` | 200 | Resolves to DocumentCenter 21759; text is 2026 calendar; TS Mayor & Two Alderman; qualify Aug 20 noon |
| SOS 2026 candidate lists | 200 | State/federal only |
| Town elections page | 200 | Next election Nov 2026; sitting BOMA; no 2026 filers |
| Town announcements | 200 | Park race / ordinances / jobs; no candidate posting |
| williamsonvotes.net | FAIL | SSL_ERROR_SYSCALL |

DocumentCenter GET 29565–29620: only 29567 (GRT agenda) and 29569 (flu memo) live. Neither is a candidate list. 29382 is the November 2026 *court* schedule.

**Zero names. JSON not updated. No rebuild.**
