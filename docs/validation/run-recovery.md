# Durable Run recovery — validation record

Date: 2026-08-16

Scope: GitHub issue #2 only. All browser and database fixtures described here
are synthetic and live outside Git. No Xiaohongshu page, login state, creator
corpus, media, or task-space identifier was collected for this validation.

## Automated contract coverage

The suite contains 10 test files / 33 tests and covers:

- slow scheduling with a Run remaining observably queued;
- a `user_controlled` hard stop persisted as blocked with no automatic schedule
  on service reconstruction;
- an internal research failure persisted as failed while its diagnostic remains
  outside the public API response;
- an on-disk SQLite service reconstruction after `prepare` and `research`
  commit but before `finalize`;
- explicit Web-client resume of only `finalize` to one complete Run;
- duplicate start, duplicate resume, and resume-after-complete producing one Run,
  three jobs, three findings, three finding-evidence relations, two evidence
  items, one metric snapshot, one content identity, and one creator identity;
- orphaned running-job reconciliation preserving attempt/checkpoint, clearing the
  lease, and incrementing the attempt only after explicit resume;
- CORS rejection, internal error redaction, evidence review, and existing visual
  contracts.

The reconstruction integration uses the actual Web API helper → Fastify
injection → on-disk SQLite path. It closes the first Fastify instance and SQLite
connection, opens a second service on the same database, verifies
`interrupted/recoverable`, and then calls the public resume API.

## Browser flow

Tool: `agent-browser`, restricted to `127.0.0.1`.

- Route: `/?project=<synthetic-project-id>`.
- Before action: the page showed `interrupted`, the recovery action, completed
  `prepare`/`research`, pending `finalize`, attempt counts, checkpoint state, and
  the explicit resume button.
- Action: clicked “我已处理阻断，显式恢复”.
- After action: the page showed `complete`, all three durable stages remained
  inspectable, and no duplicate finding/evidence/metric rows appeared.
- Browser console: Vite connection logs and the React development-tools notice;
  no application error was reported.
- Responsive audit: 320, 768, 1024, 1200, and 1440 px all reported
  `documentElement.scrollWidth === window.innerWidth`.

Screenshots were stored in a temporary directory outside the repository and are
not committed.

## Local and fresh-clone gates

Both the implementation worktree and a fresh clone from
`origin/codex/run-recovery` passed:

```text
pnpm install --frozen-lockfile
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --audit-level=high
```

Fresh-clone observations:

- source `dist` directories before typecheck: 0;
- source `dist` directories after typecheck: 0;
- package/app `dist` directories after build: 8, all ignored;
- tracked generated paths: 0;
- Git status after build: clean;
- known dependency vulnerabilities at the configured audit level: 0;
- repository sensitive-configuration pattern hits: 0.

## Honest boundary

- The current single-post Run begins after authenticated post collection, so the
  hard-stop test injects the real `BrowserStopError('user_controlled')` contract
  rather than taking over a live Xiaohongshu task space.
- The system persists claim-time heartbeats and exposes a heartbeat update
  operation. Current stages are synchronous and short; a periodic heartbeat loop
  belongs with a future genuinely long browser/media stage.
- Startup reconciliation assumes the documented local single-writer API. It
  marks active persisted work interrupted and never auto-resumes or auto-claims
  browser control.
- Creator intake, pagination, corpus coverage, and creator dashboards remain
  GitHub issues #3–#5 and are not implemented here.

