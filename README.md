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

## Documents

- [Product requirements](docs/prd.md)
- [System architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [ego-browser Xiaohongshu adapter](docs/ego-browser-xhs-adapter.md)
- [UX and visual specification](docs/ux-spec.md)
- [MVP requirements](specs/xhs-first-mvp/requirements.md)
- [MVP technical design](specs/xhs-first-mvp/design.md)
- [Implementation plan](specs/xhs-first-mvp/tasks.md)

## Status

Specification-first. The first implementation milestone is a local, open-source vertical slice:

`paste Xiaohongshu link → authenticated collection → evidence bundle → one research project → traceable dashboard`

## License

Apache-2.0. See [LICENSE](LICENSE).
