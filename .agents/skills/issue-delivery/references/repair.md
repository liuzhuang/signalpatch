# Repair stage

Use a `workspace-write` sandbox with no external write credentials. Inputs are limited to the Issue Contract, current diff, normalized failure summary, Failure Fingerprint, previous change summary, allowed paths, and attempt number.

Reproduce the current failure and make one focused correction. Stop without editing when the same Failure Fingerprint appears twice, the failure is infrastructure-only after one retry, no effective change is possible, the next change crosses allowed paths, risk becomes R2 or R3, or the attempt exceeds three.
