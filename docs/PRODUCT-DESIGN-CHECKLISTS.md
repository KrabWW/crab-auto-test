# Product Design Checklists

Status: Draft baseline, derived from the product-design checklist notes on 2026-07-05.

This document is the execution checklist for Crab / RJ Auto Test product design. It complements:

- `DESIGN.md`: product thesis, information architecture, and module direction.
- `docs/REFERENCE-PRODUCT-PAGE-MAPPING.md`: reference-product page structures.
- `docs/UI-COMPONENT-BASELINE.md`: component baseline and module component matrix.

Crab is a Proof Case workbench. The design standard is not just "good looking"; it is professional, dense, credible, auditable, traceable, and confirmable.

## Priority Rule

For this product, design priority is:

State transition model -> Evidence matrix -> Human confirmation -> AI suggestion -> Asset reuse -> Visual polish.

The core question for every design is: can the product prove that the intended business state change is valid?

## 1. UX Experience Checklist

UX answers: how users understand the product, complete the task, get unstuck, confirm decisions, and receive feedback.

### 1.1 User Role Map

| Role | Primary job | Must confirm | Consumes |
| --- | --- | --- | --- |
| QA lead | Decide whether release risk is covered | Proof Case readiness, evidence gaps, report conclusion | Overview, evidence matrix, report |
| QA engineer | Turn requirements into executable proof | State transitions, evidence points, cases, assertions | Requirement parsing, cases, automation, execution |
| Developer | Fix failed proof steps | Failure owner, logs, traces, API response, state evidence | Execution detail, failed evidence, raw artifacts |
| Product / release owner | Decide whether a requirement can ship | Final report judgement and remaining risk | Proof Report, approval history |
| Admin / project owner | Govern credentials, models, members, MCP and Knowledge | Provider keys, permissions, dangerous operations | Settings, audit logs |

Checks:

- Is it clear who confirms this page's output?
- Is it clear who executes, fixes, consumes the report, and makes the final decision?
- Is the page written for the current user's job, not for the database object?

Required outputs:

- User role map.
- Responsibility boundary for confirmation, execution, report consumption, issue fixing, and final judgement.

### 1.2 Core Task Flow

Canonical Proof Case flow:

```text
Create Proof Case
-> input requirement / PRD
-> AI drafts business flow
-> QA confirms state transitions
-> QA confirms evidence points
-> AI generates cases / scripts / API steps
-> execute verification
-> collect evidence
-> generate evidence matrix
-> human confirms report
-> package reusable verification assets
```

Checks:

- Can a user enter from a requirement and leave with a proof report?
- Does each step have a clear next action?
- Does the UI show whether the current step is AI-suggested, human-confirmed, or system-collected?

Required outputs:

- User task flow diagram.
- Proof Case lifecycle map.
- Stage-by-stage next-action list.

### 1.3 Human-AI Collaboration Boundary

AI should propose. Humans confirm. The system collects evidence.

Every AI-related surface must distinguish:

- AI suggestion.
- Human confirmed.
- System collected.
- Evidence insufficient.
- Human rejected.
- Regenerated.

Checks:

- Does the user know why an AI suggestion exists?
- Does the user know whether a human has accepted it?
- Can the user edit, reject, or regenerate the AI output?
- Is there a recorded reason when AI output is rejected?

Required outputs:

- Human-AI responsibility table.
- AI output review pattern: source, diff, accept/edit/reject, reason, history.

### 1.4 State Transition Experience

Crab proves business state changes, not just test pass rates.

Canonical state transition:

```text
Initial state -> Trigger action -> Target state -> Evidence -> Conclusion
```

Checks:

- Is the expected initial state visible?
- Is the trigger action explicit?
- Is the target state visible?
- Is evidence bound to the state transition?
- Does failure explain which part of the transition failed?
- Does the page distinguish "case passed" from "business state proved"?

Required outputs:

- State transition graph.
- State transition confirmation table.
- Evidence binding relationship table.

Minimum state transition confirmation table fields:

| Field | Purpose |
| --- | --- |
| Business object | What entity is changing |
| Initial state | What must be true before action |
| Trigger action | What action causes change |
| Target state | What must be true after action |
| Business rule | Why this transition is valid |
| Evidence point | What proves it |
| Evidence type | UI, API, DB/state check, log, screenshot, trace |
| Risk | Why failure matters |
| Reviewer | Who confirmed |
| Review status | Draft, needs confirmation, confirmed, rejected |

### 1.5 Feedback And Exceptions

Actions must show meaningful progress, not only a spinner.

Execution progress examples:

- Logging into tested system.
- Opening target page.
- Detecting current state.
- Running trigger action.
- Collecting UI evidence.
- Collecting API evidence.
- Collecting data/state evidence.
- Generating conclusion.

Failure classes:

- Environment failure.
- Account failure.
- Credential failure.
- Script failure.
- Business state did not change.
- Evidence insufficient.
- AI misunderstanding.
- Assertion rule error.
- Permission denied.
- Timeout.

Checks:

- Does the loading state say what is happening?
- Does failure say what happened, why it matters, and what to do next?
- Can the user retry, regenerate, inspect raw evidence, or assign/fix the failure?

Required outputs:

- Progress state taxonomy.
- Error taxonomy.
- Retry / regenerate / inspect / assign interaction rules.

## 2. UI Interface Checklist

UI answers: how pages are organized, where information lives, and what the user sees first.

### 2.1 Page Inventory

Core page types:

- Workbench.
- Verification task list.
- Create Proof Case.
- Proof Case detail.
- AI draft confirmation.
- Business flow / state transition confirmation.
- Cases and evidence point confirmation.
- Automation generation.
- Execution process.
- Evidence matrix report.
- Verification asset package detail.
- System Context configuration.
- Settings.

Phase-one highest-priority pages:

- Proof Case detail.
- Business flow / state transition confirmation.
- Evidence matrix report.
- Execution process.
- Asset package detail.

Required outputs:

- Page inventory.
- Phase-one priority page list.
- Entry source for each page.

### 2.2 Layout Pattern

Core work pages should use a dense three-column workbench:

```text
Top: task name / status / risk / next action
Left: stage navigation or object tree
Center: primary work area
Right: AI suggestion / properties / risk / evidence detail / history
```

Checks:

- Does the top bar answer current status, risk, and next action?
- Does the left side navigate stages or objects, not unrelated modules?
- Does the center area hold the user's main work?
- Does the right panel explain context, risk, evidence, or AI reasoning?

Required outputs:

- Proof Case detail structure.
- Page layout diagram.
- Responsive behavior: right panel becomes drawer, left tree collapses to selector.

### 2.3 Information Hierarchy

Default hierarchy:

1. Conclusion, risk, current stage, next action.
2. Business flow, state transition, evidence completeness.
3. Cases, steps, scripts, logs.
4. Raw request, raw response, raw snapshot, trace details.

Checks:

- What should the user see in the first 3 seconds?
- Which information is decision-critical?
- Which information should be collapsed until investigation?
- Are raw logs and scripts hidden unless useful?

Required outputs:

- Per-page information hierarchy.
- Default/collapsed field list.

### 2.4 Navigation

Phase-one first-level navigation:

- Workbench.
- Verification Tasks.
- Asset Library.
- System Context.
- Settings.

Avoid first-level menus such as separate script management, screenshot management, log management, rule management, and report management unless they become high-frequency jobs.

Checks:

- Does navigation follow the lifecycle rather than tables?
- Are low-frequency governance features under Settings or System Context?
- Is AI Chat a right-side contextual drawer instead of a first-level module?

Required outputs:

- Information architecture tree.
- Navigation decision record.

## 3. Visual Design Checklist

Visual design answers: whether the product looks professional, credible, clear, and orderly.

### 3.1 Product Temperament

Target temperament:

- Professional.
- Restrained.
- Dense.
- Credible.
- Calm.
- Engineering-oriented.
- Auditable.

Avoid:

- Decorative AI gradients.
- Marketing-style hero layouts.
- Oversized SaaS cards.
- Overly blue "tech" styling.
- Low-density consumer-product layouts.

Checks:

- Does the page feel like a serious workbench?
- Are cards only used for overview or repeated summary items?
- Is visual decoration serving evidence or status?

### 3.2 Color

Color should communicate status, not decoration.

Suggested status mapping:

| Meaning | Color direction |
| --- | --- |
| AI suggestion | Blue / purple, restrained |
| Human confirmed | Green |
| Pending confirmation | Orange |
| Evidence insufficient | Yellow / amber |
| Risk / failed | Red |
| System collected | Gray-blue |
| Neutral / inactive | Gray |

Checks:

- Is color reserved for state, risk, confidence, and ownership?
- Is status also represented by icon/text, not color alone?
- Are there too many saturated colors on one screen?

### 3.3 Typography

Recommended font roles:

| Role | Candidates |
| --- | --- |
| Chinese UI | PingFang SC, Source Han Sans, Alibaba PuHuiTi, HarmonyOS Sans, Microsoft YaHei |
| English / numbers | Inter, Roboto, SF Pro, Arial |
| Code / logs | JetBrains Mono, Fira Code, Consolas, Menlo |

Recommended workbench sizes:

- Body: 14.
- Table: 13.
- Code/log: 12 or 13.
- Section title: 18 / 20.

Checks:

- Are Chinese, English, numbers, tables, and logs readable?
- Is code/log content using a monospace font?
- Are headings compact enough for a professional tool?

### 3.4 Spacing

Use a 4/8-based spacing system:

- 4, 8, 12, 16, 24, 32, 40.

Recommended defaults:

- Table cell padding: 8 / 12.
- Card gap: 16.
- Module gap: 24.
- Page padding: 24.

Checks:

- Are similar sections using the same spacing rhythm?
- Is the UI dense but still scannable?
- Are nested cards avoided?

### 3.5 Icons

Icon categories needed:

- Requirement, AI, human confirmation, business flow, state transition.
- Case, script, execution, evidence, report, asset.
- Risk, success, failure, pending, rerun, detail.
- Code, API, database, log, screenshot.

Rules:

- Use one icon family, preferably lucide.
- Keep stroke weight consistent.
- Do not mix 3D, filled, and line icons.

## 4. Component Design Checklist

Component design answers: which repeated UI parts become reusable product assets.

### 4.1 Basic Components

Baseline primitives are defined in `docs/UI-COMPONENT-BASELINE.md`.

Required basic components:

- Button, input, search input.
- Select, multi-select, radio, checkbox, switch.
- Date input / picker.
- Tag, badge, tooltip.
- Dialog, alert dialog, sheet, drawer.
- Table, pagination, tabs, stepper, breadcrumb.
- Empty, loading, error, skeleton.

Checks:

- Is a native or existing shadcn-vue component enough?
- Is a custom component only created when the domain repeats?
- Are destructive actions using Alert Dialog?

### 4.2 Business Components

Crab-specific design assets:

- Proof Case status card.
- AI draft card.
- Human confirmation bar.
- State transition graph.
- State transition table.
- Evidence matrix table.
- Evidence detail sheet.
- Risk badge.
- Execution step timeline.
- Script editor.
- Log viewer.
- API request panel.
- Data snapshot panel.
- Asset package card.
- Report conclusion card.

Checks:

- Does the component encode Proof Case meaning, not just styling?
- Does it expose source, status, owner, and next action when relevant?

### 4.3 Status Components

Proof Case status:

- Draft.
- AI generated.
- Needs human confirmation.
- Confirmed.
- Script generating.
- Ready to execute.
- Running.
- Collecting evidence.
- Evidence insufficient.
- Proof passed.
- Proof failed.
- Report generated.
- Asset packaged.
- Archived.

Evidence status:

- Not collected.
- Collecting.
- Collected.
- Valid.
- Invalid.
- Conflicting.
- Missing.
- Human confirmed.

AI status:

- Generating.
- Suggested.
- Needs confirmation.
- Accepted.
- Edited and accepted.
- Rejected.
- Regenerating.

Checks:

- Do all statuses have consistent text, color, icon, and tooltip?
- Is "proof passed" distinct from "test passed"?
- Is "AI suggested" distinct from "human confirmed"?

## 5. Content Design Checklist

Content design answers: how the product earns trust through precise words.

### 5.1 Voice

Target voice:

- Clear.
- Restrained.
- Auditable.
- Low on adjectives.
- High on facts and conclusions.

Avoid:

```text
AI has intelligently completed comprehensive testing for you!
```

Prefer:

```text
AI generated 4 state-transition suggestions. Human confirmation is required.
```

Avoid:

```text
Test succeeded.
```

Prefer:

```text
State transition proved: Disabled -> Enabled. UI, API, and data evidence were collected.
```

Checks:

- Does copy state facts instead of marketing claims?
- Does it identify source, owner, status, or next action?

### 5.2 Error Message Anatomy

Every important error should answer:

- What happened?
- Why did it fail?
- What is affected?
- What can the user do next?

Example:

```text
Could not prove the state transition.
Reason: the page shows Enabled, but the database field enabled did not change.
Next: check whether the enable API only updated frontend cache, or add a data-layer verification step.
```

Checks:

- Does the error classify the failure?
- Does it name the affected proof step or state transition?
- Does it suggest a next action?

### 5.3 AI Explanation Anatomy

AI explanations should include:

- Source.
- Conclusion.
- Confidence.
- Points needing confirmation.
- Risk points.

Example:

```text
Based on PRD section 3 and the page field enabled, AI inferred the transition Disabled -> Enabled. Confirm whether enabled is the authoritative business state field.
```

Checks:

- Is the AI explanation grounded in a source?
- Does it state what still needs human confirmation?
- Does it avoid sounding final before approval?

## 6. Design System And Handoff Checklist

Design system and handoff answer: how design becomes executable by the team.

### 6.1 Design Specs

Minimum specs:

- Color.
- Typography.
- Type scale.
- Spacing.
- Radius.
- Shadow.
- Icon.
- Table.
- Button.
- Status badge.
- Empty state.
- Error state.
- AI suggestion style.
- Evidence status.
- Risk level.

Checks:

- Is the spec tied to actual product states?
- Can a developer implement without guessing interaction states?

### 6.2 Page Handoff Template

Every page handoff should include:

| Section | Required content |
| --- | --- |
| Page purpose | What job the page serves |
| User role | Who uses it |
| Entry source | Where the user came from |
| Page structure | Top, left, center, right, bottom regions |
| Fields | Field name, meaning, source, required/optional |
| States | Loading, empty, error, success, disabled |
| Interactions | Create, edit, confirm, reject, run, retry, inspect |
| Exceptions | Failure classes and recovery |
| Permissions | Owner/member/admin differences |
| Data needs | API/data requirements |
| Evidence | What evidence is displayed or generated |

Do not hand development only a Figma frame.

### 6.3 Component Handoff Template

Every business component handoff should include:

| Section | Required content |
| --- | --- |
| Component purpose | What repeated product job it solves |
| Inputs | Data fields and constraints |
| Outputs | User actions and emitted decisions |
| States | Status variants and disabled/loading/error states |
| Copy | Required labels, tooltips, error text |
| Accessibility | Keyboard/focus and semantic requirements |
| Reference | shadcn-vue primitive or product reference |

### 6.4 Component Library Seed

First business components to standardize:

- Status badge.
- Risk level.
- Evidence matrix.
- AI suggestion card.
- Human confirmation bar.
- Execution timeline.
- Script editor.
- Report conclusion.
- Asset package card.

## 7. Per-Page Review Checklist

Use this before designing or approving any page.

### A. UX Review

- Which user does this page serve?
- What task is the user trying to complete?
- What should the user do next?
- What must be human-confirmed?
- What is AI-suggested?
- What happens when the task fails?
- Does this reduce QA confirmation cost?

### B. UI Review

- What is the main information on the page?
- What should be visible at first glance?
- What is shown by default?
- What is collapsed?
- Is there a clear next-action button?
- Are table fields too many?
- Are statuses easy to identify?

### C. Visual Review

- Are fonts consistent?
- Is type hierarchy clear?
- Is color used for status rather than decoration?
- Is spacing consistent?
- Are icons from one style?
- Is the page over-decorated?
- Does it feel like a professional tool?

### D. Interaction Review

- Is there feedback after click?
- Does loading explain progress?
- Does failure explain cause?
- Can the user undo where appropriate?
- Can the user regenerate?
- Can the user rerun?
- Can the user inspect raw evidence?
- Can the user see who confirmed the decision?

### E. Evidence Trust Review

- Does the page distinguish AI suggestion and human confirmation?
- Does it distinguish pass rate from state validity?
- Does it show evidence source?
- Does it show evidence gaps?
- Can it trace back to execution records?
- Can it generate or update reusable assets?

## 8. Required Design Deliverables

Recommended order:

1. User role map.
2. Core task flow.
3. Product object model.
4. State transition model.
5. Information architecture.
6. Page inventory.
7. Proof Case detail structure.
8. Evidence matrix structure.
9. Component checklist.
10. Visual spec.
11. Interaction state spec.
12. Figma high-fidelity pages.
13. Development annotations and component specs.

Minimum design package:

- Information architecture.
- Proof Case page structure.
- State transition confirmation table.
- Evidence matrix report.
- Visual spec.
- Core component library.

## 9. Compressed 12-Item Checklist

1. User roles.
2. Core task flow.
3. Human-AI collaboration boundary.
4. State transition model.
5. Information architecture.
6. Page structure.
7. Navigation menu.
8. Component system.
9. Typography and type scale.
10. State colors.
11. Copy and prompts.
12. Design handoff spec.
