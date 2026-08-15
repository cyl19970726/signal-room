# Signal Room — Product Requirements Document

Version: 1.0

Status: implementation-ready

Initial platform: Xiaohongshu
Deployment: local-first, open source

## 1. Product definition

Signal Room is a persistent content research and learning workspace. It is not a one-off AI report generator. Its primary object is a long-lived `ResearchProject` that connects source content, evidence, findings, content playbooks, production briefs, experiments, published work, and reviews.

The MVP answers three questions:

1. Why did one Xiaohongshu post perform this way?
2. Within a comparable set, what actually distinguishes high, middle, and low performers?
3. How does one creator repeatedly serve an audience, and which capabilities can a new account reuse without copying the creator's identity?

## 2. Target users

- A creator operating Xiaohongshu and planning to expand to other platforms.
- A content strategist, director, or operator researching peers and topics.
- A small team that needs research to become briefs, experiments, and reviews rather than disappear into static reports.

## 3. Jobs to be done

### Research

- When I find a useful post, I can paste the share text or link and preserve it as a reusable sample.
- When a topic becomes timely, I can compare a controlled group instead of treating the biggest number as the only truth.
- When I study a creator, I can see the audience promise, content pillars, formats, proof grammar, evolution, outliers, and failure modes.
- When I read a conclusion, I can inspect its transcript, frame, comment, metric snapshot, or calculation.

### Action

- I can confirm, revise, or reject machine-drafted findings.
- I can turn approved findings into a content playbook or production brief.
- I can define a single-variable experiment with measurable success criteria.
- After publishing, I can append metrics and update the original hypothesis.

## 4. Product principles

1. One page answers one research question.
2. Facts, observations, hypotheses, and unknowns never share an unlabeled bucket.
3. No comparison means no strong performance claim.
4. Public likes do not prove reach, retention, follower growth, revenue, or paid efficiency.
5. Every conclusion is inspectable and revisionable.
6. The research result must create an action or explicitly state why action is blocked.
7. Xiaohongshu-specific analysis is first class: cover, title, search intent, save value, audience language, comments, and creator identity.
8. Browser evidence is collected through the user's legitimate authenticated session; automation stops for login, captcha, risk control, or user takeover.

## 5. Scope

### MVP in scope

- Universal intake for one post, multiple post links, creator profile, and Xiaohongshu share text.
- Authenticated Xiaohongshu browsing through ego-browser.
- Append-only creator and metric snapshots.
- Media download when legitimately available, transcription, scene detection, frames, subtitle-frame alignment, and full transcript.
- Single-post, cohort, and creator projects.
- Evidence inspector and machine-draft finding review.
- Content playbook, brief, experiment, published-content link, and review skeletons.
- Local SQLite and filesystem artifact storage.
- HTML/JSON export and selective Notion-ready summaries.

### Later

- X, Douyin, WeChat Channels, and YouTube adapters.
- Owner dashboard imports and automated metric refresh.
- Team roles, remote storage, hosted multi-tenant service.
- Publishing automation.

### Non-goals

- Circumventing platform access controls or risk systems.
- Inferring hidden metrics from public engagement.
- Declaring causality from a single post.
- Automatically publishing, commenting, liking, following, or messaging in MVP.
- Storing the full evidence corpus in Notion.
- A universal cross-platform composite score.

## 6. Information architecture

### Research desk

- Universal intake.
- Project queue and progress.
- Needs-data and needs-review queues.
- Recently updated projects.

### Sample library

- Posts, creators, saved topic sets, tags, collection state.
- Reuse one `ContentItem` across many projects.
- Filters for format, topic, time, cohort, and evidence availability.

### Research projects

- Single post.
- Topic cohort.
- Creator.
- Shared right-side evidence inspector.

### Content system

- Confirmed success structures.
- Failure patterns.
- Script templates and visual grammar.
- Platform playbooks and scope conditions.

### Publish and review

- Briefs and experiments.
- Published versions.
- Append-only metric snapshots.
- Hypothesis confirmation, revision, or rejection.

## 7. Core flows

### 7.1 Universal intake

1. User pastes a Xiaohongshu post/profile URL, share text, or 2–100 URLs.
2. System resolves object type and displays a preview before collection.
3. User chooses: save only, single analysis, topic cohort, or creator analysis.
4. Collection runs through the configured ego-browser task space.
5. Progress shows meaningful stages and recoverable failures.
6. Completion opens the persistent project, not a disposable Run page.

### 7.2 Single post

The page shows:

- research question, objective, evidence coverage, and one-sentence verdict;
- author/topic baseline position when comparable data exists;
- audience job, promise, tension, hook, script, visual grammar, proof chain, CTA;
- full transcript aligned to representative frames and overlapping shots;
- comment themes, objections, implementation intent, and unanswered demand;
- causal hypotheses, counterevidence, alternatives, and missing owner data;
- keep/compress/remove editing decisions when video evidence exists;
- actions: add to cohort, analyze creator, save finding, generate brief.

### 7.3 Topic cohort

Before analysis, the system records objective, sample inclusion rules, observation window, author-size constraints, format constraints, timeliness, and paid-distribution unknowns.

The page compares winner, middle, and underperformer cohorts across:

- user job and topic angle;
- cover/title/search promise;
- format, duration, script structure, visual grammar, proof density, CTA;
- comment demand and interaction mix;
- effect direction, coverage, exceptions, and confounds.

With fewer than eight comparable posts, results are labeled exploratory.

### 7.4 Creator research

The page contains:

- positioning, audience segments, account promise, credibility system;
- content pillars with share, median, distribution, stability, and representatives;
- high/middle/low performance samples;
- format system, visual identity, script templates, proof grammar, evolution;
- hit dependence, outliers, weak patterns, commercial-content separation;
- comments as demand signals;
- reusable capabilities versus identity/resource dependencies;
- a differentiated launch strategy and a first ten-post experiment plan.

Stable strategic extrapolation requires at least 12 samples across three publication periods. Otherwise the page states the limitation.

## 8. Performance interpretation contract

Signal Room never creates one universal score. The active objective changes the decision dimensions:

| Objective | Public proxies | Owner data required for closure |
| --- | --- | --- |
| Awareness | interactions, velocity, share/like, relative lift | reach source, unique reach, paid increment |
| Growth | comment intent, visible profile signals | profile visits, followers gained, conversion to follow |
| Authority | saves, search language, proof quality, durable questions | search share, return visits, long-tail retention |
| Conversion | inquiry/action comments | clicks, leads, orders, revenue, cost |

Missing fields remain `null` and render as unknown, never zero.

## 9. Evidence and review contract

Each finding includes:

- type: `fact | observation | hypothesis | unknown`;
- confidence: `high | medium | low`;
- scope and applicability;
- supporting, contradicting, alternative, and calculation-input evidence;
- review status: `machine_draft | human_confirmed | human_revised | rejected`;
- revision history.

UI copy must say “machine draft” or “normalization suggestion” until a real reviewer confirms it.

## 10. Open-source boundaries

- Core schemas, storage, pipelines, analysis contracts, and local UI are Apache-2.0.
- User cookies, task-space identifiers, downloaded media, transcripts, screenshots, and collected content are never committed.
- Fixture data must be synthetic or explicitly redistributable.
- Platform adapters expose capability and compliance boundaries.
- Secrets are local environment configuration; logs redact tokens, cookies, and signed URLs.

## 11. Success criteria

- A user can paste a Xiaohongshu post and reach the first traceable finding in one complete run.
- A user can paste a creator profile and see collection progress, partial recovery, and at least 12 sampled posts.
- 100% of findings have type, confidence, scope, and evidence relations.
- Clicking any evidence-backed conclusion opens the exact source locator.
- A user can turn a confirmed finding into a brief without copying report text.
- A published result can revise the hypothesis that created it.
- No hidden metric is rendered as known when owner data has not been imported.

## 12. Release gates

MVP is complete only after three real vertical validations:

1. Single post → evidence → finding → brief.
2. Eight-plus comparable posts → high/middle/low contrast → experiment.
3. Creator profile → 12-plus samples → operating system → ten-post launch plan.

All three must use ego-browser for authenticated Xiaohongshu collection and must survive one recoverable interruption.
