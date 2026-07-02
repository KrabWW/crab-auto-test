## ADDED Requirements

### Requirement: Upstream use is limited to product research

The project SHALL use WHartTest only as high-level product and competitive research, not as source material for source code, images, Logo, copy, styles, UI assets, prompts, documentation text, or exact user interface expression.

#### Scenario: Developer references upstream repository

- **WHEN** a developer reviews WHartTest during planning
- **THEN** the resulting implementation notes MUST describe independent product intent and MUST NOT copy source code, images, Logo, copy, styles, file structure, screenshots, prompts, prose, or exact UI layout.

### Requirement: New repository starts without upstream source

The implementation repository SHALL be initialized without importing WHartTest source files, images, Logo, copy, styles, package metadata, database migrations, generated bundles, prompts, or documentation.

#### Scenario: Initial repository is created

- **WHEN** the new product repository is initialized
- **THEN** it MUST contain only newly generated scaffolding, first-party code, first-party assets, and approved third-party dependencies.

### Requirement: Non-goals are enforced during planning

The project SHALL treat enterprise WeChat and complex RBAC as explicit non-goals for this change, while complete knowledge base/RAG and complete Skills store remain required planned capabilities.

#### Scenario: Scope review occurs

- **WHEN** a proposed task adds enterprise WeChat or complex RBAC
- **THEN** the task MUST be rejected or moved to a post-MVP change.

### Requirement: Provenance is recorded for risky references

The project SHALL maintain notes for major design inputs that could create license or originality risk.

#### Scenario: Feature is inspired by an external system

- **WHEN** a feature is based on observation of WHartTest or another product
- **THEN** the project MUST record the observed user need and the independent implementation approach before coding begins.
