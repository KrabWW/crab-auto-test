## ADDED Requirements

> Clean-room provenance: mcp-admin is described against the general industry pattern of project-scoped tool governance (propose/review/approve/revoke) with an allowlist as the single source of truth for invocation rejection. The project-scoped-only constraint and single-source-of-truth ownership are independent design choices that preserve the simple-roles invariant; no upstream MCP admin UI, governance flow, or layout is reused.

### Requirement: MCP tools are reviewable and approvable under simple roles
The system SHALL surface project-registered MCP tools for review and let a project owner review, approve (allowlist), or revoke project-scoped tools using no roles beyond owner/member. The platform provides only project-scoped MCP tools; there is no global MCP tool category and therefore no global approver role.

#### Scenario: Project member registers a tool candidate
- **WHEN** a project member registers a tool name and server reference for the project
- **THEN** the system MUST create a project-scoped tool candidate, MUST record an admin action, and MUST NOT expose it to other projects.

#### Scenario: Owner reviews a tool candidate
- **WHEN** a project owner marks a proposed MCP tool as reviewed
- **THEN** the system MUST preserve the candidate as project-scoped, MUST record the status transition, and MUST NOT require a custom approver role.

#### Scenario: Owner allowlists a project-scoped MCP tool
- **WHEN** a project owner approves a reviewed MCP tool for the project
- **THEN** the system MUST add it to the project allowlist, MUST record an audit event, and MUST NOT require a custom approver role.

#### Scenario: Owner revokes a tool
- **WHEN** an owner revokes a previously allowlisted tool
- **THEN** the system MUST remove it from the allowlist and subsequent calls to that tool MUST be rejected.

#### Scenario: Project member performs a test call
- **WHEN** a project member test-calls a registered MCP tool
- **THEN** the system MUST run the same backend allowlist predicate as production calls, MUST record the tool-call result, and MUST surface whether the call was approved, rejected, or failed.

### Requirement: MCP admin approval is the source of truth for backend MCP calls
The system SHALL source the set of approved MCP tools from mcp-admin registry rows plus their derived allowlist rows, and the backend AI orchestration MUST reject any tool call that lacks either an approved registry row or an approved allowlist row before invocation. mcp-admin owns this rejection predicate; backend-ai-orchestration references it without re-stating it.

#### Scenario: Non-allowlisted tool call is rejected
- **WHEN** an AI orchestration node requests an MCP tool that is not in the approved allowlist
- **THEN** the backend MUST reject the call before invocation and MUST record the rejection.

#### Scenario: Hidden allowlist row is rejected
- **WHEN** an MCP tool has an allowlist row but no approved mcp-admin registry row and action history
- **THEN** the backend MUST reject the call before invocation.

#### Scenario: Allowlisted tool call is executed and traced
- **WHEN** an AI orchestration node requests an MCP tool with both an approved registry row and an approved allowlist row
- **THEN** the backend MUST invoke it via the backend-managed MCP client and MUST record an MCP tool-call metadata entry (tool, server, approved flag, redacted args, result meta, status, timing).

### Requirement: MCP admin actions and tool calls are audited end-to-end
The system SHALL record admin governance actions (propose/review/approve/revoke) and per-call tool metadata, queryable together for a project or tool.

#### Scenario: Auditor reviews MCP tool history
- **WHEN** an auditor queries the history of an MCP tool
- **THEN** the system MUST return the admin action trail and all MCP tool-call entries for that tool, with redacted arguments and no raw secrets.

#### Scenario: Project user opens the MCP administration page
- **WHEN** a project user opens MCP administration
- **THEN** the UI MUST show the project tool list, review/approval state, allowlist state, latest test-call outcome, and per-tool action/call history without exposing raw secrets.
