# Durable Run Recovery — Requirements

## Problem

The single-post research path currently schedules one process-local callback. An
API restart can therefore leave a persisted Run in `queued` or `running` with no
durable record of which stage was attempted, which work committed, or where a
user should resume.

## Scope

This increment makes the existing single-post Run durable, explicitly
resumable, and idempotent. It does not collect creator profiles, paginate creator
posts, add a creator dashboard, or acquire new media.

## User stories

1. As a researcher, I can see that a Run was interrupted instead of mistaking it
   for success or waiting forever.
2. As a researcher, I can explicitly resume from the last committed stage after
   checking the stated recovery action.
3. As an operator, I can restart the API without duplicating findings or other
   domain rows.
4. As a reviewer, I can inspect stage fingerprints, attempts, checkpoints,
   error categories, leases, heartbeats, and recovery actions in SQLite and via
   a bounded API view.

## Acceptance criteria

### R1 — Durable stage ledger

- When a Run is created, the system shall persist ordered `prepare`, `research`,
  and `finalize` jobs before scheduling execution.
- When a job is claimed, the system shall atomically persist its attempt,
  input fingerprint, lease owner, lease timestamps, heartbeat, and Run state.
- When a stage commits, the system shall persist its checkpoint before the next
  stage can be claimed.

### R2 — Conservative process recovery

- When a service starts with pre-existing `queued` or `running` Runs, the system
  shall mark them `interrupted` and recoverable without automatically executing
  them.
- When a `running` job is reconciled, the system shall preserve its checkpoint
  and attempt while clearing its abandoned lease.
- While a Run is `interrupted`, the system shall require an explicit resume
  request before scheduling more work.

### R3 — Explicit resume and user takeover

- When the user calls the resume API or presses the resume control, the system
  shall move only the first blocked/failed/interrupted stage back to `pending`
  and continue after completed stages.
- When ego-browser reports `user_controlled`, login, captcha, risk control,
  access denial, or inactive task space, the system shall persist the hard stop
  and recovery action and shall not automatically reclaim or resume the task
  space.
- When resume is requested for a queued, running, or complete Run, the system
  shall return the existing Run without scheduling duplicate work.

### R4 — Idempotency and atomicity

- When start is repeated for the same project and source fingerprint, the system
  shall return one Run and one stage ledger.
- When research is retried, the system shall persist at most one finding per Run
  and finding dimension, including its evidence relations.
- When a stage persistence transaction fails, the system shall not mark that
  stage complete.
- Repeated start/resume requests shall not create evidence, metric snapshots,
  content identities, creator identities, or duplicate findings.

### R5 — Observable outcomes

- The Run API and project view shall distinguish `queued`, `running`,
  `interrupted`, `partial`, `blocked`, `failed`, and `complete`.
- The Run view shall include an ordered, public-safe job summary and whether the
  Run is recoverable.
- The Web UI shall show the failed/current stage, attempts, checkpoint progress,
  the recovery action, and an explicit resume button for recoverable states.

### R6 — Verification

- Integration tests shall exercise the real Web client → Fastify → SQLite
  contract.
- Tests shall cover slow scheduling, process recreation between stages,
  hard-stop, failed, success, duplicate start, and duplicate resume.
- A fresh clone shall pass install, format, lint, typecheck, test, build, audit,
  secret scan, and generated-source pollution checks.

## Constraints and non-goals

- SQLite remains the local single-writer source of truth.
- No background daemon, distributed queue, creator intake, pagination, creator
  dashboard, media download, or synthetic claim of real platform recovery ships
  in this increment.
- Job errors exposed to the Web are categorized and actionable; raw internal
  diagnostics remain local and are not returned by the API.

