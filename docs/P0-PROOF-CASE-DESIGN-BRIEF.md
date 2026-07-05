# P0 Proof Case Design Brief

## Purpose

Crab phase one is a Proof Case workbench, not a testing toolbox.

The P0 design should prove one product loop:

Requirement description -> AI draft -> human confirmation -> state transition -> cases and evidence points -> execution and evidence collection -> evidence matrix report -> reusable verification asset.

The first design slice is the Proof Case closed loop plus Workbench. System Context stays as a lightweight placeholder/status surface until the Proof Case loop is clear.

## Primary Users

- Senior QA / test lead: reviews AI output, confirms business flow, judges evidence quality, and decides whether release risk is covered.
- Product or release owner: consumes Proof Report to decide ship/no-ship.
- Developer / automation owner: drills into failed proof steps, scripts, logs, API responses, and artifacts when needed.

## Phase-One Navigation

First-level navigation:

1. Workbench
2. Verification Tasks
3. Asset Library
4. System Context
5. Settings

Evidence Reports are not a phase-one first-level menu. They remain inside Proof Case detail as a stage and generated artifact until report sharing, search, audit, and historical comparison become high-frequency workflows.

AI Chat is not a first-level menu. AI appears through stage actions and a right-side assistant.

## P0 Pages

### 1. Workbench

Goal: give the user the next action and the current risk picture.

First screen uses two queues:

- My To-dos: pending AI drafts, state-transition confirmations, evidence-point confirmations, report approvals.
- Risks and Blockers: insufficient evidence, failed proof, high-risk requirements, release blockers.

Avoid making Workbench a generic metric dashboard. Summary cards are allowed only when they support action or risk.

### 2. New Proof Case

Phase one starts from:

- Requirement description
- Tested system
- Business entry point

The creation page should also surface similar asset recommendations when available. It must not require Feishu, Jira, or ZenTao integration before creation.

### 3. Proof Case Detail

The first screen is next-action-first:

- What is blocked?
- What needs confirmation?
- What should the user do next?

Trust state, evidence completeness, and risk are visible supporting signals, not the primary visual.

Recommended layout:

- Header: title, tested system, current stage, trust state, risk, owner, next action.
- Left rail: Requirement, State Transition, Cases, Automation, Execution, Evidence, Report, Asset Packaging.
- Center pane: current stage work area.
- Right pane: AI assistant, sources, risks, approvals, evidence quality, blockers.
- Bottom pane when relevant: run logs, assertions, extracted variables, network, artifacts.

### 4. AI Requirement Understanding

AI draft confirmation is risk-tiered.

Low-risk minimum confirmation:

- Business object
- Main flow
- Applicable state transition
- Evidence points

High-risk full confirmation:

- Business object
- Roles
- Entry points
- State transitions
- Business rules
- Included scope
- Excluded scope
- Risks
- Evidence points

Phase one keeps risk tiering simple and explicit. Do not build a complex rules engine.

### 5. State Transition Confirmation

State Transition uses graph + table dual views.

- Graph helps users understand the business flow.
- Table is the default working view for confirmation, bulk editing, rules, evidence points, risk, and reviewer status.

State Transition is required only for requirements that involve business state changes. Pure copy, visual, content, or non-stateful configuration changes may skip this stage with a recorded reason.

### 6. Cases And Evidence Points

Cases are subordinate to state transitions.

The working structure is:

Business object -> State transition -> Verification scenario -> Steps -> Evidence points -> Execution result.

The page should support batch confirmation and search/filtering:

- Batch confirmation: AI suggestions, state transitions, evidence points.
- Search/filtering: business object, state transition, risk, evidence gap, execution status.

Defer full shortcut systems, batch rerun, and complex comparison.

### 7. Automation

Automation should show linked API cases, scenarios, UI checks, environment, assertions, extraction, and evidence expectations.

Script details use progressive disclosure:

- Hidden by default.
- Exposed through an explicit entry when generation fails, execution fails, or the user reviews, modifies, reuses, or debugs automation.

The automation surface must keep the binding visible:

- Which state transition does this step prove?
- Which evidence point does this assertion support?

### 8. Execution And Evidence Collection

Execution is evidence-first, not pass-rate-first.

Failed execution should first show:

- Failed proof step
- Affected state transition
- Available evidence
- Likely owner/action
- Report impact

Trace, logs, network, source, screenshots, and raw responses are drill-down evidence.

### 9. Evidence Matrix

Evidence Matrix uses a two-layer structure.

Default layer:

- Rows: state transitions
- Columns: evidence type, trust conclusion, risk

Expanded layer:

- Linked cases
- Steps
- Artifacts
- Assertions
- Raw evidence
- Reviewer decisions

This prevents the product from falling back to a traditional case-result table.

### 10. Proof Report

Proof Report uses a two-layer consumption model.

First screen answers:

- Ship or no-ship?
- Why?
- What risk remains?
- Who confirmed?

QA/developer drill-down exposes:

- Evidence coverage
- Matrix rows
- Steps
- Artifacts
- Logs
- API responses
- Assertions
- Reviewer decisions

### 11. Asset Packaging

Verification Asset Package is reuse-recommendation-first, not passive archive-first.

During new Proof Case creation, similar assets should reduce confirmation, rewriting, and rerunning.

Minimum trust fields:

- Fit scope
- Latest run result
- Maintainer

Do not build a heavy asset marketplace or scoring system in phase one.

## System Context Boundary

System Context is evidence-collection context, not a generic configuration center.

Phase-one scope:

- Tested system
- Environments
- Accounts/permissions
- Page entries
- API sources
- Business glossary
- Read-only database connection entry
- Log source entry
- State-field mapping
- Evidence collection method

Database and log sources start as configurable entries and visible placeholder/status cards if full integration is not ready.

Governance remains in Settings: members, credentials, model providers, audit, Danger Zone.

## AI Interaction Rules

AI entry points use stage actions plus a right-side assistant.

- Stage actions do explicit work: generate, complete, explain, repair, compare, recommend.
- Right-side assistant explains sources, risks, tool calls, history, and follow-up questions.

AI correction uses structured feedback:

- Accept
- Edit
- Reject
- Regenerate
- View sources
- Mark error reason

Error reasons:

- Business misunderstanding
- Wrong scope
- Wrong state identification
- Insufficient evidence point
- Non-executable script
- Data dependency error
- Environment assumption error

Phase one keeps generation history and the last human confirmation record. Do not build complex rollback or error analytics yet.

## Reference Products

- Hoppscotch: API workbench density and request/response interaction.
- Playwright: action timeline, trace, artifacts, failure inspection.
- Allure: report structure, steps, attachments, history, failure detail.
- Dify / Open WebUI: Knowledge, retrieval test, Skills, Chat surfaces.
- Cline: tool approval and AI-agent interaction patterns.
- Supabase: project settings, credentials, security boundaries.

References are for pattern study. Do not copy product structure blindly.

## Explicit Non-Goals For P0

- No first-level Evidence Reports menu.
- No full API platform clone.
- No Playwright Trace Viewer clone.
- No full asset marketplace.
- No complex risk rules engine.
- No complete keyboard shortcut system.
- No batch rerun or complex run comparison.
- No mandatory Feishu/Jira/ZenTao integration for Proof Case creation.
- No deep System Context configuration before the Proof Case loop is clear.

## Success Criteria

P0 design is successful if:

- A user can create a Proof Case from a requirement description.
- AI can produce a draft that is reviewable and correctable.
- Human confirmation gates state transitions, cases, evidence points, and report readiness.
- Evidence Matrix can explain whether each business state transition is proven.
- Proof Report can answer ship/no-ship within the first screen.
- Asset packaging can recommend useful reuse in a later Proof Case.
- Workbench sends users to the next action or risk without acting like a generic dashboard.
