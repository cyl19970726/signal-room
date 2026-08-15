# Signal Room — Reviewer Plan

## 1. Reviewer role

The reviewer does not equate code volume, a local demo, or a generated report with completion. A work package passes only when its user-visible outcome, domain invariants, failure behavior, privacy boundary, tests, and clean-checkout CI all agree.

Implementation agents own code changes. The reviewer owns:

- scope control and requirement traceability;
- evidence-backed acceptance;
- severity and merge decisions;
- follow-up work packages;
- release and open-source safety gates.

## 2. Severity

- **P0 / blocking**: security exposure, privacy leakage, fake real-world success, incorrect metric semantics, broken clean checkout, data loss, unrecoverable browser control state, or a claimed requirement that is not implemented.
- **P1 / required before milestone release**: incomplete user flow, missing recovery UX, weak accessibility, missing revision history, inaccurate task/PR documentation, or insufficient integration coverage.
- **P2 / backlog**: maintainability, performance, polish, and low-risk ergonomics that do not invalidate the current result.

## 3. Merge gates

### G0 — Scope and claims

- PR description names exactly what ships and what remains unknown.
- `tasks.md` reflects code, not intent or placeholders.
- Static HTML, synthetic fixtures, and typed future schemas are not presented as completed product behavior.

### G1 — Clean-checkout reproducibility

From a fresh clone:

```text
pnpm install --frozen-lockfile
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

All commands pass without untracked build artifacts from a previous run.

### G2 — Domain and metric truth

- Missing values are `null`, not zero.
- Public engagement is not labeled reach, retention, follower growth, or conversion.
- Snapshots append; revision history is preserved.
- Every finding has type, confidence, scope, review status, and evidence relations.
- Unsupported causal or comparative claims are refused.

### G3 — ego-browser contract

- Xiaohongshu real collection uses ego-browser only.
- User-owned login/profile/task-space values are local configuration.
- Login, captcha, risk control, access denial, inactive space, and user takeover are hard stops.
- No automatic reclaim after user takeover.
- Collection checkpoints are persisted and resumable.
- Semantic, visual, and browser-context paths are used where appropriate.

### G4 — Persistence and recovery

- Project is the durable root; Run is a retryable execution.
- Slow, partial, blocked, failed, and complete states are observable in the UI.
- Process interruption does not silently report success.
- Multi-step source persistence is atomic or explicitly recoverable.
- Re-running does not duplicate platform identities.

### G5 — Evidence traceability

- A finding opens the exact source locator.
- Counterevidence, alternatives, calculation inputs, and absent evidence are distinguishable.
- Transcript normalization remains a machine suggestion until reviewed.
- Representative frames and shot overlap are not overstated.
- Real validation records are redacted but reproducible by an authorized operator.

### G6 — UX and accessibility

- The approved industrial/editorial design specification is followed.
- 320, 768, 1024, 1200, and 1440px have no horizontal overflow.
- Below 1280px, the evidence inspector is a drawer.
- Keyboard focus, labels, contrast, and textual chart equivalents pass.
- The first screen exposes the research question, boundary, verdict, unknowns, and next action.

### G7 — Local API and open-source security

- Local API does not accept arbitrary Web origins.
- Internal errors, filesystem paths, cookies, tokens, signed URLs, and browser state are not returned or logged publicly.
- Real media, transcripts, comments, screenshots, databases, and task-space identifiers are not tracked.
- Synthetic fixtures cannot be mistaken for real validation.

### G8 — Real vertical validation

- Use an explicitly authorized ego-browser profile.
- Record the exact covered and uncovered behaviors.
- Preserve real artifacts outside Git.
- Validate at least one recovery path in addition to the happy path.
- CI must be green after the final validation-related code change.

## 4. Current PR #1 acceptance

PR #1 remains blocked until:

1. fresh-clone typecheck works without existing `dist`;
2. localhost origin and internal-error exposure are fixed;
3. user-specific ego-browser configuration is removed from tracked files;
4. Run terminal states are genuinely observed by the Web UI;
5. task and PR claims match implementation;
6. GitHub Actions are green.

## 5. Next development phase

No next phase starts before PR #1 passes all P0 gates.

### Phase 2A — Creator corpus and checkpoints

Outcome: one Xiaohongshu creator profile becomes a persistent, auditable corpus rather than a one-off scrape.

- Collect creator/profile snapshots and all publicly visible post identities with bounded pagination.
- Persist cursor, batch progress, deduplication, and partial recovery.
- Separate inventory coverage from deep-analysis coverage.
- Stratify high, middle, low, and time-period samples using explicit observation rules.
- Never commit the real corpus.

Acceptance:

- at least 12 posts across three periods in the first real validation;
- interruption resumes without duplicate `ContentItem` rows;
- inventory count, collected count, failed count, and deep-analysis count are separate;
- profile/user takeover remains a hard stop.

### Phase 2B — Media evidence pipeline

Outcome: a video detail page contains a real transcript-frame-shot evidence spine.

- Legitimate media acquisition with provenance and failure states.
- Probe, transcription, uncertainty, scenes, sparse/dense/cue frames.
- Cue-to-all-overlapping-shot mapping.
- Shot-level keep/compress/remove, reason, target duration, and cut-list export.

Acceptance:

- one real video can be traced from transcript cue to frame and overlapping shots;
- unresolved terminology is visible;
- missing media degrades honestly;
- no creator media is committed.

### Phase 2C — Creator and cohort intelligence

Outcome: creator research and high/middle/low comparison produce drillable, bounded findings.

- Content pillars with count, median, distribution, stability, and representatives.
- High/middle/low comparison with effect direction, coverage, exceptions, and confounds.
- Visual grammar, script templates, proof grammar, evolution, and account dependencies.
- Creator dashboard drills into the shared content evidence page.

Acceptance:

- every aggregate conclusion opens supporting and challenging posts;
- commercial and organic content are separable;
- creator-stage/time confounds are shown;
- public likes are not treated as traffic or conversion.

### Phase 2D — Launch and learning loop

Outcome: confirmed creator/cohort findings become a differentiated launch plan that can be tested and revised.

- Finding review and playbook promotion.
- Ten-post launch plan with invariants and variables.
- Brief, experiment, published content, metric snapshots, and review.
- Confirm, revise, or reject the originating hypothesis.

Acceptance:

- every brief cites confirmed findings;
- blocked measurement is explicit;
- publishing review updates the original finding/playbook with history.

## 6. Assignment rule

Each phase is assigned only after the previous phase has a green PR and a reviewer verdict. A phase may be split into multiple PRs, but one PR must have one primary user-visible outcome. No agent may mark a task complete solely because a schema, placeholder, or static export exists.
