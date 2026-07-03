## ADDED Requirements

### Requirement: API test cases define requests and assertions
The system SHALL let project members define API test cases as an HTTP request (method, URL, headers, body) plus ordered assertions over status code, headers, and body. This capability is Phase-3 gated: in the MVP the web UI exposes only a navigable placeholder route, and full request/assertion authoring is available only once this Phase-3 spec is approved.

#### Scenario: API case is created with assertions
- **WHEN** a member creates an API case with a GET request and a status-equals-200 assertion (Phase 3)
- **THEN** the system MUST persist the request definition and assertions and MUST surface the case alongside functional cases in the project.

#### Scenario: Secrets in requests are stored as references
- **WHEN** a member saves a request header containing a credential
- **THEN** the system MUST store the credential as an encrypted reference (never plaintext) and MUST NOT return the plaintext in any API response.

### Requirement: API executions produce execution records analogous to browser executions
The system SHALL create, for each API case execution, an execution record carrying status, duration, response metadata, and per-assertion results, linked to the project and case, analogous to browser execution records.

#### Scenario: API case execution records assertion outcomes
- **WHEN** a member runs an API case and the response is received
- **THEN** the system MUST create an execution record with overall pass/fail, per-assertion pass/fail, response status, and duration, and MUST link it to the source API case.

#### Scenario: Failing assertion records a redacted response snapshot
- **WHEN** an API case execution fails on an assertion
- **THEN** the system MUST record which assertion failed and a response snapshot with secrets redacted, MUST NOT store raw credentials, and MUST mark the execution record as failed.

### Requirement: API automation supports project environments and extracted variables
The system SHALL let project members define project-scoped API environments, substitute environment variables into requests, extract response values into execution output, and show a run report without exposing stored secret values.

#### Scenario: Environment variables are substituted at run time
- **WHEN** a member runs an API case with a selected environment containing plain and secret variables
- **THEN** the system MUST substitute those variables into the request, MUST decrypt secrets only in process for the outbound request, and MUST keep API responses and run reports masked.

#### Scenario: Response values are extracted into the run report
- **WHEN** an API case defines ordered extraction rules over response headers or body and the response is received
- **THEN** the system MUST evaluate the rules, persist extracted values on the execution record, and surface them in the run report linked to that execution.

#### Scenario: Environment changes do not rewrite historical executions
- **WHEN** a member edits or deletes an environment after an API execution has completed
- **THEN** historical execution records and reports MUST remain readable with their original assertion results, extracted variables, and redacted response snapshot.

### Requirement: API automation respects secrets-as-references and clean-room
The system SHALL treat API automation as an independent clean-room capability and MUST NOT reuse upstream API-automation source, prompts, assertion DSLs, or exact UI layouts; all credentials MUST be envelope-encrypted references.

#### Scenario: Clean-room review of API automation
- **WHEN** the API automation module is submitted for release
- **THEN** a clean-room review MUST confirm no upstream API-automation code, DSL, or asset was copied and MUST record a provenance note describing the independent implementation approach.
