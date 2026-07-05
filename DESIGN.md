# Design

## Source of truth
- Status: Draft
- Last refreshed: 2026-07-05
- Primary product surfaces: RJ Auto Test / Crab project workspace, Proof Case workbench, requirements, cases, automation, execution reports, knowledge, MCP, skills, settings.
- P0 design brief: `docs/P0-PROOF-CASE-DESIGN-BRIEF.md`.
- Reference product page mapping: `docs/REFERENCE-PRODUCT-PAGE-MAPPING.md`.
- Evidence reviewed:
  - User product notes and reference-product matrix from Codex attachments.
  - Current workspace navigation in `apps/web/components/project/ProjectWorkspaceNav.vue`.
  - Current overview route language in `apps/web/components/project/ProjectOverview.vue`.
  - Phase planning docs: `PHASE2-PLAN.md`, `docs/crab-implementation-roadmap.md`, OpenSpec design notes.
  - Reference docs: GitHub Settings, Vercel Environment Variables, Supabase API Keys, Dify Knowledge, Open WebUI Knowledge/Skills, MCP official docs, VS Code MCP, Postman Runner, Apifox scenarios/assertions/extraction, Hoppscotch, Playwright UI Mode/Trace Viewer, Cypress Open Mode, Checkly Browser Checks.

## Product thesis
Crab should not be positioned as a testing toolbox. Phase 1 should be positioned as a Proof Case workbench: a system that helps a team prove that a requirement's intended business state change is valid, reviewed, executable, and backed by traceable evidence.

The product job is not "generate test cases". The real job is: help a release owner, QA, or developer decide faster and with more confidence whether this requirement can ship.

The primary proof chain is:

Requirement -> AI understanding -> human confirmation -> state transition -> test cases -> automation steps -> execution -> evidence -> report -> release decision.

## Product goals
- Goals:
  - Make every test artifact traceable back to a requirement and business state transition.
  - Make AI output reviewable through sources, diffs, approval, retry, and rejection reasons.
  - Make execution reports evidence-first, not pass-rate-first.
  - Reuse reference-product strengths as local interaction patterns without cloning their full product scope.
- Non-goals:
  - Do not make 11 or 12 flat first-level product entries.
  - Do not make a Postman, Apifox, Playwright Trace Viewer, Dify, or Open WebUI clone.
  - Do not make AI Chat the primary product surface.
  - Do not make RAG, MCP, or Skills visible as mysterious black boxes.
  - Do not optimize this design around implementation effort; implementation planning is intentionally separate.
- Success signals:
  - A report can answer: which requirement, which state transition, which case, which execution, which logs/screenshots/API responses, and which human approval produced this conclusion.
  - A user can enter from a requirement and leave with a proof report without thinking in terms of internal modules.
  - AI suggestions always show why they should be trusted or rejected.

## Reference product design principles
Core rule: Crab may feel like the reference product at the operation layer, but it must behave like a Proof Case evidence system at the product layer.

- Hoppscotch -> API workbench: borrow the dense API operation shell; convert request/result into Proof Step, assertion, extraction, and evidence binding.
- Playwright -> execution evidence detail: borrow timeline, failed-step selection, screenshot/trace/log/network/source inspection; make the first question "where did the proof chain break?"
- Allure -> proof report: borrow overview plus drill-down, timeline, history, categories, and attachment preview; replace pass-rate-first reporting with ship/no-ship proof judgement.
- Dify -> Knowledge source trust: borrow sources, documents, indexing status, retrieval test, citation preview, and usage trail; keep RAG inspectable.
- Open WebUI -> Skills and AI asset separation: borrow Knowledge / Skills / Tools / Models separation; keep Chat as a contextual drawer, not a first-level product center.
- Cline -> MCP permission and tool-call transparency: borrow server cards, tools/resources/prompts inventory, approval, auto-approve boundaries, and invocation logs; never hide AI tool calls.
- Supabase -> project governance settings: borrow grouped project settings, secrets/API-key boundaries, audit trail, and danger-zone isolation; do not copy the full developer-platform surface.

## Personas and jobs
- Primary personas:
  - QA lead: needs to know whether a release risk is covered.
  - QA engineer: needs to turn requirements into reviewable cases and executable checks.
  - Developer: needs failure evidence that points to root cause quickly.
  - Product/release owner: needs a proof report to decide whether to ship.
- User jobs:
  - Understand what a requirement changes.
  - Confirm the expected business state transition.
  - Generate and review test coverage.
  - Execute API/UI checks.
  - Inspect failures through evidence.
  - Produce a report that supports a go/no-go decision.
- Key contexts of use:
  - Before release approval.
  - During failed execution triage.
  - During requirement review and test-case generation.
  - During regression suite construction.

## Information architecture
Primary navigation should follow the product lifecycle, not database tables or technical subsystems.

Confirmed phase-one first-level navigation:

1. Workbench
2. Verification Tasks
3. Asset Library
4. System Context
5. Settings

Requirements, Cases, Automation, Execution, Evidence, and Report are Proof Case detail stages, not separate first-level routes in phase one. Evidence Reports stay inside Proof Case detail as a stage and generated artifact until report sharing, search, audit, and historical comparison become high-frequency workflows.

AI Chat should be a global contextual drawer, not a first-level route. It should inherit the current page context: selected requirement, case, scenario, execution, report, knowledge source, or MCP call.

Confirmed entry decision:
- The primary user entry should be Overview First.
- Overview is the project health and next-action cockpit for Proof Cases, not a generic metrics dashboard.
- Workbench first screen uses action + risk dual queues: My To-dos for pending AI drafts, state-transition confirmations, evidence-point confirmations, and report approvals; Risks and Blockers for insufficient evidence, failed proof, high-risk requirements, and release blockers.
- Requirements, Executions, and Reports can all deep-link into Proof Cases, but the default daily entry is the Overview queue of risk, failure, approval, and next proof step.

Current observed issue: the existing project navigation exposes Requirements, AI Generation, Test Cases, Test Suites, API Automation, Executions, UI Assets, AI Chat, Knowledge, MCP Admin, Skills, and Settings as mostly flat entries. That shape makes the product read as a tool collection. The desired IA should compress low-frequency governance and AI infrastructure into System Context and Settings, while keeping high-frequency lifecycle work inside Verification Tasks and the Proof Case detail stages.

## Reference product migration matrix

### Settings
Reference products:
- GitHub Settings groups repository access, collaboration, feature toggles, policies, and repository-level controls.
- Vercel Environment Variables separates team-level and project-level configuration and treats env vars as governed deployment configuration.
- Supabase API Keys distinguishes publishable keys from secret keys and makes exposure boundaries explicit.

Transferable pattern:
- Settings should be grouped by governance object, not exposed as a single flat form.
- Secrets and provider credentials need visible scope and safety language.
- Dangerous operations should be visually and structurally isolated.

Crab design:
- Project Settings should contain General, Members, Model Providers, Credentials, Audit, and Danger Zone.
- Keep project-level owner/member semantics in product language unless a later design explicitly changes the roles model.
- Do not start with enterprise RBAC as the visible mental model.

### Knowledge
Reference products:
- Dify Knowledge treats private documents as domain-specific context and includes retrieval testing.
- Open WebUI Knowledge stores files and collections that AI can search, cite, and scope to models or chats.

Transferable pattern:
- Knowledge is not just uploaded files. It is a source-of-truth surface for AI answers.
- Retrieval test, document status, source attribution, and citation preview are core trust features.

Crab design:
- Knowledge should have Sources, Documents, Retrieval Test, Citations, and Usage.
- Sources should be attachable to a requirement or Proof Case.
- AI-generated requirement understanding, case suggestions, and failure analysis should show which knowledge source supported the output.
- Avoid exposing low-level embedding/chunking parameters as the main UI. Put them behind advanced settings only when needed.

### MCP
Reference products:
- MCP official docs frame MCP as a standard connection from AI apps to external data, tools, and workflows.
- VS Code MCP exposes servers, tools, resources, prompts, enable/disable controls, and trust boundaries.

Transferable pattern:
- MCP should be discoverable and governable: server status, tool list, resource/prompt visibility, permission controls, and invocation logs.
- Tool calls are product events, not hidden implementation details.

Crab design:
- MCP should use Server Cards -> Tool List -> Permission -> Invocation Logs.
- Each invocation should show: tool, server, caller, page/context, input summary, redacted output summary, status, duration, and linked Proof Case or execution.
- Do not make users edit raw JSON as the primary flow.
- Do not enable every MCP tool globally by default.

### Skills and AI Chat
Reference products:
- Open WebUI Skills are reusable markdown instruction assets that can be attached to models or invoked in chat.
- Dify Plugins separate extension types such as models, tools, agent strategies, datasources, and triggers.
- Langflow shows that flows/tools can become reusable AI capabilities, but the visual flow builder is not the first thing Crab needs to copy.

Transferable pattern:
- Skill is a governed capability asset.
- Chat is an invocation surface.
- Tool calls, sources, retries, and generated artifacts should remain visible.

Crab design:
- Put Skills under Context & Configuration or AI Platform.
- AI Chat should be a global right-side assistant that can act on the current page context.
- Chat must show references, tool calls, generated artifacts, retry options, and history.
- Do not mix Skills, MCP, Knowledge, and Chat into one vague AI menu.

### API automation
Reference products:
- Postman Collection Runner centers collection/folder execution, environment selection, run configuration, results, console logs, run history, errors, and AI-assisted debugging.
- Apifox scenario cases support ordered requests, control flow, dynamic parameters, data transfer between steps, reports, assertions, and variable extraction.
- Hoppscotch emphasizes lightweight API client workflows, collections, environments, importer, and CLI automation.

Transferable pattern:
- The strongest UI shell is: left collection tree, center request/step editor, right response/assertion/evidence panel, bottom run result console.
- Assertions and extracted variables are first-class, visible objects.
- A scenario is a business flow, not just a list of URLs.

Crab design:
- API Automation is the best design master for the main dense workbench.
- API Case and API Scenario should attach to Proof Case state transitions and evidence points.
- Request, assertion, extraction, and response snapshot should become proof evidence.
- Do not copy the full Postman/Apifox product surface early: no need to lead with protocol zoo, public docs, mock portals, or complex marketplace features.

### UI automation testing
Reference products:
- Playwright UI Mode exposes test tree, status filters, action timeline, DOM snapshots, logs, console, network, source location, and attachments.
- Playwright Trace Viewer is optimized for post-run trace inspection.
- Cypress Open Mode uses a command log, time-travel snapshots, console output, spec list, and recent run context.
- Checkly Browser Checks packages browser execution results with test steps, errors, traces, videos, screenshots, logs, network, and page timing.

Transferable pattern:
- UI automation value is failure localization plus evidence packaging.
- The product should show enough trace to make a decision, not recreate a full developer IDE.

Crab design:
- Execution Detail should be the main UI automation surface.
- Layout: left step list, center screenshot/video/trace preview, right failure explanation and linked evidence, bottom logs/network/artifacts.
- Trace/log/video/screenshot should be evidence artifacts linked back to a Proof Case.
- Do not rebuild the full Playwright Trace Viewer.

## Core object model
The product should treat these as first-class conceptual objects in design language:

- Requirement: what business change is requested.
- Proof Case: the reviewable proof package for one requirement or release risk.
- State Transition: the expected business state change.
- Test Case: a human-reviewable verification unit.
- Suite: a grouped execution set.
- API Case: one request-level executable check.
- Scenario: ordered multi-step business/API flow.
- Execution: a concrete run.
- Evidence: screenshot, trace, log, API response, DB/state observation, citation, assertion result, or human approval.
- Report: decision artifact that summarizes whether the Proof Case passed.
- Knowledge Source: context used by AI or reviewers.
- Skill: reusable AI capability/instruction asset.
- MCP Tool: external tool capability with permission and audit trail.

## Design principles
- Lifecycle over module list: navigation follows requirement -> proof -> execution -> report.
- Evidence over pass rate: pass/fail is a summary, not the proof.
- AI must be inspectable: source, diff, approval, retry, rejection reason, and rollback are part of the design.
- Dense workbench over card SaaS: cards are for overview and repeated summary items, not the main workflow.
- Configuration is lower frequency: Knowledge, Skills, MCP, Model Providers, members, audit, and settings should not compete with daily test work.
- Progressive disclosure: show the next decision first; reveal trace/log/assertion detail when the user investigates.
- Do not clone reference products: copy proven interaction patterns only where they serve Proof Case.

## Visual language
- Color: restrained enterprise palette with strong status colors for proof, risk, pass/fail, warning, and blocked states. Avoid one-note purple/blue SaaS gradients.
- Typography: compact workbench typography; large hero type is not appropriate inside the product workspace.
- Spacing/layout rhythm: dense but readable; prioritize scanning, comparison, and repeated operational work.
- Shape/radius/elevation: modest radius, low elevation, avoid nested cards.
- Motion: minimal; use motion only for run progress, streaming AI state, and status transitions.
- Imagery/iconography: product UI should rely on clear icons, status marks, screenshots, traces, and evidence previews rather than decorative illustration.

## Components
- Confirmed component baseline: `docs/UI-COMPONENT-BASELINE.md`.
- Primary implementation foundation should remain shadcn-vue plus Tailwind, backed by existing Vue/Radix/lucide primitives.
- Do not introduce a second full UI system for normal product surfaces.
- Existing components to reuse:
  - Project workspace navigation.
  - Overview metric cards.
  - Requirements list/detail patterns.
  - API automation case/editor/result patterns.
  - Execution detail/report patterns.
- New or redesigned conceptual surfaces:
  - Proof Case overview/detail.
  - State transition confirmation panel.
  - Evidence matrix.
  - Global AI assistant drawer.
  - Context & Configuration group.
  - MCP server/tool governance panel.
  - Retrieval test and citation preview panel.
- Variants and states:
  - AI draft, edited, approved, rejected, regenerated, failed.
  - Execution queued, running, passed, failed, blocked, aborted, timeout.
  - Evidence missing, collected, weak, disputed, accepted.
  - Source indexed, indexing, failed, stale.

## Accessibility
- Target standard: production UI should aim for WCAG 2.1 AA.
- Keyboard/focus behavior: dense workbench panes, tabs, drawers, trees, and command/search surfaces must be keyboard navigable.
- Contrast/readability: status color must never be the only signal.
- Screen-reader semantics: navigation, step lists, execution status, and report sections need semantic labels.
- Reduced motion: run progress and AI streaming should remain understandable without animation.

## Responsive behavior
- Supported breakpoints/devices:
  - Desktop-first for daily workbench use.
  - Tablet should preserve review/report reading.
  - Mobile may be read/review-first, not full authoring-first.
- Layout adaptations:
  - Desktop: left tree, center work area, right context/evidence panel.
  - Narrow screens: right panel becomes drawer; left tree collapses to selector.
- Touch/hover differences:
  - All hover-only affordances need visible alternatives.

## Interaction states
- Loading: show which layer is loading: sources, AI generation, execution, artifacts, or report.
- Empty: provide next action tied to lifecycle, not generic empty-state marketing.
- Error: classify as source error, AI error, execution error, assertion failure, network error, permission error, or configuration error.
- Success: show what evidence was produced and what decision is now possible.
- Disabled: explain missing prerequisite, such as no approved requirement, no environment, no credential, or no selected scenario.
- Slow network/long run: keep partial progress visible through steps, logs, and snapshots.

## Content voice
- Tone: precise, work-focused, evidence-oriented.
- Terminology:
  - Prefer Proof Case, Evidence, State Transition, Source, Approval, Execution, Report.
  - Avoid presenting AI as magic. Use terms like suggestion, draft, source, confidence, failed reason, retry.
- Microcopy rules:
  - Buttons should be concrete actions: Generate Draft, Approve Case, Run Scenario, View Evidence, Retry Step.
  - Reports should answer decision questions, not describe product features.

## Product-level page direction

### Overview
Purpose: project health and next actions.

Should show project health, recent executions, pending approvals, coverage, failure trend, and blocked Proof Cases.

### Requirements
Purpose: understand and approve what needs proof.

Should include documents, versions, AI parsing, module split, review findings, approved requirement versions, and trace to Proof Cases.

### Cases
Purpose: turn requirement understanding into human-approved verification assets.

Should include modules, test cases, suites, AI generation/optimization as actions, and coverage against state transitions.

### Automation
Purpose: build executable proof steps.

Should include API Cases, API Scenarios, environments, assertions, extraction, and later UI automation assets. The primary layout should follow the API workbench pattern.

### Execution & Reports
Purpose: run checks, inspect failures, and produce proof.

Should include executions, suite runs, report summaries, screenshots, logs, trace, network, failure analysis, quality gate, and evidence matrix.

### Context & Configuration
Purpose: govern the assets and capabilities that support proof.

Should include Knowledge, Skills, MCP, Model Providers, Credentials, Members, Audit, and Settings.

## Current module transformation blueprint
Status: Draft for alignment.

This section describes how the current flat project modules should change in product design language. It is intentionally not an engineering task list.

### Overview
Current role: general project dashboard.

Target role: proof-readiness cockpit.

Specific design change:
- Show project health through Proof Case readiness, not only raw object counts.
- Show recent executions, failed proof points, pending approvals, weak evidence, and release blockers.
- Make the primary action "continue the next proof step", not "go create another artifact".
- Cards are acceptable here because Overview is a summary surface.
- First screen sections should be: Proof Case Queue, Release Risk, Failed Evidence, Pending Approvals, Coverage Gaps, Recent Runs, and Next Actions.
- Each item should deep-link into the exact Proof Case stage that needs work.

### Requirements
Current role: requirement CRUD and review.

Target role: proof input and state-change discovery.

Specific design change:
- Keep documents, versions, AI parsing, review findings, and approval.
- Add a state-transition proposal area: current state, trigger, expected next state, business rule, risk.
- Let AI suggest state transitions from requirements, but require human confirmation.
- The output of this module should be a Proof Case seed, not just an approved requirement.

### AI Generation
Current role: first-level route.

Target role: contextual action inside Requirements and Cases.

Specific design change:
- Remove it as a long-term first-level navigation item.
- Replace with actions such as Generate State Transitions, Generate Case Drafts, Improve Coverage, Explain Gaps.
- Every AI result must show source, diff from previous version, accept/edit/reject/regenerate, and failure reason.
- AI Generation should never feel like a separate product area; it is how work is accelerated inside a stage.

### Test Cases
Current role: list/manage test cases.

Target role: coverage workbench.

Specific design change:
- Left: modules, requirement slices, or state transitions.
- Center: dense case table/editor with priority, status, origin, linked requirement, linked proof point.
- Right: coverage gaps, AI suggestions, approval state, evidence expectations.
- A case should answer "which state transition or business rule does this prove".

### Test Suites
Current role: separate module for batch execution.

Target role: proof plan or execution grouping.

Specific design change:
- Do not keep it as a dominant first-level mental model.
- In Cases, Suite means reusable coverage grouping.
- In Execution & Reports, Suite means run plan and roll-up result.
- The suite view should emphasize order, scope, risk coverage, and report roll-up rather than generic batch management.

### API Automation
Current role: API case/scenario area.

Target role: main automation workbench.

Specific design change:
- Use the strongest reference pattern: left collection/scenario tree, center request or step editor, right response/assertion/evidence panel, bottom run results.
- Treat assertions and extracted variables as visible first-class proof components.
- Tie each API case or scenario step to a state transition, business rule, or evidence point.
- Keep Apifox/Postman-like density, but avoid becoming a full API platform with every protocol and documentation feature.

### Executions
Current role: execution queue and report detail.

Target role: evidence and failure-triage center.

Specific design change:
- The execution list should prioritize risk, status, last failure, linked Proof Case, and next action.
- The detail page should show step list, artifact preview, logs, trace, network/API response, assertion results, and failure explanation.
- Pass/fail is only the headline. The real surface is evidence quality and decision readiness.

### UI Assets
Current role: separate UI automation/assets route.

Target role: automation evidence asset layer.

Specific design change:
- Do not make UI Assets a major first-level module.
- Place UI selectors, pages, screenshots, trace, and video assets under Automation or Execution Detail.
- Treat screenshots/traces/videos as evidence artifacts, not just files.
- Avoid exposing Playwright IDE complexity in the product UI.

### Asset Library
Current role: phase-one first-level area for reusable verification assets.

Target role: reuse recommendation source for new Proof Cases, not a passive archive.

Specific design change:
- When a user creates a new Proof Case, surface similar assets that can reduce confirmation, rewriting, and rerunning.
- Verification Asset Package should include reusable business object, state transitions, cases, automation steps, evidence templates, data templates, and report shape.
- Phase one should show fit scope, latest run result, and maintainer so users can judge whether an asset is still trustworthy.
- Do not make a full asset marketplace or complex scoring system before reuse behavior is proven.

### System Context
Current role: phase-one first-level area for Agent understanding and evidence collection context.

Target role: evidence-collection context, not a generic configuration center.

Specific design change:
- Phase one includes tested system, environments, accounts/permissions, page entries, API sources, business glossary, read-only database connection entry, log source entry, state-field mapping, and evidence collection method.
- Database and log sources should start as configurable entries and visible placeholder/status cards; do not force full integration before the Proof Case workflow proves the need.
- System Context should explain how each item helps AI understand requirements, execute checks, or collect evidence.
- Project governance, members, credentials, model providers, audit, and danger actions remain in Settings.

### AI Chat
Current role: first-level chat route.

Target role: global contextual assistant drawer.

Specific design change:
- Remove it as a primary navigation item.
- Open from any page with current context attached: requirement, case, automation step, execution, report, knowledge source, or MCP call.
- AI entry points use stage actions plus a right-side assistant. Stage actions handle explicit tasks such as generate, complete, explain, repair, compare, and recommend; the assistant explains sources, risks, tool calls, history, and follow-up questions.
- Show citations, tool calls, generated artifacts, retry history, and accepted/rejected outputs.
- AI correction uses structured feedback: every AI output should support accept, edit, reject, regenerate, and view sources; rejected or edited outputs should capture an error reason such as business misunderstanding, wrong scope, wrong state identification, insufficient evidence point, non-executable script, data dependency error, or environment assumption error.
- Phase one keeps generation history and the last human confirmation record, without building complex rollback or error analytics.
- Chat should support the workbench, not replace the workbench.

### Knowledge
Current role: standalone RAG/knowledge route.

Target role: source-of-truth and citation management.

Specific design change:
- Keep a management area under Context & Configuration: Sources, Documents, Retrieval Test, Citations, Usage.
- Also show inline citation panels where AI uses knowledge.
- Add document status, indexing progress, retrieval diagnostics, source preview, and selected citation.
- The key user question is "why did AI say this", not "what embedding setting is active".

### MCP Admin
Current role: standalone MCP administration route.

Target role: governed tool capability layer.

Specific design change:
- Move under Context & Configuration.
- Use Server Cards -> Tools/Resources/Prompts -> Permission -> Invocation Logs.
- Show every tool call as an auditable event linked to page context or Proof Case.
- Do not default-enable tools globally; do not expose raw JSON as the primary authoring UI.

### Skills
Current role: standalone skills management route.

Target role: reusable AI capability asset library.

Specific design change:
- Move under Context & Configuration or AI Platform grouping.
- Show skill purpose, version, permissions, compatible contexts, usage history, and rollback.
- Skills should be activated by context or AI action, not confused with chat conversations.
- Treat Skills as reviewable assets, similar to playbooks or SOPs.

### Settings
Current role: standalone settings route.

Target role: project governance.

Specific design change:
- Keep under Context & Configuration.
- Organize as General, Members, Model Providers, Credentials, Audit, Danger Zone.
- Settings should be low-frequency and governed; it should not compete with daily Proof Case work.
- Credentials and model providers should clearly show scope, safety, and usage.

## Reference page-structure extraction
Status: Draft for alignment.

This section captures concrete page structures and interaction patterns from reference products, then maps them into Crab modules.

For each reference product, analysis must stay at page and interaction level:
- Page anatomy: primary navigation, left tree/list, center work area, right inspector/result panel, bottom console/history, and top action bar.
- Core objects: what the product treats as first-class objects, how they are grouped, and what status each object exposes.
- Main user path: where the user starts, what they edit, what they run, what feedback appears, and how they save/reuse the result.
- Feedback model: validation, assertion, logs, generated report, failure reason, history, and artifact preview.
- Crab transfer: which interaction pattern becomes part of Crab's proof workflow, which field or panel must be renamed around Requirement / Proof Case / State Transition / Evidence.
- Do-not-copy boundary: which features belong to the reference product's original market but would distract Crab from proof work.

### Apifox -> Crab API Automation

What Apifox does well:
- It treats API as a primary object grouped in directories.
- It separates API definition, request running, saved interface cases, automated scenarios, variables, assertions, extraction, and reports.
- It lets users move from one request to reusable cases, then from cases to ordered scenarios.
- It keeps environment selection close to execution.
- It makes assertion and variable extraction visual instead of script-only.
- It shows actual request, response, validation, assertion result, and run report as inspectable outputs.

Crab API module should borrow the workbench shape, not the whole API platform.

Confirmed decision:
- The primary API Automation experience should be Apifox-style API Workbench.
- This means Crab should lead with a dense operational workbench: left tree, center editor, right result/evidence inspector, bottom run console.
- The adaptation is not "build an API platform". The adaptation is "use Apifox's API working pattern to prove business state transitions".

#### Page shell
Recommended layout:
- Left pane: API tree / scenario tree / folders / tags / search.
- Top bar: selected environment, run button, save, history, linked Proof Case, linked state transition.
- Center pane: request or scenario-step editor.
- Right pane: response, assertion, extraction, evidence mapping, AI suggestion.
- Bottom pane: run console, actual request, logs, assertion results, extracted variables, history.

#### Left pane
Apifox pattern:
- API objects are grouped by directories.
- Scenarios can be organized by directory, priority, and tags.
- Steps can import from APIs or interface cases.

Crab mapping:
- Use a tree with three switchable modes: API Cases, Scenarios, Proof Links.
- API Cases view groups requests by service/module.
- Scenarios view groups business flows.
- Proof Links view groups API checks by requirement/state transition.
- Each node should show status: draft, ready, failing, passing, stale, missing evidence.

Do not copy:
- Do not make public API documentation the center of the module.
- Do not add every API design feature before proof workflows are clear.

#### Request editor
Apifox pattern:
- Document mode can run requests based on API definition.
- Debug mode can directly create requests like Postman.
- Request input and actual response are visually separated.
- Divergence from API definition is highlighted and can be restored or saved back.

Crab mapping:
- Provide two modes:
  - Bound Case: request is tied to a proof step and expected evidence.
  - Quick Request: temporary exploration that can be saved as an API Case.
- Show method, URL, headers, query, body, auth, pre-actions, post-actions.
- Show when a request has drifted from its saved case or linked API definition.
- Add Save as Case, Save as Scenario Step, Attach to Proof Case.

Do not copy:
- Do not make API schema design/editing the main job of Crab.
- Do not force users to fully define API documentation before they can create a proof request.

#### Environment and variables
Apifox pattern:
- Environment is selected at the top-right.
- Environment combines service base URLs and variables.
- Variables can be global, environment, module, request/session/runtime.
- Variables can be used in URL, headers, body, scripts, and automated scenarios.

Crab mapping:
- Top bar environment selector is mandatory.
- Environment should include service URLs, credentials references, variables, and active secrets status.
- Variables should be visible in a side panel: name, scope, source, last value preview if safe, used by steps.
- Use variable chips inline in URL/body/headers.
- Show unresolved variables before run.

Do not copy:
- Do not expose too many variable scopes at first if it confuses proof users.
- Do not show secret values by default.

#### Assertions
Apifox pattern:
- Assertions are added visually as post-actions.
- Users choose response object, target path, operator, expected value.
- Results appear after sending the request.

Crab mapping:
- Assertions should be first-class rows, not hidden scripts.
- Fields: target, source, path, operator, expected, severity, proof meaning.
- Each assertion should map to an evidence claim: for example, "order status becomes paid".
- Assertion result should become Evidence with pass/fail, actual value, expected value, response snapshot.

Do not copy:
- Do not lead with arbitrary scripting.
- Do not hide assertion failures inside raw logs.

#### Variable extraction
Apifox pattern:
- Response values can be extracted visually into variables.
- Later steps can read previous-step output directly or use extracted variables.
- This supports login-token, id, list-item, and chained workflow scenarios.

Crab mapping:
- Extraction rows should sit beside assertions.
- Fields: variable name, response source, JSONPath/XPath/regex, scope, sample value, consumers.
- Scenario editor should visually show data flow from one step to another.
- Direct previous-step reference is useful for one-off links; named variables are better for reused values.

Do not copy:
- Do not make users manually reason through hidden variable precedence.
- Do not bury data flow in code.

#### Scenario editor
Apifox pattern:
- Scenario case is the core automated testing unit.
- It supports ordered requests, importing API/interface cases, custom requests, cURL import, conditions, data passing, reports, and CLI.

Crab mapping:
- Scenario should represent a business proof flow.
- Step types: API Case, Quick Request, Condition, Wait, Extract, Assert, Attach Evidence.
- Left or center should show ordered step list.
- Selecting a step opens its request/assertion/extraction editor.
- Scenario header should show linked requirement, state transition, risk, owner, last result.

Do not copy:
- Do not make full flow-control power the first visible experience.
- Do not let scenario become generic workflow automation detached from proof.

#### Run result and report
Apifox pattern:
- Run output includes actual request, response, validation, assertion result, console logs, errors, and run history.
- Reports are generated from scenario runs.

Crab mapping:
- Every run should produce an Evidence Set.
- Result tabs: Summary, Actual Request, Response, Assertions, Extracted Variables, Logs, History, Evidence.
- Summary should answer: did this API step prove the expected state transition?
- Report should link back to requirement, proof case, scenario, steps, assertions, response snapshots, and human approvals.

Do not copy:
- Do not let response viewing become the end goal.
- Do not report only HTTP status and duration.

#### AI inside API Automation
Apifox pattern to adapt:
- AI can help debug failures or suggest assertions in API tools.

Crab mapping:
- AI actions should be local and reviewable:
  - Suggest assertions from response.
  - Explain failed assertion.
  - Propose extraction variable.
  - Map response fields to state transition evidence.
  - Generate scenario from Proof Case.
- Every AI suggestion must show source context, diff, accept/edit/reject, and tool calls if used.

Do not copy:
- Do not make AI an opaque "fix it" button.
- Do not let AI mutate proof-critical assertions without approval.

### Playwright / Cypress / Checkly -> Crab Execution and Reports

What the references do well:
- Playwright UI Mode treats execution as an inspectable timeline: test sidebar, status filters, action timeline, before/after DOM snapshots, source, call details, logs, errors, console, network, attachments, metadata, and watch mode.
- Playwright Trace Viewer is the stronger post-run model: a recorded trace can be reopened after CI failure, with actions, screenshots, DOM snapshots, source, call, log, errors, console, and network.
- Cypress Open Mode is strong for local debugging: spec list, live command log, time-travel snapshots, console output, and quick rerun.
- Cypress screenshots/videos and Checkly browser checks show the report side: failed journeys need screenshots, videos, traces, logs, network requests, timing, and a result history that others can inspect.

Crab Execution and Reports should borrow failure-inspection structure, not developer IDE complexity.

Confirmed decision:
- The primary Execution and Reports experience should be Evidence-first Execution Detail.
- This means the first screen should answer: which proof step failed, what evidence exists, what business state transition is affected, and what action should happen next.
- Trace, DOM snapshot, console, network, and source details remain available as drill-down evidence, but they should not be the first mental model.

#### Page shell
Recommended layout:
- Left pane: execution list / suite tree / scenario steps with filters for failed, flaky, blocked, missing evidence, and pending approval.
- Top bar: selected environment, run target, commit/build/release marker, owner, risk level, rerun controls, report export.
- Center pane: execution timeline and artifact preview: screenshot, video, DOM snapshot, API response, or trace frame.
- Right pane: failure summary, expected vs actual, linked Proof Case, linked state transition, evidence quality, AI explanation, next action.
- Bottom pane: logs, console, network, actual request/response, trace metadata, attachments, retries, and history.

#### Execution list
Reference pattern:
- Playwright and Cypress start from a runnable test/spec list with status filtering.
- Checkly adds monitoring-style result history and locations/environments.

Crab mapping:
- The list should group by Proof Case, Suite, Scenario, and Execution.
- Each row should show status, risk, linked requirement, environment, duration, last failure, evidence completeness, owner, and next action.
- Filters should include failed, flaky, blocked, no evidence, waiting approval, and release-blocking.

Do not copy:
- Do not expose raw spec-file structure as the main user mental model.
- Do not make local watch mode the primary product experience.

#### Execution detail
Reference pattern:
- Playwright UI Mode and Trace Viewer let the user click an action, see before/after state, inspect logs, errors, console, network, source, call details, and attachments.
- Cypress Command Log keeps a chronological action list that can be used for time-travel debugging.

Crab mapping:
- Left step list should show ordered proof steps: API request, UI action, assertion, extraction, wait, approval, evidence attachment.
- Selecting a step should update the center preview and filter bottom logs/network/console to the selected time range.
- The center should default to the most decision-useful artifact: failed screenshot, video point, API response, assertion diff, or trace frame.
- The right panel should translate raw failure into product language: what state transition failed, which assertion failed, what evidence is missing, who should act.

Do not copy:
- Do not rebuild the full Playwright Trace Viewer.
- Do not make users read source code or DOM snapshots before showing the business impact.

#### Evidence report
Reference pattern:
- Checkly packages browser checks as user journeys with screenshots, videos, logs, traces, network, timing, and alertable outcomes.
- Playwright reports and traces make failures reviewable after CI, not only during local debugging.

Crab mapping:
- Every execution should produce an Evidence Set.
- Report sections: Decision Summary, Proof Coverage, Failed State Transitions, Step Timeline, Evidence Matrix, Artifacts, Environment, Approvals, History.
- Proof Report uses a two-layer consumption model: the first screen answers whether to ship, why, remaining risk, and who confirmed; QA/developer drill-down exposes evidence coverage, matrix rows, steps, artifacts, logs, API responses, and assertions.
- Evidence Matrix rows should link requirement -> Proof Case -> case/scenario -> execution step -> artifact -> assertion result -> reviewer decision.
- Evidence Matrix uses a two-layer structure: default rows are state transitions with evidence-type columns and trust conclusion; expansion reveals linked cases, steps, screenshots, logs, API responses, assertions, and reviewer decisions.
- Reports should answer: can this release pass, what is blocking it, and what proof supports that answer.
- Release gate should be a lightweight tiered evidence gate:
  - High-risk state changes should prefer stronger evidence such as API assertion, UI trace, DB/state check, or verified state observation plus reviewer decision.
  - Lower-risk changes may rely on screenshots, logs, source citations, or human confirmation when that is enough for the team.
  - Phase 1 should keep a clear final human decision: pass or fail.
  - Future CI pipeline integration can consume the gate result later, but CI integration should not complicate the first product design.

Do not copy:
- Do not become an uptime monitoring product in phase 1.
- Do not treat screenshot/video/trace as loose files; they must be attached to proof claims.

#### AI inside Execution and Reports
Reference pattern to adapt:
- Debugging tools increasingly summarize failures and expose richer run context.

Crab mapping:
- AI actions should be local to the selected execution or failed step:
  - Explain failure in business language.
  - Map failure to state transition risk.
  - Compare current run with last passing run.
  - Suggest owner and next action.
  - Draft report summary from accepted evidence.
- AI output must cite artifacts: log lines, screenshot frame, trace action, API response, assertion result, or knowledge source.

Do not copy:
- Do not let AI replace the evidence.
- Do not mark a report ready until evidence and human approval states are visible.

### Dify / Open WebUI -> Crab Knowledge

What the references do well:
- Dify frames Knowledge as domain data that grounds AI apps through retrieval, rather than relying only on the model's pretrained knowledge.
- Dify exposes create/manage/test-retrieval/integrate flows and supports built-in knowledge bases, pipelines, and external knowledge connections.
- Dify document APIs expose indexing status, metadata, processing statistics, token/word counts, hit counts, segment counts, and errors.
- Dify retrieval testing lets users simulate queries, inspect whether relevant information is retrieved, and keep retrieval records.
- Open WebUI makes Knowledge a workspace object: create a knowledge base, upload files or add existing documents, organize content, attach knowledge to models, or reference it in chat.

Confirmed decision:
- The primary Knowledge experience should be Source Trust Center.
- Knowledge should prove why AI output is trustworthy: what source was used, whether it is indexed, what chunk was retrieved, where the citation points, and whether the answer can be reproduced.
- Document management and retrieval debugging are supporting panels, not the top-level mental model.

#### Page shell
Recommended layout:
- Left pane: source groups, knowledge bases, document folders, linked requirements, and linked Proof Cases.
- Top bar: add source, sync/index status, retrieval test, usage, permissions, stale-source warnings.
- Center pane: selected source/document list, processing status, chunks/sections, metadata, and citation preview.
- Right pane: trust inspector: source reliability, last indexed, linked AI outputs, retrieval examples, failures, and approval state.
- Bottom pane: indexing logs, retrieval records, usage events, AI citations, and error details.

#### Sources
Reference pattern:
- Dify lets users create knowledge from quick import, pipeline, or external knowledge.
- Open WebUI lets users create named knowledge bases and add files or existing documents.

Crab mapping:
- Treat Source as the first-class object, not File.
- Source types: uploaded document, requirement document, URL/import, external knowledge API, manual note, execution artifact, future wiki/drive connector.
- Each source should show owner, scope, linked project, linked requirement/Proof Case, freshness, visibility, indexing status, and last successful retrieval.

Do not copy:
- Do not make users think in embedding pipelines first.
- Do not expose external RAG plumbing before users can see whether a source is trustworthy.

#### Documents
Reference pattern:
- Dify document records expose indexing status, metadata, processing stats, segment count, hit count, and errors.
- Open WebUI supports organizing knowledge content into directories.

Crab mapping:
- Document rows should show status: uploaded, parsing, indexed, failed, stale, disabled, archived.
- Show useful diagnostics: word count, chunk/segment count, last indexed, error, hit count, linked outputs, and freshness.
- Document detail should preview original content, parsed text, chunks, metadata, and citations created from it.

Do not copy:
- Do not make file upload the whole Knowledge product.
- Do not bury indexing failures in server logs.

#### Retrieval Test
Reference pattern:
- Dify has a retrieval testing page where users simulate queries and temporarily experiment with retrieval settings.
- Retrieval records include tests and linked-app retrieval requests.

Crab mapping:
- Retrieval Test should answer: if AI is asked this requirement/test/failure question, which sources are retrieved and are they good enough?
- Inputs: test query, selected scope, linked requirement/Proof Case, expected source, optional expected answer facts.
- Output: retrieved chunks, score/confidence label, source document, citation preview, missing-source warning, stale-source warning, and pass/fail judgment by reviewer.
- Keep advanced retrieval settings behind a compact "advanced" area.

Do not copy:
- Do not expose raw embedding parameters as the default UI.
- Do not let high similarity score imply business trust without source review.

#### Citations and usage
Reference pattern:
- Open WebUI can attach knowledge to models and reference it in chat.
- Dify integrates knowledge into apps and records retrieval events.

Crab mapping:
- Every AI output in Requirements, Cases, Execution, and Reports should show citations from Knowledge.
- Citation panel fields: source, document, chunk/section, quoted preview, retrieval query, time, model/action that used it, and reviewer status.
- Usage page should show where each source was used: requirement parsing, case generation, assertion suggestion, failure explanation, report draft.

Do not copy:
- Do not make citations appear only inside chat messages.
- Do not allow AI-generated proof assets without visible source trail.

#### AI inside Knowledge
Reference pattern to adapt:
- Knowledge products make documents searchable and retrievable by AI.

Crab mapping:
- AI actions should help maintain trust:
  - Suggest source-to-requirement links.
  - Detect stale or conflicting sources.
  - Explain why retrieval missed expected content.
  - Summarize source changes since last proof run.
  - Propose better queries for retrieval tests.
- Every AI action must show the source and retrieved chunks it used.

Do not copy:
- Do not make Knowledge a black-box RAG settings page.
- Do not let AI cite unavailable, unindexed, stale, or disabled sources without warning.

### MCP official / VS Code / Cursor -> Crab MCP

What the references do well:
- MCP official docs frame MCP as an open standard for connecting AI applications to external data, tools, and workflows.
- MCP tools are model-controlled capabilities exposed by servers, but the spec recommends clear UI for exposed tools, visual indicators when invoked, and human confirmation for operations.
- MCP resources expose context such as files, database schemas, or application-specific data and can be shown in tree/list views, searched, filtered, or automatically attached by the host.
- VS Code exposes practical MCP management: add servers, trust servers, view available tools, toggle specific tools, manage start/stop/logs, enable/disable servers, and distinguish workspace vs user-level configuration.
- Cursor and AI IDEs reinforce the product lesson: MCP makes the assistant more capable, but dangerous tool use needs clear approval and scope.

Confirmed decision:
- The primary MCP experience should be Server Governance Center.
- MCP should be designed as a governed capability layer, not a tool marketplace and not a raw JSON editor.
- The main user question is: which external capabilities can AI use in this project, under what permissions, and what did it do with them?

#### Page shell
Recommended layout:
- Left pane: MCP servers grouped by project, environment, status, owner, and trust level.
- Center pane: selected server card with connection status, capabilities, tools, resources, prompts, configuration summary, and permissions.
- Right pane: permission inspector, linked Skills/AI actions, risk notes, last invocations, and approval policy.
- Bottom pane: invocation logs, connection logs, errors, tool schema preview, and audit events.

#### Server cards
Reference pattern:
- VS Code lets users add, configure, start/stop, trust, enable/disable, and inspect MCP servers.
- MCP servers can expose tools, resources, prompts, and interactive apps.

Crab mapping:
- Each server card should show name, type, transport, environment, status, trust state, owner, last seen, capability counts, linked project, and risk level.
- Status states: disconnected, connecting, connected, degraded, disabled, untrusted, auth required, error.
- Actions: connect, disconnect, enable, disable, test connection, view logs, rotate credential reference, reset trust.

Do not copy:
- Do not make users edit raw MCP JSON as the default path.
- Do not auto-start or auto-enable all tools globally.

#### Tools / Resources / Prompts
Reference pattern:
- MCP distinguishes tools, resources, and prompts.
- VS Code lets users configure available tools and add MCP resources as chat context.

Crab mapping:
- Tool list fields: name, description, input schema summary, output summary, permission class, approval rule, last used, used by, linked Proof Case or execution.
- Resource list fields: URI/name, type, readable scope, freshness, sensitivity, selectable contexts, last read.
- Prompt list fields: name, purpose, arguments, recommended contexts, last used, owner.
- Use tabs under each server: Overview, Tools, Resources, Prompts, Permissions, Invocation Logs.

Do not copy:
- Do not flatten tools/resources/prompts into one generic "capabilities" table.
- Do not hide schemas and permissions from reviewers.

#### Permissions
Reference pattern:
- MCP tools can invoke external systems and should show which tools are exposed, when tools are invoked, and require confirmation for risky operations.
- VS Code has trust, enable/disable, and sandbox concepts around MCP servers.

Crab mapping:
- Permission levels: disabled, ask every time, allow read-only, allow in selected contexts, allow with approval, blocked for project.
- Tool risk classes: read context, read external data, write external system, execute code, access secret, change project state.
- Permission scope: project, environment, user role, Proof Case, Skill, AI action type.
- Every dangerous operation should have a visible approval reason and reviewer.

Do not copy:
- Do not use "yolo mode" as product language.
- Do not bury permission rules inside settings files.

#### Invocation logs
Reference pattern:
- Tool calls are visible product events in modern AI clients; MCP governance depends on knowing what was called and why.

Crab mapping:
- Invocation rows should show time, server, tool/resource/prompt, caller page, AI action, input summary, redacted output summary, status, duration, approval, error, linked Proof Case/execution/report.
- Detail view should include full schema, redacted payload, result artifacts, retry chain, and policy decision.
- Logs should be searchable by server, tool, status, user, Proof Case, execution, and risk class.

Do not copy:
- Do not log secrets in plain text.
- Do not make invocation history available only in backend audit logs.

#### AI inside MCP
Reference pattern to adapt:
- MCP gives AI access to external capabilities; the host application decides the user experience and safety boundaries.

Crab mapping:
- AI actions should request tool permission in context:
  - "Use GitHub MCP to fetch issue acceptance criteria for this requirement."
  - "Use database MCP read-only query to verify state transition evidence."
  - "Use Playwright MCP to collect UI evidence for this proof step."
- AI must show why it wants the tool, expected read/write impact, and how result will attach to a Proof Case.

Do not copy:
- Do not let Chat become the only place to understand MCP behavior.
- Do not let MCP tool use produce untraceable evidence.

### Open WebUI Skills / Dify Plugins / Langflow -> Crab Skills and AI Chat

What the references do well:
- Open WebUI Skills treats skills as reusable markdown-based instruction sets that can be attached to models or invoked on demand in chat.
- Open WebUI separates Skills from executable Tools: skills teach the model how to approach a task, while tools provide executable capability.
- Open WebUI supports on-demand skill loading, per-chat selection, model binding, import/export, and composition with tools.
- Dify Plugins separates extension types: Tool, Model, Agent Strategy, Extension, Datasource, and Trigger. This keeps capability types clear instead of mixing everything into one AI menu.
- Langflow shows how flows and components can represent reusable AI workflows, but its visual canvas should be treated as an advanced authoring pattern, not the first Crab experience.

Confirmed decision:
- The primary Skills / AI Chat experience should be Skill Asset Library.
- Skills are governed capability assets. Chat is an invocation surface.
- The main user question is: what reusable AI capability exists, where is it allowed, what context does it use, and what has it produced?

#### Page shell
Recommended layout:
- Left pane: skill categories, contexts, status filters, owners, and linked modules.
- Center pane: skill cards or table with purpose, version, compatible contexts, permissions, required sources/tools, and last used.
- Right pane: skill inspector with instructions preview, bindings, usage history, approval state, rollback, and linked outputs.
- Bottom pane: invocation history, generated artifacts, tool calls, citation trail, errors, and review notes.

#### Skill asset library
Reference pattern:
- Open WebUI skills are reusable instruction assets that can be attached to models or invoked in chat.
- Dify plugin types show that capability assets need clear categories and invocation boundaries.

Crab mapping:
- Skill fields: name, purpose, owner, version, status, compatible modules, required Knowledge sources, allowed MCP tools, output type, review policy, and rollback target.
- Skill categories: Requirement Analysis, Case Generation, Assertion Suggestion, Failure Analysis, Report Drafting, Evidence Review, Source Review.
- Status states: draft, active, deprecated, disabled, needs review, failed last run.

Do not copy:
- Do not make skills look like casual prompt snippets.
- Do not let a skill silently use Knowledge or MCP without showing dependencies.

#### Bindings and contexts
Reference pattern:
- Open WebUI allows skills to be bound to models or selected per chat.
- Skills can be loaded on demand instead of always injecting full instructions.

Crab mapping:
- Bind skills to product contexts, not only models:
  - Requirements: parse requirement, find ambiguity, propose state transitions.
  - Cases: generate cases, improve coverage, detect duplicates.
  - API Automation: suggest assertions, extraction variables, scenarios.
  - Execution: explain failures, compare runs, propose next action.
  - Reports: draft decision summary from accepted evidence.
- Skill binding should show where it appears, when it can run, what it may read, and what it may change.

Do not copy:
- Do not make model binding the only mental model.
- Do not inject every skill everywhere.

#### AI Chat
Reference pattern:
- Open WebUI chat can invoke skills on demand, attach tools, and use knowledge.
- AI clients show tool calls and retrieved context as part of the interaction.

Crab mapping:
- AI Chat should be a global right-side drawer, not a primary navigation item.
- Chat inherits current page context: selected requirement, case, scenario, execution, evidence, report, source, skill, or MCP invocation.
- Chat should show active context, selected skills, used sources, tool calls, generated artifacts, accept/edit/reject, retry, and history.
- Chat output should create reviewable artifacts only after user approval.

Do not copy:
- Do not make Chat the product homepage.
- Do not hide generated artifacts inside chat history.

#### Skill invocation logs
Reference pattern:
- Skills and tools become trustworthy only when users can see when they were used and what they affected.

Crab mapping:
- Invocation row fields: skill, version, caller page, input object, sources used, MCP tools used, generated artifact, status, reviewer, accepted/rejected, rollback target.
- Detail view should show instruction version, source citations, tool calls, output diff, and user decision.

Do not copy:
- Do not log only final chat text.
- Do not lose which skill version produced a test case or report text.

#### Advanced flow authoring
Reference pattern:
- Langflow supports visual workflow composition from components, agents, tools, model providers, and data stores.

Crab mapping:
- Advanced flow builder can exist later for power users, but phase 1 should use structured Skill assets and contextual AI actions.
- If introduced, flow authoring should produce governed Skills or AI Actions, not a separate product universe.

Do not copy:
- Do not start with a visual flow builder as the main AI experience.
- Do not make users understand nodes, chains, and agents before they can review AI output.

### GitHub / Vercel / Supabase -> Crab Project Settings

What the references do well:
- GitHub repository settings separate access/collaboration, feature settings, repository policies, security/analysis, branches, and destructive repository actions.
- GitHub repository roles show a clear access ladder from read to admin, with sensitive and destructive actions reserved for admins.
- Vercel environment variables are scoped to environments such as Production, Preview, Custom, and Development, with branch-specific preview overrides.
- Vercel environments separate local development, preview testing/QA, and production release behavior.
- Supabase API keys clearly distinguish publishable keys from secret keys and warns that secret/service-role keys must not be exposed on the frontend.

Confirmed decision:
- The primary Settings experience should be Project Governance Settings.
- Settings should govern a project: identity, members, AI providers, credentials, audit, and dangerous actions.
- AI platform configuration belongs here, but Settings should not become a crowded AI infrastructure cockpit.

#### Page shell
Recommended layout:
- Left pane: settings groups: General, Members, Model Providers, Credentials, Audit, Danger Zone.
- Center pane: selected settings form or table with clear save/apply state.
- Right pane: governance inspector: scope, risk, last changed, changed by, linked usage, and warnings.
- Bottom pane when needed: audit events, validation errors, credential usage, and policy notes.

#### General
Reference pattern:
- GitHub keeps repository identity, visibility, features, policies, and destructive actions structurally separated.

Crab mapping:
- General should include project name, description, default environment, release gate behavior, proof terminology, timezone, and archive status.
- Show "last changed by" and affected areas for important project-level settings.

Do not copy:
- Do not expose every low-level system flag in General.
- Do not mix Danger Zone actions into ordinary settings.

#### Members
Reference pattern:
- GitHub roles provide a simple access ladder and reserve sensitive/destructive operations for admins.

Crab mapping:
- Use simple project roles first: Viewer, Tester, Reviewer, Maintainer, Admin.
- Each member row should show role, access scope, pending approvals, recent activity, and last login.
- Reviewer/Admin actions should be visibly tied to proof approval and settings changes.

Do not copy:
- Do not start with complex enterprise RBAC as the main UI.
- Do not make permissions invisible or implied.

#### Model Providers
Reference pattern:
- Vercel separates project-level environment configuration and values by target environment.
- Supabase separates key types by exposure and privilege.

Crab mapping:
- Model Providers should show provider name, model family, capability, environment scope, credential reference, usage status, fallback model, and health check.
- Separate provider identity from credentials: the provider config should not expose secret values.
- Show where each provider is used: Requirements, Cases, API, Execution, Reports, Chat.

Do not copy:
- Do not make model provider setup a generic secret form.
- Do not mix model routing, billing, and prompt settings into one flat page.

#### Credentials
Reference pattern:
- Vercel scopes variables by Production/Preview/Development and supports branch-specific preview overrides.
- Supabase distinguishes publishable from secret keys and highlights frontend/backend safety boundaries.

Crab mapping:
- Credentials should be organized by environment and usage: local, test, staging, production.
- Each credential row should show name, type, scope, owner, last rotated, used by, exposure class, and masked value.
- Exposure classes: public/publishable, server-only secret, service-role/admin, external API token, MCP credential.
- Warn if a high-privilege key is attached to a frontend, chat, or broad AI context.

Do not copy:
- Do not show secret values after creation by default.
- Do not let users paste credentials into unrelated settings pages.

#### Audit
Reference pattern:
- GitHub exposes audit and security settings around repository governance.

Crab mapping:
- Audit should show settings changes, credential creation/rotation, model provider changes, MCP permission changes, member role changes, AI approval actions, and report gate changes.
- Rows should link to the affected project object: Proof Case, Execution, Report, Source, Skill, MCP server, or Credential.

Do not copy:
- Do not make audit only a backend compliance log.
- Do not bury proof-critical changes in generic activity feeds.

#### Danger Zone
Reference pattern:
- GitHub isolates destructive repository actions and makes their consequences explicit.

Crab mapping:
- Danger Zone should contain archive project, delete project, reset evidence, revoke all credentials, disable all MCP tools, and transfer ownership.
- Every action should show consequence, required role, confirmation phrase, affected objects, and audit result.

Do not copy:
- Do not place destructive actions beside normal save buttons.
- Do not add many irreversible operations before their recovery rules are clear.

## Proof Case detail direction
The Proof Case detail page is the conceptual center of the product.

Proof Case creation:
- Phase one starts from requirement description, tested system, and business entry point.
- Do not require Feishu/Jira/ZenTao integration before a user can create a Proof Case.
- The creation page should surface similar asset recommendations so users can reuse known business flows, state transitions, cases, and evidence points when relevant.

Phase-one P0 design slice:
- Design the Proof Case closed loop first: create Proof Case, AI requirement understanding, state transition confirmation, cases and evidence-point confirmation, execution evidence collection, evidence matrix report, and asset packaging.
- Include Workbench in P0 so users have a real product entry for pending confirmation, failed proof, risk, and recent report work.
- Keep System Context as a lightweight placeholder/status surface in P0; do not deep-design the full configuration experience before the Proof Case loop is clear.

Confirmed decision:
- The primary Proof Case detail experience should be Lifecycle Proof Workspace.
- The first screen is next-action-first: it should answer what is blocked, what needs confirmation, and what the user should do next. Trust status, evidence completeness, and risk remain visible as supporting signals, not the primary visual.
- Proof Case should guide the user through Requirement -> State Transition -> Cases -> Automation -> Execution -> Evidence -> Report.
- Evidence matrix, execution detail, and review board are supporting views inside the lifecycle, not the main entry model.

Recommended layout:

- Header: title, linked requirement, status, owner, risk level, release target, last run.
- Left rail: stages: Requirement, State Transition, Cases, Automation, Execution, Evidence, Report.
- Center pane: active stage editor or timeline.
- Right pane: AI suggestions, sources, approvals, properties, evidence quality, and blockers.
- Bottom pane when relevant: run logs, assertions, extracted variables, network, artifacts.

Stage responsibilities:
- Requirement: show source document, parsed scope, ambiguity, accepted version, and citations.
- State Transition: show current state, trigger, expected next state, business rule, risk, and reviewer confirmation.
- Cases: show generated drafts, coverage against transitions, duplicates/gaps, approval state, and source trace.
- Automation: show linked API cases, scenarios, UI checks, environment, assertions, extraction, and evidence expectations. Script details are hidden by default and exposed through a clear "view script details" entry when generation fails, execution fails, the user reviews, modifies, reuses, or debugs automation.
- Execution: show latest run, failed step, business impact, artifact summary, and rerun path.
- Evidence: show the two-layer evidence matrix, screenshots, traces, logs, API responses, assertions, source citations, and reviewer status.
- Report: show release decision summary first, then blockers, accepted evidence, unresolved risks, approval history, and QA/developer drill-down.

AI draft confirmation:
- Confirmation is risk-tiered before cases and automation.
- Low-risk requirements require the minimum confirmation set: business object, main flow, state transition when applicable, and evidence points.
- High-risk requirements require the full confirmation set: business object, roles, entry points, state transitions, business rules, included scope, excluded scope, risks, and evidence points.
- Phase one should keep risk tiering simple and explicit; do not introduce a complex rule engine before the product proves the workflow.

State Transition rule:
- State Transition is required for requirements that involve business state changes.
- Pure copy, visual, content, or non-stateful configuration changes may skip this stage with a recorded reason.
- AI may propose state transitions, but user confirmation is required before cases, automation, or release evidence can count against that state change.
- State Transition uses graph + table dual views. The graph helps users understand the business flow; the table is the default working view for confirmation, bulk editing, rules, evidence points, risk, and reviewer status.

Expert QA efficiency:
- Phase one keeps batch confirmation and search/filtering.
- Batch confirmation should cover AI suggestions, state transitions, and evidence points.
- Search/filtering should cover business object, state transition, risk, evidence gap, and execution status.
- Do not build a full keyboard shortcut system, batch rerun, or complex run comparison before these core review efficiencies are proven.

Minimum stage model:

1. Requirement understood.
2. State transition confirmed.
3. Cases drafted.
4. Cases approved.
5. Automation linked.
6. Execution completed.
7. Evidence accepted.
8. Report ready.

## Decision boundaries
- Product/design planning can assume ideal first-class Proof Case language even if implementation artifacts lag behind.
- Engineering cost and implementation sequence are not constraints for this design record.
- Reference products are allowed as product-pattern evidence, not as source for cloning protected expression, layouts, copy, assets, or code.
- Future implementers should translate this design into specs and code separately.

## Open questions
- Should "Proof Case" be the final product term, or should Chinese UX use "可信验证任务" while internal English keeps Proof Case?
- Should the first user-facing entry point be Overview or Proof Cases?
- How much of AI confidence should be shown numerically versus qualitatively?
- Should mobile support report review only, or also approval actions?
