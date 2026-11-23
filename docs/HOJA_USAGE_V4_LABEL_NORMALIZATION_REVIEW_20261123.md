# HOJA 40-6-U public cartridge label normalization — 2026-11-23

## Read-only grounded audit
Certified 61-day V4 bucket table: 17,670 total plays; 77 distinct recorded cartridge titles, 251 order-sensitive combination strings.

Previous strict 4-segment regex masks 112 combinations / 4,700 plays (26.6%). Categories:
- 64 combinations / 3,429 plays: normal 3-segment school-subject-topic names.
- 32 combinations / 974 plays: normal "기타-" non-grade categories.
- 11 combinations / 258 plays: grade written as "N학년".
- 5 combinations / 39 plays: blanket "학교" word match, entirely caused by generic "학교생활 속 민주주의" (not a school identifier).

## Display-only normalization
- Grade displayed consistently as "N학년", category separators as " · ", English publisher/unit separated.
- Misc. category displayed as "기타 · 카테고리 · 제목", including K-POP.
- Input selection order is non-semantic: A+B and B+A produce the same canonical key and are merged only in public displayed aggregation.
- All 251 observed legacy combinations pass the new academic/misc grammar, reducing format-based "other" suppression to 0. Unique unordered combinations = **196**, total plays unchanged at **17,670**. k<5 protection remains; after canonical merging 100 small combinations / 158 plays are grouped.
- Original EVENT_LOG rows, order-sensitive historical V4 buckets, SHA-256 digest, source cartridge titles, cartridges or ranks are not rewritten.
- Identifier controls still block URL, email, phone, HTML markup and explicit school-identifying phrases. No raw event records or student names embedded in this report.
- Historical 77 title variants vs 76 currently published catalog items are not assumed to differ by exactly one title; comparison needs separate evidence.

## Status
Isolated candidate based on Claude 40-6-U PR #6 HEAD `4fe3345c986ee2a745b4deb977d2cce51823112c`. Pure label normalization patch and Node test **committed but CI/real Apps Script testing NOT RUN**. No production deploy/merge is authorized. Claude R6 40 concurrent starts/30 missing remains FAIL/HOLD.
