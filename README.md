# Signal Room

Signal Room is an evidence-first content intelligence workspace for creators and small media teams. It turns a Xiaohongshu post, a group of posts, or a creator profile into traceable research, reusable content playbooks, production briefs, experiments, and publishing reviews.

The project is Xiaohongshu-first. Other platforms are extension points, not MVP promises.

## Product loop

```text
Capture → Evidence → Research → Finding → Playbook → Brief → Publish → Review
   ↑                                                                  ↓
   └──────────────────────────── learning loop ───────────────────────┘
```

## MVP research modes

- Single post: why did this content perform this way?
- Topic cohort: what separates winners, middle performers, and underperformers?
- Creator: how does this account repeatedly serve an audience, and what can a new account responsibly reuse?

Every conclusion must link back to public metrics, source text, comments, transcript cues, frames, shots, calculations, or explicit manual notes. Unknown owner metrics remain unknown.

## Xiaohongshu collection

Authenticated collection uses the user's existing login through [ego-browser](docs/ego-browser-xhs-adapter.md). Signal Room does not bypass authentication, captchas, access controls, or platform risk controls.

## Run the first vertical slice

Requirements: Node.js 22+, pnpm 10, and a working `ego-browser` login profile.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://localhost:4318`, paste one Xiaohongshu post/share link, verify the normalized preview, and create the persistent research project. The API listens on `http://127.0.0.1:4317` by default.

Real artifact storage must point outside this repository. Local SQLite files are ignored. To run the opt-in redacted validation command:

```bash
SIGNAL_ROOM_REAL_XHS_URL='authorized-share-url' pnpm --filter @signal-room/api validate:xhs
```

The command performs read-only collection and reports contract coverage without printing the source identity or artifact path. It stops for login, captcha, risk control, access denial, or user takeover.

## Documents

- [Product requirements](docs/prd.md)
- [System architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [ego-browser Xiaohongshu adapter](docs/ego-browser-xhs-adapter.md)
- [UX and visual specification](docs/ux-spec.md)
- [Reviewer plan and merge gates](docs/reviewer-plan.md)
- [MVP requirements](specs/xhs-first-mvp/requirements.md)
- [MVP technical design](specs/xhs-first-mvp/design.md)
- [Implementation plan](specs/xhs-first-mvp/tasks.md)
- [Durable Run recovery requirements](specs/run-recovery/requirements.md)
- [Durable Run recovery design](specs/run-recovery/design.md)
- [Durable Run recovery tasks](specs/run-recovery/tasks.md)
- [Durable Run recovery validation](docs/validation/run-recovery.md)

## Reusable Skills

The repository includes three evidence-first Skills under `skills/`:

- [`analyze-creator-videos`](skills/analyze-creator-videos/SKILL.md): creator corpus collection, baseline analysis, tier selection, cross-tier comparison, and the creator research dashboard.
- [`video-content-reconstruction`](skills/video-content-reconstruction/SKILL.md): a probe-first, category-free protocol for reconstructing transcripts, visual states, OCR, procedures, arguments, relationships, omissions, and unknowns.
- [`deep-content-director`](skills/deep-content-director/SKILL.md): turns audited research into executable topics, scripts, shot plans, production handoffs, experiments, and publishing reviews.

Only methods, schemas, scripts, synthetic fixtures, and tests are published. Real creator media, transcripts, authenticated URLs, browser state, and private research artifacts remain outside the public repository.

## Status

The first local vertical slice is implemented and has completed one authenticated, read-only Xiaohongshu validation:

`paste Xiaohongshu link → authenticated collection → evidence bundle → persistent research project/run → evidence-backed findings → traceable three-pane research desk`

Runs now use a persisted stage ledger and explicit resume after interruption or
hard stops. Media transcription/frame evidence, real browser handoff validation,
cohort analysis, and creator analysis remain open milestones. See the
[implementation tasks](specs/xhs-first-mvp/tasks.md) and
[redacted validation record](docs/validation/xhs-single-post.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
