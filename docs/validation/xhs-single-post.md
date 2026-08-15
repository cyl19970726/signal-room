# Authenticated Xiaohongshu single-post validation

Date: 2026-08-16

## Covered

- Used the authorized share link through `ego-browser` with the configured `hhh-01` profile and the isolated `signal-room xhs mvp` task space.
- Performed read-only navigation and extraction. No like, bookmark, comment, follow, message, or publish action was attempted.
- Resolved the share link to a canonical post and normalized a video `ContentItem`, creator identity, a source snapshot, and a public metric snapshot.
- Observed public like, comment, share, and bookmark fields. Views and all owner-only outcomes remained `null` and rendered as unknown.
- Stored raw evidence and its provenance manifest outside the repository. The committed validation record contains no title, creator, post ID, signed URL, metric value, media, transcript, comment corpus, screenshot, task-space ID, or cookie data.
- Persisted a single-post `ResearchProject` and a completed `AnalysisRun` with three machine-draft findings: `fact`, `observation`, and `unknown`.
- Verified that every finding has confidence, scope limitations, review status, and at least one evidence relation.
- Opened the real persistent project in the three-pane research desk and verified the contextual evidence inspector.

## Recovery exercised

The first adapter integration exposed a local protocol mismatch: the installed `ego-browser` CLI emits `cliLog` results on stderr while the port initially parsed stdout only. The typed failure preserved a hard stop, no alternative collector was used, and the corrected port resumed the same authorized read-only workflow. A regression test now covers the CLI output channel.

## Not covered in this validation

- Captcha, login challenge, platform risk-control, and deliberate user-takeover handoff were not triggered on the real page. Their typed stop mapping is covered synthetically; real handoff remains an explicit future validation boundary.
- No media URL was acquired, so transcript, shot, frame, and cue-to-shot evidence remain unavailable rather than fabricated.
- No comments were collected or committed.
- No author/topic baseline or owner metrics were imported, so relative performance, reach, retention, follower growth, and conversion cannot be determined.
