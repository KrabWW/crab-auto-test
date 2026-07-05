## ADDED Requirements

### Requirement: Product navigation follows the Proof Case lifecycle
The system SHALL treat Proof Case as the product spine and SHALL keep phase-one first-level navigation to Workbench, Verification Tasks, Asset Library, System Context, and Settings.

#### Scenario: Overview is the default daily entry
- **WHEN** a user enters a project workspace
- **THEN** the Overview SHOULD present Proof Case Queue, Release Risk, Failed Evidence, Pending Approvals, Coverage Gaps, Recent Runs, and Next Actions.

#### Scenario: Workbench first screen uses action and risk queues
- **WHEN** a user opens the Workbench
- **THEN** the first screen SHOULD show My To-dos for pending AI drafts, state-transition confirmations, evidence-point confirmations, and report approvals.
- **AND** it SHOULD show Risks and Blockers for insufficient evidence, failed proof, high-risk requirements, and release blockers.

#### Scenario: Phase-one P0 design slice is scoped
- **WHEN** phase-one P0 product design is planned
- **THEN** the design slice SHOULD include the Proof Case closed loop and Workbench.
- **AND** System Context SHOULD remain a lightweight placeholder/status surface until the Proof Case loop is clear.

#### Scenario: Evidence reports stay inside Proof Case in phase one
- **WHEN** a user needs a proof report in phase one
- **THEN** the report SHOULD be available as a Proof Case detail stage and generated artifact, not as a first-level menu.

#### Scenario: Proof Case detail follows lifecycle stages
- **WHEN** a user opens a Proof Case
- **THEN** the page SHOULD guide the user through Requirement, State Transition, Cases, Automation, Execution, Evidence, and Report.

#### Scenario: Proof Case detail is next-action-first
- **WHEN** a user opens a Proof Case detail page
- **THEN** the first screen SHOULD prioritize the blocked stage, required confirmation, and next action, while showing trust status, evidence completeness, and risk as supporting signals.

#### Scenario: Proof Case creation starts from requirement description
- **WHEN** a user creates a Proof Case in phase one
- **THEN** the creation flow SHOULD start from requirement description, tested system, and business entry point.
- **AND** it SHOULD surface similar asset recommendations when available.
- **AND** it MUST NOT require Feishu, Jira, or ZenTao integration before creation.

#### Scenario: State transition supports understanding and efficient confirmation
- **WHEN** a user reviews state transitions in a Proof Case
- **THEN** the UI SHOULD support both a graph view for understanding the business flow and a table view for confirmation, bulk editing, rules, evidence points, risk, and reviewer status.
- **AND** the table SHOULD be the default working view.

#### Scenario: Script details use progressive disclosure
- **WHEN** a user works in the Automation stage
- **THEN** script details SHOULD be hidden by default behind an explicit view action.
- **AND** script details SHOULD be exposed when generation fails, execution fails, or the user reviews, modifies, reuses, or debugs automation.

#### Scenario: Expert QA review stays efficient without overbuilding
- **WHEN** an expert QA reviews Proof Case material in phase one
- **THEN** the UI SHOULD support batch confirmation for AI suggestions, state transitions, and evidence points.
- **AND** the UI SHOULD support search/filtering by business object, state transition, risk, evidence gap, and execution status.
- **AND** phase one SHOULD defer a full keyboard shortcut system, batch rerun, and complex run comparison.

#### Scenario: Asset library recommends reusable verification assets
- **WHEN** a user creates a new Proof Case
- **THEN** the Asset Library SHOULD surface similar verification assets that may reduce confirmation, rewriting, and rerunning.
- **AND** each recommendation SHOULD show fit scope, latest run result, and maintainer.

### Requirement: System Context supports Agent understanding and evidence collection
The system SHALL use System Context for tested-system knowledge and evidence-collection context, while keeping project governance in Settings.

#### Scenario: System Context is configured in phase one
- **WHEN** a user configures System Context in phase one
- **THEN** the UI SHOULD support tested system, environments, accounts/permissions, page entries, API sources, business glossary, read-only database connection entry, log source entry, state-field mapping, and evidence collection method.

#### Scenario: Database and log integrations start lightweight
- **WHEN** database or log sources are not fully integrated
- **THEN** the UI SHOULD show configurable entries and visible placeholder/status states rather than blocking Proof Case design on complete integration.

### Requirement: API automation uses Hoppscotch as retained code reference
The system SHALL use Hoppscotch as the retained open-source code reference for API automation workbench patterns, while Apifox/Postman remain product-interaction references only.

#### Scenario: API automation reference check
- **WHEN** an API automation feature spec or implementation plan is created
- **THEN** it MUST consider Hoppscotch as the local open-source reference and MUST NOT rely on Bruno unless Bruno is explicitly re-approved.

### Requirement: Reference-product page mapping is a design baseline
The system SHALL treat `docs/REFERENCE-PRODUCT-PAGE-MAPPING.md` as the retained page-structure mapping for Hoppscotch, Playwright, Allure, Dify, Open WebUI, Cline, and Supabase.

#### Scenario: Feature specs use the mapped reference pattern
- **WHEN** a feature spec or design review touches API automation, UI execution evidence, proof reports, Knowledge, Skills, AI Chat, MCP, or Settings
- **THEN** it MUST check the corresponding reference-product mapping before proposing page structure or interaction changes.
- **AND** it MUST preserve Crab's Proof Case evidence chain instead of copying the reference product's full product boundary.

### Requirement: UI component baseline is accepted
The system SHALL treat `docs/UI-COMPONENT-BASELINE.md` as the accepted component matrix for module-level product design.

#### Scenario: Feature specs use the component baseline
- **WHEN** a feature spec or design review proposes UI for Overview, Requirements, Cases, API Automation, UI Automation, Execution and Reports, Knowledge, MCP, Skills, AI Chat, or Settings
- **THEN** it MUST check the accepted component matrix before proposing dialogs, drawers, tables, sidebars, tabs, or workbench layouts.
- **AND** it SHOULD use shadcn-vue, Tailwind, Radix primitives, and lucide as the default foundation.
- **AND** it MUST NOT introduce a second full UI system without an explicit design revision.

### Requirement: Execution and reports are evidence-first
The system SHALL present execution results around proof step, business impact, evidence artifacts, and next action before exposing trace/log/network/source drill-down details.

#### Scenario: Failed execution triage
- **WHEN** an execution fails
- **THEN** the first-level UI SHOULD show the failed proof step, affected state transition, available evidence, likely owner/action, and report impact.

#### Scenario: Evidence matrix has summary and drill-down layers
- **WHEN** a user reviews the evidence matrix
- **THEN** the default view SHOULD organize rows by state transition and columns by evidence type, trust conclusion, and risk.
- **AND** expanding a row SHOULD reveal linked cases, steps, artifacts, assertions, raw evidence, and reviewer decisions.

#### Scenario: Proof report supports decision and drill-down consumers
- **WHEN** a user opens a Proof Report
- **THEN** the first screen SHOULD answer whether to ship, why, remaining risk, and who confirmed.
- **AND** QA/developer drill-down SHOULD expose evidence coverage, matrix rows, steps, artifacts, logs, API responses, assertions, and reviewer decisions.

### Requirement: AI context features are governed and inspectable
Knowledge, Skills, AI Chat, and MCP SHALL expose sources, permissions, dependencies, invocations, and review decisions rather than acting as opaque AI infrastructure.

#### Scenario: AI-generated artifact is reviewed
- **WHEN** AI generates or changes a requirement, case, assertion, failure explanation, or report summary
- **THEN** the UI SHOULD show the used sources, skill/version if any, MCP/tool calls if any, generated diff, and accept/edit/reject decision.

#### Scenario: AI output correction is structured
- **WHEN** a user edits or rejects an AI output
- **THEN** the UI SHOULD let the user mark an error reason such as business misunderstanding, wrong scope, wrong state identification, insufficient evidence point, non-executable script, data dependency error, or environment assumption error.
- **AND** phase one SHOULD keep generation history and the last human confirmation record without requiring complex rollback or error analytics.

#### Scenario: AI entry combines stage actions and assistant context
- **WHEN** a user works inside a Proof Case stage
- **THEN** explicit AI actions SHOULD be available in that stage for tasks such as generate, complete, explain, repair, compare, or recommend.
- **AND** the right-side assistant SHOULD explain sources, risks, tool calls, history, and follow-up questions for those actions.

### Requirement: AI draft confirmation is risk-tiered
The system SHALL require human confirmation before cases and automation, with a minimum confirmation set for low-risk requirements and a full confirmation set for high-risk requirements.

#### Scenario: Low-risk AI draft is reviewed
- **WHEN** a low-risk requirement AI draft is reviewed
- **THEN** the user SHOULD confirm business object, main flow, applicable state transition, and evidence points before moving to cases or automation.

#### Scenario: High-risk AI draft is reviewed
- **WHEN** a high-risk requirement AI draft is reviewed
- **THEN** the user SHOULD confirm business object, roles, entry points, state transitions, business rules, included scope, excluded scope, risks, and evidence points before moving to cases or automation.

#### Scenario: Phase-one risk tiering stays simple
- **WHEN** risk tiering is designed in phase one
- **THEN** it SHOULD be explicit and simple, and MUST NOT require a complex rules engine.

### Requirement: Release gate stays lightweight in phase 1
The system SHALL support a lightweight tiered evidence gate with final human pass/fail decision in phase 1, while allowing future CI pipeline integration to consume the gate result.

#### Scenario: High-risk state change is reviewed
- **WHEN** a high-risk state-changing requirement reaches release review
- **THEN** the report SHOULD prefer stronger evidence such as API assertion, UI trace, DB/state check, or verified state observation plus reviewer decision.

#### Scenario: CI integration is deferred
- **WHEN** implementation planning discusses release gate output
- **THEN** CI pipeline integration MAY be treated as a future consumer and MUST NOT complicate the first-phase product design.
