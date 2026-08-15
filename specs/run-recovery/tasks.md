# Durable Run Recovery — Implementation Plan

- [x] 1. Version the Run and job domain contracts
  - Add interrupted Run status and public-safe RunJob schemas.
  - Add EARS requirements and technical design.
  - _Requirements: R1, R2, R5_

- [x] 2. Implement the durable SQLite ledger
  - Add the v2 migration and transactional create, claim, checkpoint, failure,
    reconciliation, resume, and finalization operations.
  - Make finding persistence idempotent per Run and dimension.
  - _Requirements: R1, R2, R4_

- [x] 3. Replace the one-shot execution boundary
  - Execute one claimed persisted stage per scheduled callback.
  - Rebuild state from checkpoints and require explicit recovery.
  - Persist hard-stop categories without automatic browser reclaim.
  - _Requirements: R2, R3, R4_

- [x] 4. Add resume API and Web action
  - Add `POST /api/runs/:id/resume` and Run job summaries.
  - Render interrupted/recoverable states, ordered progress, and explicit
    resume behavior in the existing project desk.
  - _Requirements: R3, R5_

- [x] 5. Verify failure and recovery contracts
  - Cover slow, hard-stop, failed, interrupted/recreated, success, duplicate
    start, and duplicate resume paths.
  - Exercise Web client → Fastify → on-disk SQLite.
  - _Requirements: R4, R6_

- [x] 6. Pass reviewer and open-source gates
  - Run local and fresh-clone install/format/lint/typecheck/test/build/audit.
  - Record source/dist pollution and secret scans.
  - Open a Draft PR that closes #2 without claiming #3–#5.
  - _Requirements: R6_
