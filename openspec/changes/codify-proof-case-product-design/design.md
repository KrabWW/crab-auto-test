## Context

The product-design direction has been clarified through a deep-interview sequence. Crab should read as a Proof Case workbench: a system that helps teams prove whether a requirement's intended business state change is valid, reviewed, executable, and supported by traceable evidence.

The durable design source is `DESIGN.md`. The P0 synthesis brief is `docs/P0-PROOF-CASE-DESIGN-BRIEF.md`. This OpenSpec change captures the binding decisions so future implementation specs do not drift.

Detailed transferable page-structure mapping is recorded in `docs/REFERENCE-PRODUCT-PAGE-MAPPING.md`.

## Decisions

### Decision 1: Product spine is Proof Case

Crab is not a testing toolbox. The core flow is:

Requirement -> State Transition -> Cases -> Automation -> Execution -> Evidence -> Report.

### Decision 2: Default entry is Overview First

Overview is the project-health and next-action cockpit. It should surface Proof Case Queue, Release Risk, Failed Evidence, Pending Approvals, Coverage Gaps, Recent Runs, and Next Actions.

### Decision 3: Workbench first screen is action plus risk

Workbench first screen should use action + risk dual queues: My To-dos for pending AI drafts, state-transition confirmations, evidence-point confirmations, and report approvals; Risks and Blockers for insufficient evidence, failed proof, high-risk requirements, and release blockers.

### Decision 4: Phase-one navigation keeps reports inside Proof Case

Phase-one first-level navigation is Workbench, Verification Tasks, Asset Library, System Context, and Settings. Evidence Reports are Proof Case detail stages and generated artifacts, not a first-level menu, until report sharing, search, audit, and history comparison become high-frequency workflows.

### Decision 5: Proof Case creation starts from requirement description

Phase-one Proof Case creation should start from requirement description, tested system, and business entry point. Similar asset recommendations may be shown, but external requirement-system integration is not required for creation.

### Decision 6: P0 design slice is Proof Case closed loop plus Workbench

P0 design should cover the Proof Case closed loop and Workbench. System Context remains a lightweight placeholder/status surface until the Proof Case loop is clear.

### Decision 7: API automation uses Hoppscotch as the code reference

Hoppscotch is the retained open-source code reference for API automation. Apifox remains a product-interaction reference for dense API workbench patterns. Bruno is not part of the retained code reference baseline.

### Decision 8: Asset Library is reuse-recommendation-first

Asset Library should recommend similar verification assets during Proof Case creation. Phase one should show fit scope, latest run result, and maintainer, without building a complex asset marketplace or scoring system.

### Decision 9: System Context is evidence-collection context

System Context should include tested system, environments, accounts/permissions, page entries, API sources, business glossary, read-only database connection entry, log source entry, state-field mapping, and evidence collection method. Database and log sources start as configurable entries and visible status cards if full integration is not ready. Project governance remains in Settings.

### Decision 10: Execution is evidence-first

Execution & Reports should prioritize failed proof step, business impact, available artifacts, and next action. Trace/log/network/source details are drill-down evidence, not the first mental model.

### Decision 11: Knowledge is Source Trust Center

Knowledge should prove why AI output is trustworthy: source status, indexing state, retrieval test, citation preview, and AI usage trail.

### Decision 12: MCP is Server Governance Center

MCP should expose server cards, tools/resources/prompts inventory, permissions, trust state, and invocation logs.

### Decision 13: Skills are governed assets; Chat is an invocation surface

Skills should have versions, owners, permissions, context bindings, source/tool dependencies, invocation history, and rollback targets. AI Chat should be a global contextual drawer, not a first-level product area.

AI entry points should combine stage actions and the right-side assistant. Stage actions perform explicit work; the assistant explains sources, risks, tool calls, history, and follow-up questions.

AI correction should be structured: accept/edit/reject/regenerate/view sources plus an error reason. Phase one keeps generation history and the last human confirmation record without complex rollback.

### Decision 14: Settings is Project Governance Settings

Settings should be General, Members, Model Providers, Credentials, Audit, and Danger Zone. AI infrastructure belongs here, but should not dominate the page.

### Decision 15: State Transition is required only when state changes

State Transition is required for requirements that involve business state changes. Pure copy, visual, content, or non-stateful configuration changes may skip it with a recorded reason.

### Decision 16: Release gate is lightweight tiered evidence

High-risk state changes should prefer stronger evidence plus reviewer decision. Lower-risk changes may use lighter evidence. Phase 1 keeps a final human pass/fail decision. CI pipeline integration is a future consumer, not a current complexity driver.

### Decision 17: Script details use progressive disclosure

Script details should be hidden by default in the Proof Case workflow. Users should enter them only through explicit actions for generation failure, execution failure, review, modification, reuse, or debugging.

### Decision 18: Expert QA efficiency is batch review plus filtering

Phase one should support batch confirmation for AI suggestions, state transitions, and evidence points, plus search/filtering by business object, state transition, risk, evidence gap, and execution status. Full shortcuts, batch rerun, and complex comparison are deferred.

## Reference Baseline

Local open-source references live outside the current worktree under:

`D:\code\auto-test\crab-auto-test\.claude\reference-products\oss`

Current retained baseline:

- `hoppscotch`: API automation workbench and request/response UX.
- `playwright`: UI mode, trace viewer, action timeline, artifacts.
- `allure2`: test report, steps, attachments, history, failure detail.
- `open-webui`: Skills, Knowledge, Chat, workspace AI surfaces.
- `dify`: Knowledge, retrieval test, plugins, workflow concepts.
- `mcp-servers`: MCP reference server patterns.
- `cline`: MCP/tool approval and AI-agent interaction patterns.
- `supabase`: project settings, API keys, credentials, security boundaries.

The product-to-Crab page mapping by Hoppscotch / Playwright / Allure / Dify / Open WebUI / Cline / Supabase is maintained in `docs/REFERENCE-PRODUCT-PAGE-MAPPING.md`.

## Boundaries

- Reference products are for pattern study, not code copying into Crab.
- Open-source code references may be inspected for architecture and interaction implementation ideas, subject to license review before reuse.
- Non-open-source products remain product-behavior references only.
