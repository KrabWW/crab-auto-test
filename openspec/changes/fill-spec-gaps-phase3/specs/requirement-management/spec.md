## ADDED Requirements

> Clean-room provenance: requirement-management is described against the general industry pattern of draft → reviewed → approved entity workflows with versioned linkage. The owner-only approval and versioned requirement→case linkage are independent design choices; no upstream requirement entity, review DSL, prompt, or UI layout is reused.

### Requirement: Requirements are managed project-scoped entities
The system SHALL manage requirements as first-class project-scoped entities with title, content, status, and version.

#### Scenario: Requirement is created as a draft
- **WHEN** a project member creates a requirement
- **THEN** the system MUST persist it in draft status, scoped to the project, and MUST surface it in the project requirement list.

### Requirement: Requirements follow a review and approval workflow using simple roles
The system SHALL transition requirements through draft -> reviewed -> approved using only existing owner/member roles, with no new permission matrix, and MUST audit every transition.

#### Scenario: Owner approves a reviewed requirement
- **WHEN** a project owner approves a requirement in reviewed status
- **THEN** the system MUST transition it to approved, MUST record an audit event (actor, project, requirement, transition, timestamp), and MUST NOT require any role beyond owner/member.

#### Scenario: Member cannot approve
- **WHEN** a non-owner member attempts to approve a requirement
- **THEN** the system MUST reject the transition and MUST NOT introduce a custom reviewer/approver role to satisfy it.

### Requirement: Approved requirements link to generated test cases
The system SHALL allow only approved requirements to be selected as AI generation input and MUST link generated test cases back to the requirement version used.

#### Scenario: Approved requirement feeds AI generation
- **WHEN** a member selects an approved requirement as the input for AI test generation
- **THEN** the system MUST use the requirement content as generation input and MUST record a link from each generated draft case to that requirement version.

#### Scenario: Revised requirement preserves prior linkage
- **WHEN** an approved requirement is revised to a new version after cases were generated
- **THEN** previously generated cases MUST retain their link to the original requirement version for traceability.
