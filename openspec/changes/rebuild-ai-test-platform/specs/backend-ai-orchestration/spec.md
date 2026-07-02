## ADDED Requirements

### Requirement: NestJS owns AI orchestration APIs

The system SHALL expose AI orchestration endpoints from the NestJS backend rather than from the frontend or desktop shell.

#### Scenario: Client starts AI generation

- **WHEN** the web or desktop client requests AI test generation
- **THEN** the request MUST be handled by a NestJS API endpoint that creates and tracks the orchestration run.

### Requirement: LangGraph models AI workflows

The backend SHALL use LangGraph.js to model multi-step AI workflows that need state, tool calls, retries, streaming progress, and human approval.

#### Scenario: Requirement-to-case workflow runs

- **WHEN** a generation workflow starts
- **THEN** LangGraph MUST coordinate the stages for context retrieval, drafting, validation, review state, and persistence handoff.

### Requirement: MCP integrations are backend-managed

The backend SHALL use the MCP TypeScript SDK to connect approved tools and resources to AI workflows.

#### Scenario: AI workflow needs a tool

- **WHEN** a LangGraph node requires an external tool
- **THEN** the backend MUST call an approved MCP client/server integration and record the tool call metadata.

### Requirement: AI workflow progress is streamable

The backend SHALL stream AI workflow progress to clients over SSE or WebSocket.

#### Scenario: Desktop client watches workflow progress

- **WHEN** a LangGraph run emits stage updates or partial output
- **THEN** the NestJS backend MUST forward those events to the authenticated client using the shared streaming contract.
