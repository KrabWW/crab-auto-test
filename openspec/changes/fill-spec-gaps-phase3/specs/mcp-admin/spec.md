## ADDED Requirements

> Clean-room provenance: mcp-admin is described against the general industry pattern of project-scoped tool governance (propose/review/approve/revoke) with an allowlist as the single source of truth for invocation rejection. The project-scoped-only constraint and single-source-of-truth ownership are independent design choices that preserve the simple-roles invariant; no upstream MCP admin UI, governance flow, or layout is reused.

### Requirement: MCP tools are reviewable and approvable under simple roles
The system SHALL surface discovered MCP tools for review and let a project owner approve (allowlist) or revoke project-scoped tools using no roles beyond owner/member. The platform provides only project-scoped MCP tools; there is no global MCP tool category and therefore no global approver role.

#### Scenario: Owner allowlists a project-scoped MCP tool
- **WHEN** a project owner approves a reviewed MCP tool for the project
- **THEN** the system MUST add it to the project allowlist, MUST record an audit event, and MUST NOT require a custom approver role.

#### Scenario: Owner revokes a tool
- **WHEN** an owner revokes a previously allowlisted tool
- **THEN** the system MUST remove it from the allowlist and subsequent calls to that tool MUST be rejected.

### Requirement: The approved allowlist is the source of truth for backend MCP calls
The system SHALL source the set of approved MCP tools exclusively from the mcp-admin allowlist, and the backend AI orchestration MUST reject any tool call not present in the allowlist before invocation. mcp-admin owns this rejection predicate; backend-ai-orchestration references it without re-stating it.

#### Scenario: Non-allowlisted tool call is rejected
- **WHEN** an AI orchestration node requests an MCP tool that is not in the approved allowlist
- **THEN** the backend MUST reject the call before invocation and MUST record the rejection.

#### Scenario: Allowlisted tool call is executed and traced
- **WHEN** an AI orchestration node requests an MCP tool present in the allowlist
- **THEN** the backend MUST invoke it via the backend-managed MCP client and MUST record an MCP tool-call metadata entry (tool, server, approved flag, redacted args, result meta, status, timing).

### Requirement: MCP admin actions and tool calls are audited end-to-end
The system SHALL record admin governance actions (propose/review/approve/revoke) and per-call tool metadata, queryable together for a project or tool.

#### Scenario: Auditor reviews MCP tool history
- **WHEN** an auditor queries the history of an MCP tool
- **THEN** the system MUST return the admin action trail and all MCP tool-call entries for that tool, with redacted arguments and no raw secrets.
