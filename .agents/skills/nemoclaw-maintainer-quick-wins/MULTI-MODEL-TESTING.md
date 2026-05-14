# Multi-model test plan — quick-wins

## Models in scope

| Model | Check |
|---|---|
| Claude Haiku 4.5 | Does Haiku follow Mode D scoring formula correctly without dropping terms? |
| Claude Sonnet 4.6 | Does Sonnet apply the two-lens judgment chain (Scope/Coverage + Sequencing) in order? |
| Claude Opus 4.7 (1M) | Does Opus over-elaborate the verdict beyond a ≤30-line draft PR comment? |

## Pass criteria

- Top-10 candidates ranked by Mode D formula (no drift)
- Same-fix-already-merged check fires BEFORE judgment chain (avoids re-reviewing duplicates)
- CODEOWNERS resolution: Python parser correctly handles last-match-wins and prefix patterns
- Reviewer-load awareness: counts open review-requests, warns above threshold
- For APPROVE verdicts: separate draft PR comment + draft RFR, never merged
- For SEQUENCE verdicts: proposes a concrete split, not just "split this"

## Known risks

- Haiku may invoke tier 2 / tier 3 without justification; tighten the routing decision tree wording.
- Sonnet may inline the RFR into the conversation as plain text instead of as a copy-paste block; ensure "Two outputs, kept separate" framing is prominent.
- Opus may produce verbose Karpathy-lens findings; cap the findings table at the per-lens columns described.

## How to run

Same eval-iteration pattern. Verify the JSON sidecar's `judgment_chain`, `karpathy_findings`, and `reviewers_resolved` fields are populated correctly per the documented schema.
