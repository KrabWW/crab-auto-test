## ADDED Requirements

### Requirement: Users can authenticate and access scoped projects

The system SHALL allow users to sign in and access only projects they own or have been invited to.

#### Scenario: Project member opens a project

- **WHEN** an authenticated project member opens a project dashboard
- **THEN** the system MUST show that project data and MUST NOT expose data from unrelated projects.

### Requirement: Project roles stay simple

The system SHALL support only simple project-scoped roles needed for the MVP and MUST NOT implement complex RBAC.

#### Scenario: Project member is assigned

- **WHEN** a user is added to a project
- **THEN** the system MUST assign a simple project role such as owner or member and MUST NOT require custom permission matrices.

### Requirement: Admins can configure model providers

The system SHALL allow authorized users to configure OpenAI-compatible model providers for chat, generation, and embeddings.

#### Scenario: Admin adds a model provider

- **WHEN** an admin saves a provider base URL, model name, and credential reference
- **THEN** the system MUST validate the configuration and make it selectable by AI workflows.

### Requirement: Operations are auditable

The system SHALL record important user and automation operations with actor, project, action, target, timestamp, and outcome.

#### Scenario: Test case is generated

- **WHEN** an AI workflow creates test cases in a project
- **THEN** the system MUST record an audit event linking the user, project, workflow run, and created test cases.
