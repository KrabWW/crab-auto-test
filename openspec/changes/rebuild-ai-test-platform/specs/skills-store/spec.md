## ADDED Requirements

### Requirement: Skills are packaged with metadata

The system SHALL define a Skill package format with name, version, description, author, compatibility, permissions, entry points, and checksum metadata.

#### Scenario: Skill package is imported

- **WHEN** a user imports a Skill package
- **THEN** the system MUST parse and validate its metadata before making it installable.

### Requirement: Users can browse and install Skills

The system SHALL provide a Skills store where authorized users can browse, install, update, disable, and uninstall Skills.

#### Scenario: User installs a Skill

- **WHEN** an authorized user installs a compatible Skill
- **THEN** the system MUST record the installed version, requested permissions, source, checksum, and installation actor.

#### Scenario: Project user opens Skills management

- **WHEN** a project user opens the Skills management page
- **THEN** the system MUST show installed Skills for that project, including version, validation status, installation state, source, checksum, requested permissions, activated permissions, and recent invocation counts.

#### Scenario: User re-enables a disabled Skill

- **WHEN** a project user enables a disabled Skill installation
- **THEN** the system MUST restore it to the installed state without changing its version, checksum, or approved permissions, and MUST record an audit event.

### Requirement: Skill permissions are reviewed before activation

The system SHALL require explicit permission review before a Skill can be activated for AI workflows or local workers.

#### Scenario: Skill requests filesystem access

- **WHEN** a Skill requests elevated local or backend capabilities
- **THEN** the system MUST display the requested permissions and require approval before activation.

### Requirement: Skills integrate with AI workflows through controlled adapters

The system SHALL expose approved Skills to LangGraph workflows and MCP integrations through controlled adapters rather than arbitrary direct execution.

#### Scenario: AI workflow invokes a Skill

- **WHEN** a LangGraph node invokes an installed Skill
- **THEN** the system MUST enforce the Skill permission policy and record invocation metadata in the workflow trace.

#### Scenario: Project user reviews Skill invocations

- **WHEN** a project user inspects a Skill installation
- **THEN** the system MUST show recent invocation records with adapter, status, permissions used, redacted arguments, redacted result metadata, run reference, worker reference, and invocation time, scoped to the current project.

#### Scenario: Project user runs a controlled Skill test invocation

- **WHEN** a project user runs a test invocation for an installed Skill
- **THEN** the system MUST invoke the selected entry point through the controlled adapter, enforce approved permissions, record the invocation outcome, and refresh the project-scoped invocation list.

### Requirement: Skills can be updated and rolled back

The system SHALL support Skill updates and rollback to a previously installed compatible version.

#### Scenario: Skill update fails validation

- **WHEN** a Skill update fails metadata, checksum, compatibility, or permission validation
- **THEN** the system MUST keep the currently installed version active and report the validation failure.
