## Stage 1: Safe monorepo and domain foundation

**Goal**: Bootstrap the pnpm workspace, CI, safe local configuration, Zod contracts, SQLite migrations, and external artifact store.
**Success Criteria**: Workspace installs; real artifacts and browser state are ignored; domain/storage/artifact tests pass; SQLite uses WAL and foreign keys.
**Tests**: Schema invariants, append-only snapshots, content deduplication, artifact checksum and repository-root rejection.
**Status**: Complete

## Stage 2: Authenticated collection vertical

**Goal**: Implement the ego-browser port, XHS post/share resolver and collector, typed stops/checkpoints, and durable intake/project/run orchestration.
**Success Criteria**: A post/share input can be resolved, collected, normalized, persisted, and converted into evidence-backed machine-draft findings; partial failures preserve completed work.
**Tests**: Synthetic adapter contract, URL resolution, failure mapping, checkpoint recovery, API lifecycle, SSE progress.
**Status**: Complete

## Stage 3: Research desk

**Goal**: Implement the approved industrial/utilitarian three-pane single-post research UI with contextual evidence inspection and finding review.
**Success Criteria**: Intake reaches a persistent project page; findings expose scope and all evidence relations; review creates history; responsive layout has no horizontal overflow.
**Tests**: UI component/browser checks, accessibility, review API integration, production build.
**Status**: Complete

## Stage 4: Real validation and release handoff

**Goal**: Run opt-in read-only ego-browser validation with profile `hhh-01`, document only redacted coverage, complete quality gates, push, and open a draft PR.
**Success Criteria**: Authorized post is validated or a hard-stop handoff is issued; no real artifacts leak into Git; typecheck/test/build pass; branch is pushed and draft PR describes covered and uncovered boundaries.
**Tests**: Real smoke validation, secret/artifact scan, full workspace quality gates.
**Status**: In Progress
