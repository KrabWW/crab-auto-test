## ADDED Requirements

### Requirement: Users can manage functional test cases

The system SHALL support project-scoped modules, test cases, test steps, expected results, priority, status, tags, and notes.

#### Scenario: User creates a test case

- **WHEN** a project member creates a test case under a module
- **THEN** the system MUST persist the case with ordered steps and make it visible in the project test case list.

### Requirement: Execution records are linked to assets

The system SHALL link execution results to the related project, test case, step, environment, screenshots, logs, trace artifacts, and report summary.

#### Scenario: Test case execution finishes

- **WHEN** a test case execution completes
- **THEN** the system MUST show pass/fail state, failed steps, screenshots, logs, trace artifact links, duration, and links back to the source test case.

### Requirement: Execution artifacts are retained

The system SHALL retain screenshots, logs, and Playwright trace artifacts for each local Playwright execution.

#### Scenario: Playwright execution captures artifacts

- **WHEN** the Electron local Playwright worker finishes an execution
- **THEN** the system MUST store artifact metadata and make screenshots, logs, and trace files visible from the execution record.
