# Xiaohongshu-first MVP Implementation Plan

- [x] 1. Bootstrap the open-source monorepo
  - Add pnpm workspace, TypeScript, linting, formatting, Vitest, and CI.
  - Add secret/artifact-safe ignore rules and environment examples.
  - _Requirements: R12_

- [x] 2. Implement domain contracts
  - Add Creator, snapshots, ContentItem, MetricSnapshot, EvidenceItem, ResearchProject, sample, run, finding, brief, experiment, published content, and review schemas.
  - Encode null-versus-zero and review-state invariants.
  - _Requirements: R3, R5, R9, R10_

- [x] 3. Implement SQLite persistence
  - Add versioned, idempotent migrations and repositories.
  - Enable foreign keys and WAL.
  - Test deduplication and append-only snapshots.
  - _Requirements: R3, R5, R10_

- [x] 4. Implement artifact storage
  - Add configured external artifact root, checksums, and provenance manifests.
  - Ensure real artifacts cannot be committed accidentally.
  - _Requirements: R3, R4, R12_

- [ ] 5. Implement the ego-browser port and XHS adapter shell
  - Model task-space ownership, login/risk/user-control states, checkpoints, and typed adapter failures.
  - Implement post/share URL resolution and visible post collection.
  - Add synthetic contract tests and an opt-in real validation command.
  - _Requirements: R1, R2, R3, R12_

- [ ] 6. Implement intake and project API
  - Resolve inputs, preview object type, create/reuse persistent projects, and expose Run progress over SSE.
  - Preserve partial success and recovery actions.
  - _Requirements: R1, R5_

- [ ] 7. Implement media evidence pipeline
  - Probe media, transcribe, detect shots, extract sparse/dense/cue frames, map cue-to-shot overlap, and index evidence.
  - Keep uncertain term normalization as machine draft.
  - _Requirements: R4_

- [ ] 8. Implement single-post research engine
  - Produce typed findings with evidence relations, scope, confidence, counterevidence, alternatives, and unknowns.
  - Refuse unsupported performance and hidden-metric claims.
  - _Requirements: R6, R9_

- [ ] 9. Implement the local research UI
  - Follow the approved UX specification before writing interface code.
  - Build intake/progress and the three-pane single-post project page.
  - Add transcript-frame evidence inspection and finding review.
  - Verify responsive behavior and accessibility.
  - _Requirements: R6, R9, R11_

- [ ] 10. Add cohort and creator foundations
  - Add project sample management, cohort rules, creator pagination checkpoints, and placeholder views driven by real schemas.
  - Do not emit stable strategic claims before sample gates are met.
  - _Requirements: R7, R8_

- [ ] 11. Add action-loop foundations
  - Convert confirmed findings to briefs, associate experiments/published content, append metric snapshots, and revise findings.
  - _Requirements: R9, R10_

- [ ] 12. Build the thin Codex Skill
  - Add `content-intelligence` routing to stable CLI/API operations.
  - Keep browser selectors and business logic out of the Skill.
  - _Requirements: R1–R12_

- [ ] 13. Validate the first real vertical slice
  - Use an authorized ego-browser task space to collect one Xiaohongshu post.
  - Verify interruption/resume, evidence traceability, missing-data language, and no secret/artifact leakage.
  - Record the validation without committing creator media or private data.
  - _Requirements: R1–R6, R9, R11, R12_
