# Multi-model test plan — fresh-issue-triage

## Models in scope

| Model | Check |
|---|---|
| Claude Haiku 4.5 | Does Haiku detect the ISSUE_TEMPLATE correctly from labels? |
| Claude Sonnet 4.6 | Does Sonnet apply CODEOWNERS path-match for area-labels? |
| Claude Opus 4.7 (1M) | Does Opus produce a respectful needs-info comment that doesn't blame the reporter? |

## Pass criteria

- Template detection: bug_report (labels include bug+status: triage), feature_request (enhancement+status: triage), doc_issue (documentation+status: triage)
- For bug_report with empty Reproduction Steps: needs-info comment drafted with explicit fields the reporter should fill
- CODEOWNERS resolution: regex extracts paths from body; matches against last-matching pattern
- Possible-duplicate flag fires only when title Jaccard ≥0.7 against another open issue
- Never applies labels/comments without per-issue confirmation

## Known risks

- Haiku may default all issues to bug_report. Detect from labels first, then fall back.
- Sonnet may suggest individual assignees instead of team handles. Reinforce "team handles preferred".
- Opus may produce overly long needs-info comments. Use the template verbatim, don't elaborate.

## How to run

Run against the morning issue queue. Per issue, verify the 5 proposal fields match the expected output.
