# Xiaohongshu-first MVP Technical Design

## Scope of the first vertical slice

Implement one durable path:

```text
post/share URL
  → ego-browser resolution and collection
  → normalized ContentItem + snapshots
  → optional media evidence bundle
  → single-post ResearchProject
  → evidence-backed Findings
  → three-pane project page
```

Creator and cohort entities must exist in the schema, but their full analytical UI follows after this slice is stable.

## Technology baseline

- TypeScript monorepo.
- pnpm workspaces.
- React + Vite for the local Web app.
- Fastify local API.
- Zod contracts.
- SQLite with migrations and WAL.
- Vitest for unit/integration tests.
- Playwright for local application UI tests; ego-browser remains the real authenticated platform adapter.
- Filesystem artifact store configured outside the repository.

## Dependency rule

```text
UI/CLI → application services → domain
adapters/storage/media → domain ports
domain → no infrastructure dependencies
```

## First endpoints

- `POST /api/intake/resolve`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/runs`
- `GET /api/runs/:id`
- `GET /api/content/:id/evidence`
- `POST /api/findings/:id/reviews`

## Job model

- Persist jobs and stages in SQLite.
- Expose persisted Run state for reliable client polling until a terminal state.
- Fingerprint stage inputs.
- Checkpoint ego-browser collection after each bounded operation.
- Treat source collection, media processing, and research as independent recoverable stages.

## First UI

Implement the approved industrial/editorial three-pane layout from `docs/ux-spec.md`:

- left: project/sample navigation;
- center: research question, evidence boundary, finding list, transcript timeline;
- right: evidence inspector and review controls.

## Security defaults

- `.env` and local config ignored.
- Artifact root defaults to a user data directory, never the repository.
- Browser configuration references a task-space alias; it does not serialize login state.
- Real-source integration tests are opt-in and produce ignored artifacts.

## Migration path for existing research

An importer may later map existing JSON artifacts:

- creator inventories → Creator, CreatorSnapshot, ContentItem, MetricSnapshot;
- per-video reports → MediaAsset and EvidenceItem;
- editorial notes → machine-draft Finding;
- static HTML remains an export, not the database.

The importer is not required for the first vertical slice.
