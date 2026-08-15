# Xiaohongshu-first MVP Requirements

## R1 — Intake and resolution

- When a user submits a Xiaohongshu post URL or share text, Signal Room shall resolve and preview the canonical post before creating a project.
- When a user submits a creator profile, Signal Room shall propose a creator project rather than a single-post project.
- When a user submits 2–100 post links, Signal Room shall create a cohort candidate set with preserved input order and errors.
- When input is unknown, Signal Room shall retain it in the inbox and explain the minimum required correction.

## R2 — ego-browser session contract

- When authenticated collection is required, Signal Room shall use an explicitly configured ego-browser task space such as local alias `hhh-01`.
- When the browser reports user control, login challenge, captcha, risk control, or access denial, Signal Room shall stop and request user action.
- When collection resumes, Signal Room shall continue from a persisted checkpoint without duplicating content entities.

## R3 — Source facts and snapshots

- When a post or creator is collected, Signal Room shall store platform identity, source URL, observation time, provenance, and available public facts.
- When a changing metric or profile field is collected again, Signal Room shall append a new snapshot rather than overwrite history.
- When a field is unavailable, Signal Room shall store `null` and a collection warning rather than zero or fabricated data.

## R4 — Media evidence

- When legitimate video media is available, Signal Room shall create metadata, transcript, shot boundaries, representative frames, cue-frame mappings, and an evidence index.
- When a transcript term is uncertain, Signal Room shall preserve raw text and label normalization as a machine suggestion.
- When a transcript cue is shown, Signal Room shall expose all overlapping shot IDs and clarify the representative-frame limitation.

## R5 — Persistent projects

- When analysis begins, Signal Room shall create or reuse a persistent `ResearchProject` and attach retryable Runs to it.
- When the same post participates in multiple projects, Signal Room shall reuse one `ContentItem` while preserving project-specific roles and cohorts.
- When a Run partially fails, Signal Room shall preserve completed evidence and expose the failed stage and recovery action.

## R6 — Single-post research

- When author or topic baselines exist, Signal Room shall show the subject's relative position and sample sizes.
- When baselines do not exist, Signal Room shall state that abnormal performance cannot be determined.
- When a finding is selected, Signal Room shall open its exact source evidence, counterevidence, alternatives, and scope.
- When video evidence exists, Signal Room shall support shot-level keep/compress/remove decisions and cut-list export.

## R7 — Cohort research

- When at least eight comparable posts exist, Signal Room shall support winner, middle, and underperformer cohorts with explicit grouping rules.
- When observation windows or formats are incomparable, Signal Room shall warn or exclude samples before calculating differences.
- When a distinguishing factor is reported, Signal Room shall show effect direction, coverage, representative samples, exceptions, and confounds.
- When sample quality is insufficient, Signal Room shall label the output exploratory.

## R8 — Creator research

- When at least 12 posts across three publication periods exist, Signal Room shall calculate content pillars, distribution, stability, formats, visual/script grammar, and outliers.
- When a pillar is selected, Signal Room shall show high, middle, and low representatives.
- When launch advice is generated, Signal Room shall separate reusable capability, identity dependency, resource dependency, and differentiated opportunity.

## R9 — Findings and actions

- When analysis produces a finding, Signal Room shall assign type, confidence, scope, evidence relations, and `machine_draft` review status.
- When a user reviews a finding, Signal Room shall preserve the previous version and reviewer decision.
- When a confirmed finding becomes a brief, Signal Room shall preserve source links, invariants, test variables, risks, and measurement requirements.

## R10 — Publish and review loop

- When a published post is linked, Signal Room shall associate it with its brief and experiment.
- When metrics are added at multiple times, Signal Room shall preserve every snapshot.
- When a review completes, Signal Room shall allow the original finding/playbook to be confirmed, revised, or rejected.

## R11 — UX

- When a user opens a project on desktop, Signal Room shall present navigation, decision canvas, and contextual evidence inspector without a single infinite report column.
- When viewport width is below 1024px, Signal Room shall collapse navigation and render evidence in a drawer without horizontal overflow.
- When a value or conclusion is unknown, Signal Room shall display the missing evidence and avoid a deceptive score.

## R12 — Open-source safety

- When the repository is published, it shall exclude browser state, tokens, cookies, collected media, real creator corpora, and private artifacts.
- When tests require data, they shall use synthetic or redistributable fixtures.
- When logs contain URLs or headers, Signal Room shall redact authentication and signed parameters.
