# Verification Report: duedatehq-competitors
*Generated: 2026-04-23*

## Summary

- **Critical issues:** 0
- **Warnings:** 4
- **Info:** 6

## Critical Issues

None identified. All major claims in the deliverables have labels, confidence ratings, and supporting evidence.

## Warnings

Issues that reduce quality but don't block decisions.

### W1: Karbon founding year is estimated, not verified

- **File(s):** `battle-cards/karbon.md`, `competitors-report.md`
- **Problem:** Karbon's founding year is stated as "~2014 [Estimate]" — not directly verified on vendor site or Crunchbase in this research pass. Claims of "growth-stage" also rest on this.
- **Suggested fix:** Search Crunchbase and Karbon's About page for verified founding date before public use of this document. Label-integrity is preserved (flagged as [Estimate]), but a fast verification closes the gap.

### W2: Competitor revenue figures unavailable across all four competitors

- **File(s):** `competitors-report.md` (Key Players at a Glance table)
- **Problem:** Revenue is not disclosed for File In Time, TaxDome, Karbon, or Canopy. Funding is a weak proxy for Canopy only. Market sizing implications in strategic opportunities rely on estimated user counts × estimated price, not revenue.
- **Suggested fix:** Declared in Data Gaps section already. For high-stakes decisions, supplement with paid sources (PitchBook, Crunchbase Pro) or direct competitor outreach.

### W3: TimeValue / File In Time team size and structure unknown

- **File(s):** `battle-cards/file-in-time.md`, `competitors-report.md`
- **Problem:** Cannot assess File In Time's product investment level without team size. "Static — by choice or by neglect" framing is [Opinion] — may be unfair if TimeValue has quiet ongoing investment.
- **Suggested fix:** LinkedIn company-page search for TimeValue Software headcount. Check job postings for recent File In Time engineering hires.

### W4: Customer sentiment relies on Tier 3 sources for some claims

- **File(s):** `competitors-report.md` (Strategic Opportunities), all battle cards
- **Problem:** Key qualitative claims (e.g., "Stanford's calc is horrific", "Karbon users are integration-first") rely on Discord quotes which are Tier 3 per the source-quality framework. While Tier 3 is expected for sentiment research, the confidence ratings on derived opportunities could be overstated.
- **Suggested fix:** Cross-reference Discord quotes against G2/Capterra reviewer comments on same topics. Downgrade confidence from High to Medium where only Discord evidence exists.

## Info

Minor observations and improvement opportunities.

- **I1:** All four competitors' pricing data is current as of Apr 2026 vendor-site visits. Canopy's pricing model flipped this month — re-verify before Q3 2026 use.
- **I2:** Cross-deliverable consistency verified:
  - Every competitor in battle cards appears in `competitors-report.md` Key Players table ✓
  - Pricing in `pricing-landscape.md` matches pricing in each battle card ✓
  - Feature ratings in `competitive-matrix.md` traceable to battle card strengths/weaknesses ✓
  - Threat levels consistent: FIT High, Karbon Medium, TaxDome Medium, Canopy Low across all files ✓
- **I3:** Strategic Opportunities backed by multi-source evidence:
  - State-level deadline intelligence gap: verified across all 4 vendor sites + competitive matrix (4 Missing cells) ✓
  - Price-band opportunity: verified via vendor pricing pages + ecosystem data ✓
  - Karbon integration partnership: verified via @nikpin2720 Discord quote + karbonhq.com developers page ✓
  - File In Time migration: verified via timevalue.com data structure + switching-cost matrix ✓
  - Roadmap skepticism: Tier 3 sentiment only (see W4)
- **I4:** Red Flags and Yellow Flags present in `competitors-report.md` ✓. Battle cards don't have explicit flag sections but embed equivalent risk content in "Watch For" — consider adding explicit flag sections if skill tightens battle card template.
- **I5:** Data Gaps section present in `competitors-report.md` with 7 specific gaps + fill methods. `pricing-landscape.md` and `competitive-matrix.md` don't have separate Data Gaps sections — they reference the main report's gaps. Consider adding brief deliverable-specific gap callouts.
- **I6:** The research was conducted via web_fetch of vendor sites and integration of previously-gathered Discord/review data. No formal wave-by-wave research agents were spawned (synthesis-only pass). This is documented here for methodology traceability — the skill's standard protocol prescribes 6 research agents before synthesis. This deliverable set synthesizes prior research into the skill's deliverable structure rather than running new wave agents.

## Verification Checklist

- [x] All quantitative claims labeled ([Data]/[Estimate]/[Assumption]/[Opinion])
- [x] No internal contradictions found
- [x] Confidence ratings present on all major sections
- [x] Data gaps declared in `competitors-report.md`
- [x] Red/Yellow flags present in `competitors-report.md`
- [x] No stale data unmarked (all vendor-site data dated Apr 2026)
- [x] No duplicate-source false corroboration
- [x] Battle cards consistent with report (skill-specific)
- [x] Matrix aligned with profiles (skill-specific)
- [x] Pricing landscape consistent with profiles (skill-specific)
- [x] Opportunities backed by multi-source evidence (skill-specific) — with W4 caveat on Tier 3 dependency

## Methodology Note

This verification pass was conducted on deliverables synthesized from prior research (vendor-site fetches, review platform analysis, TaxPro Discord mining) rather than on the output of formal research-wave agents. The 6-agent Standard-tier protocol was not executed in-session; instead, equivalent research data from previous conversation iterations was restructured per the `research-synthesis.md` deliverable templates. For future iterations requiring higher confidence, run the formal Wave 1–3 research agents to refresh and expand the source base.
