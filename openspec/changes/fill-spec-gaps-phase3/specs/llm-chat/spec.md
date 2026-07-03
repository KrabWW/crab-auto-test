## ADDED Requirements

> Clean-room provenance: llm-chat is described against the general industry pattern of backend-owned conversational LLM sessions with audit and secrets-free logging. The session-level scoping (no tool-calling/multi-step) is an independent design choice that keeps it outside backend-ai-orchestration's multi-step workflow scope; no upstream chat session model, prompt, or UI layout is reused.

### Requirement: Users can chat over configured model providers via backend orchestration
The system SHALL let project members hold interactive, single-turn-or-conversational chat sessions over a model provider configured in platform-foundation, with the LLM call made exclusively by the NestJS backend. Chat is conversational-only (no tool-calling, no multi-step state, no human-approval gating) and therefore is not in scope of backend-ai-orchestration's multi-step workflow requirement.

#### Scenario: Member sends a chat message
- **WHEN** a member sends a message in a chat session bound to a configured provider
- **THEN** the backend MUST make the LLM call and MUST stream the response to the client over the shared streaming contract; the client MUST NOT call the LLM directly.

#### Scenario: Chat is inaccessible without a configured provider
- **WHEN** no model provider is configured for the selected kind
- **THEN** the system MUST prevent starting a chat session and MUST surface a clear reason to the user.

### Requirement: Chat sessions are persisted
The system SHALL persist chat sessions and their messages so members can reopen and continue them.

#### Scenario: Member reopens a session
- **WHEN** a member reopens an existing chat session
- **THEN** the system MUST load prior messages in order and MUST allow new messages to be appended to the same session.

### Requirement: Chat interactions are audited and secrets-free
The system SHALL audit chat session events (actor, provider, project, timestamp, outcome) and MUST NOT persist or log provider credentials or raw secrets.

#### Scenario: Chat session is audited
- **WHEN** a member sends a message and receives a response
- **THEN** the system MUST record an audit event linking actor, project, provider, and timestamp, and MUST NOT include provider credentials in the audit entry, logs, or persisted message payloads.
