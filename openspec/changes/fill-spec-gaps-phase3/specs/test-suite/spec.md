## ADDED Requirements

> Clean-room provenance: test-suite is described against the general industry pattern of ordered test-case grouping and per-case result roll-up. The self-contained SuiteRun design (holding an execution-record ID list) is an independent implementation choice that avoids coupling to test-asset-management; no upstream suite/run data model, schema, or layout is reused.

### Requirement: Suites group ordered test cases
The system SHALL let project members create project-scoped test suites that hold an ordered membership of existing test cases.

#### Scenario: Suite is created with ordered cases
- **WHEN** a project member creates a suite and adds existing test cases in a chosen order
- **THEN** the system MUST persist the suite with its ordered case membership and MUST surface it in the project suite list.

#### Scenario: Suite membership edit preserves past runs
- **WHEN** a member removes a case from a suite after a prior suite run
- **THEN** the prior suite run and its per-case execution records MUST remain intact and queryable.

### Requirement: Suite execution rolls up per-case results
The system SHALL execute a suite by running each member case and aggregating per-case outcomes into a single suite-level summary.

#### Scenario: Suite run aggregates per-case pass/fail
- **WHEN** a member runs a suite and all member cases finish
- **THEN** the system MUST create one suite run with a rolled-up status (passed only if every case passed; failed if any case failed) and MUST expose per-case pass/fail, failed step, and duration in the summary.

#### Scenario: Partial suite run records which cases ran
- **WHEN** a suite run is aborted mid-execution
- **THEN** the system MUST mark the suite run as aborted and MUST record which cases completed and which did not.

### Requirement: Suite runs reuse the execution-record and artifact model
The system SHALL create, for each case run inside a suite, an execution record consistent with the existing execution-record model, and SHALL link each such record to a self-contained suite-run entity that holds the list of execution-record identifiers, WITHOUT adding a foreign key to test-asset-management.

#### Scenario: Per-case artifacts are captured under a suite run
- **WHEN** a case runs as part of a suite and captures screenshots, logs, or trace artifacts
- **THEN** those artifacts MUST be registered against the case's execution record and MUST be reachable from the suite run summary via the suite-run's execution-record list.
