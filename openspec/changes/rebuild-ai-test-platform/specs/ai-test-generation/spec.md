## ADDED Requirements

### Requirement: AI generates structured test cases from user input

The system SHALL generate structured test cases from requirement text, uploaded context, or existing project knowledge using LangChain.js and LangGraph.js.

#### Scenario: User generates cases from a requirement

- **WHEN** a user submits a requirement and selects a target module
- **THEN** the LangGraph workflow MUST return draft test cases with title, priority, preconditions, steps, and expected results.

### Requirement: AI output requires review before persistence

The system SHALL let users review, edit, accept, or reject generated test cases before they become canonical project assets.

#### Scenario: User reviews generated cases

- **WHEN** AI generation completes
- **THEN** the system MUST display draft results and MUST NOT persist them as approved cases until the user confirms.

### Requirement: AI workflows expose progress and trace metadata

The system SHALL stream workflow progress and persist trace metadata for debugging and quality review.

#### Scenario: Generation is running

- **WHEN** a LangGraph generation job is in progress
- **THEN** the frontend MUST show current stage, partial output when available, and final success or failure state.
