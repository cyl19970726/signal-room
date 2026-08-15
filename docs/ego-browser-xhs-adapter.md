# ego-browser Xiaohongshu Adapter Contract

## 1. Decision

Authenticated Xiaohongshu collection is browser-first. The adapter uses ego-browser task spaces to reuse the user's legitimate login state while keeping agent tabs isolated. Generic web search and unauthenticated HTTP are supplementary discovery paths only.

The local profile and task-space aliases are required user configuration and are never committed.

## 2. Capabilities to use fully

### Task-space lifecycle

- Discover configured task spaces.
- Claim only after explicit user authorization.
- Reuse one task space across a project run.
- Stop on user takeover.
- Hand off for login, captcha, or manual risk checks.
- Close scratch tabs; keep only a requested result page.

### Semantic browsing

- Use `snapshotText()` for links, controls, creator metadata, note metadata, and comments.
- Prefer stable locators over ephemeral numeric refs across rounds.
- Verify each meaningful navigation before extracting.

### Visual browsing

- Use screenshots for cover composition, visual identity, virtualized UI, canvas-like surfaces, and QA.
- Use coordinate/keyboard actions only after a fresh screenshot and viewport validation.
- Preserve screenshots as evidence only when the project requires them.

### Browser-context extraction

- Use `js()` for compact DOM traversal and page-state extraction.
- Use `browserFetch()` only when the current page is legitimately authorized and the request does not bypass controls.
- Use CDP for browser metadata and permitted network observation when helper APIs are insufficient.

## 3. Collection workflows

### Post

1. Resolve short/share URL in browser.
2. Record canonical URL and external ID.
3. Collect creator, title/body/tags, publish time, visible metrics, visible comments, media references.
4. Capture raw page evidence and observation time.
5. Acquire media when directly available to the authenticated viewer.
6. Return partial status for unavailable fields.

### Creator

1. Open canonical profile.
2. Record a creator snapshot.
3. Traverse visible notes with controlled scrolling and deduplication.
4. Persist a cursor/checkpoint after each page/batch.
5. Sample across publication periods and performance bands.
6. Open post detail only when required by the project or sampling policy.

### Comments

1. Apply an explicit sample policy: top, recent, replies, or bounded full collection.
2. Preserve author replies and parent relationships.
3. Store real examples behind expandable evidence; reports summarize without inventing comments.

## 4. State machine

```text
unconfigured
  → needs_login
  → ready
  → collecting
  → user_controlled | risk_blocked | partial | complete
  → resumable
```

`user_controlled`, captcha, access denial, and risk-control pages are hard stops. The adapter never auto-reclaims control.

## 5. Provenance envelope

Every collected field carries or inherits:

- canonical source URL;
- platform external ID;
- observed time;
- ego-browser task-space reference stored locally;
- page locator or extraction method;
- raw artifact reference and checksum when retained;
- verification state;
- collection warning.

## 6. Reliability controls

- No selector is treated as globally stable; selectors are adapter-versioned.
- Collection is idempotent by platform identity and observed snapshot.
- Infinite scrolling has maximum steps, progress predicates, and duplicate detection.
- A creator run persists after every bounded batch.
- Rate policy is configurable and conservative.
- UI changes produce a typed `adapter_changed` failure with diagnostic evidence.

## 7. Privacy and open source

Never commit:

- browser task-space IDs tied to a user;
- profile/cookie data;
- signed URLs or authentication headers;
- collected media, transcripts, comments, or creator datasets without redistribution rights;
- screenshots containing private information.

The open-source repository includes adapters, contracts, synthetic fixtures, and redacted golden outputs only.

## 8. Acceptance checks

- Resolve both a Xiaohongshu share link and canonical URL.
- Collect a logged-in post and creator profile through ego-browser.
- Resume creator traversal after interruption without duplicates.
- Stop and request user action on user takeover or login challenge.
- Trace any visible metric or comment sample to a captured source locator.
- Demonstrate semantic, visual, and direct browser workflows in integration tests or recorded validation notes.
