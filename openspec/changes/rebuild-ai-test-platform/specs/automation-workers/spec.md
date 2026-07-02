## ADDED Requirements

### Requirement: Electron runs a local Playwright worker

The system SHALL run MVP browser automation through a local Playwright worker managed by the Electron desktop application.

#### Scenario: Execution job starts

- **WHEN** the user starts a test case execution from the Electron app
- **THEN** the local Playwright worker MUST claim the job, execute it locally, and report status without blocking the NestJS API request thread.

### Requirement: Workers enforce execution limits

The system SHALL enforce timeouts, resource limits, network policy, and log redaction for worker-executed jobs.

#### Scenario: Test exceeds timeout

- **WHEN** an execution job exceeds its configured timeout
- **THEN** the worker MUST stop the job and report a timeout failure with available logs.

### Requirement: Worker captures execution artifacts

The Electron local Playwright worker SHALL capture screenshots, logs, and Playwright trace artifacts for execution records.

#### Scenario: Execution fails

- **WHEN** a local Playwright execution fails
- **THEN** the worker MUST upload or register the latest screenshot, relevant logs, and trace artifact metadata with the backend execution record.

### Requirement: Distributed execution is excluded from MVP

The system SHALL NOT implement a distributed Playwright worker fleet in the MVP.

#### Scenario: Worker scope is reviewed

- **WHEN** a task proposes remote worker scheduling or distributed UI execution for MVP
- **THEN** the task MUST be moved to a post-MVP change.
