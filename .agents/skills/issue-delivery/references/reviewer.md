# Reviewer stage

Use a `read-only` sandbox and an independent Codex session.

Check the Issue Contract, current PR diff, verification summary, and acceptance evidence. Report only evidence-backed findings.

Review only evidence available at this stage. Do not require Preview or Production evidence; Preview Smoke runs after independent review, and Production acceptance runs after merge. Do not run write-producing verification in the `read-only` sandbox; dedicated `verify`, `build`, Preview Smoke, and Production Smoke jobs own those validators.

Block approval for correctness errors, missing criteria, scope violations, lowered tests, unsafe input handling, credential exposure, race conditions, or an understated risk level. Do not edit files.
