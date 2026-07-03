## ADDED Requirements

> Clean-room provenance: llm-chat is described against the general industry pattern of backend-owned conversational LLM sessions with audit, explicit context attachment, retrieval visibility, generated-output persistence, and secrets-free logging. The session-level scoping is an independent design choice that keeps it outside backend-ai-orchestration's multi-step approval workflow scope; no upstream chat session model, prompt, tool schema, or UI layout is reused.

### Requirement: Users can chat over configured model providers via backend orchestration
The system SHALL let project members hold interactive, single-turn-or-conversational chat sessions over a model provider configured in platform-foundation, with the LLM call made exclusively by the NestJS backend. Chat is session-scoped and has no human-approval gating; bounded internal activities such as context loading, RAG retrieval, and generated-artifact persistence MAY be shown as tool/activity records, but external MCP administration remains owned by `mcp-admin`.

#### Scenario: Member sends a chat message
- **WHEN** a member sends a message in a chat session bound to a configured provider
- **THEN** the backend MUST make the LLM call, persist the user and assistant messages in order, return the updated session to the client, and the client MUST NOT call the LLM directly.

#### Scenario: Chat is inaccessible without a configured provider
- **WHEN** no model provider is configured for the selected kind
- **THEN** the system MUST prevent starting a chat session and MUST surface a clear reason to the user.

### Requirement: Chat sessions are persisted
The system SHALL persist chat sessions and their messages so members can reopen and continue them.

#### Scenario: Member reopens a session
- **WHEN** a member reopens an existing chat session
- **THEN** the system MUST load prior messages in order and MUST allow new messages to be appended to the same session.

### Requirement: Chat can use explicit project context and optional RAG
The system SHALL let a member select project-scoped context records and toggle knowledge retrieval per message.

#### Scenario: Member sends selected context
- **WHEN** a member sends a message with selected project context
- **THEN** the backend MUST validate that every selected context belongs to the project and MUST include only validated context in the backend-owned model call.

#### Scenario: Member toggles RAG
- **WHEN** a member sends a message with RAG enabled
- **THEN** the backend MUST run project-scoped knowledge retrieval when available and MUST persist source attribution that can be shown with the assistant response; if retrieval infrastructure is unavailable, chat MUST continue with a failed retrieval activity and no source leakage.

### Requirement: Chat shows internal tool/activity records
The system SHALL persist and expose chat activity records for backend-owned context loading, RAG retrieval, and generated-artifact persistence.

#### Scenario: Member views a response with activities
- **WHEN** a response used selected context, RAG retrieval, or artifact persistence
- **THEN** the UI MUST show the corresponding activity records without exposing provider credentials or secret payloads.

### Requirement: Chat generated outputs are persisted
The system SHALL persist generated assistant outputs as addressable project-scoped artifacts linked to the chat session and message.

#### Scenario: Assistant response is generated
- **WHEN** the backend stores an assistant response
- **THEN** it MUST store a generated artifact record containing the response summary/content and link it to the session, message, actor, and project.

### Requirement: Chat interactions are audited and secrets-free
The system SHALL audit chat session events (actor, provider, project, timestamp, outcome) and MUST NOT persist or log provider credentials or raw secrets.

#### Scenario: Chat session is audited
- **WHEN** a member sends a message and receives a response
- **THEN** the system MUST record an audit event linking actor, project, provider, and timestamp, and MUST NOT include provider credentials in the audit entry, logs, or persisted message payloads.
