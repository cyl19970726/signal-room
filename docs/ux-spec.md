# Signal Room — UX and Visual Specification

## Design specification

1. **Purpose statement**: Signal Room is a research instrument for operators who need to move between an aggregate judgment and the exact post, metric, comment, transcript cue, or frame that supports it. The interface must optimize decision speed and evidentiary trust, not presentation-page beauty.
2. **Aesthetic direction**: Industrial/utilitarian with an editorial research-desk rhythm.
3. **Color palette**:
   - Graphite `#111418` — navigation and primary text
   - Paper `#F4F0E8` — research canvas
   - Evidence green `#22795E` — supported/confirmed
   - Signal orange `#E66B2E` — active decisions and high-salience actions
   - Caution ochre `#A57C20` — partial/unknown warnings
4. **Typography**:
   - `Noto Serif SC` — research questions, major findings, editorial headings
   - `IBM Plex Sans` — interface and Chinese/Latin body fallback chain
   - `IBM Plex Mono` — metrics, timecodes, IDs, formulas
5. **Layout strategy**: an asymmetric three-pane research desk: compact left navigation, wide central decision canvas, persistent narrower evidence inspector. Aggregate charts may break into the right gutter; detail pages use a transcript spine rather than a centered card grid.

Target platform: responsive Web. No frontend code should be written before this specification is accepted.

## 1. Workspace shell

### Desktop, 1280px and above

- 216px left navigation.
- Fluid central canvas, minimum 680px.
- 360–440px evidence inspector.
- Inspector stays contextual; it is not another permanent report column when nothing is selected.

### Tablet and mobile

- Navigation collapses below 1024px.
- Evidence inspector becomes a bottom/right drawer.
- Comparison tables change to stacked labeled rows; no horizontal overflow.
- Transcript and frame remain paired.

## 2. Page hierarchy

### Research desk

The first screen prioritizes:

1. universal intake;
2. projects needing input or review;
3. running collection progress;
4. recent decisions and experiments.

Technical Run IDs stay in diagnostics.

### Project page

Above the fold:

- research question;
- active objective;
- sample/evidence boundary;
- one-sentence verdict;
- unknowns that change the decision;
- primary next action.

The page then branches by single/cohort/creator mode.

### Content detail

- Source post and metric snapshots.
- Video player or cover gallery.
- Full transcript spine.
- Each cue shows timecode, raw text, normalization suggestion, representative frame, and all overlapping shots.
- Selecting a cue updates the evidence inspector without losing scroll position.
- Shot-level keep/compress/remove decisions can export a cut list.

### Creator project

- Creator promise and audience map.
- Corpus distribution before selected exemplars.
- Pillar rows with count, median, distribution, stability, high/middle/low samples.
- Visual/script grammar sample wall.
- Reusable capabilities versus identity/resource dependency.
- Ten-post launch plan linked to hypotheses.

## 3. Visualization rules

- Use distributions, medians, percentiles, and sample counts before isolated totals.
- High/middle/low comparisons share the same scale and observation contract.
- Every chart can reveal its calculation and source posts.
- Unknown values use explicit hatching/labels, not zero-height bars.
- Commercial and organic samples are visually separable.

## 4. Interaction rules

- Clicking a finding opens evidence, counterevidence, alternatives, scope, and review controls.
- Clicking an aggregate pillar filters the sample wall.
- “Generate brief” is disabled or labeled blocked when the primary metric cannot be measured.
- Browser collection takeover/login states show a single clear handoff action.
- Long pages use anchored sections and drill-down, not dozens of collapsed generic cards.

## 5. Language rules

- Say “public engagement proxy,” not “traffic,” when reach is unknown.
- Say “machine draft,” not “human normalized,” before human confirmation.
- Say “associated with,” not “caused by,” unless the design supports causality.
- Say “cannot determine” and name the missing field.

## 6. Accessibility and quality gates

- WCAG AA contrast for body text and controls.
- Full keyboard navigation for intake, sample selection, evidence inspection, and review.
- Visible focus states.
- Chart insights have textual equivalents.
- No emoji icons; use one professional icon family.
- Audit prohibited generic palettes/fonts before implementation.
