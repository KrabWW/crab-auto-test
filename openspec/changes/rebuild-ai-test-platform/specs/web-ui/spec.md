## ADDED Requirements

### Requirement: Web UI uses Nuxt 3 and Vue 3

The system SHALL implement the web interface using Nuxt 3, Vue 3, and TypeScript.

#### Scenario: Web app is bootstrapped

- **WHEN** the frontend application is initialized
- **THEN** it MUST use Nuxt 3 with Vue 3 single-file components and TypeScript.

### Requirement: UI styling uses Tailwind and shadcn-vue

The system SHALL use Tailwind CSS and shadcn-vue as the primary styling and component foundation.

#### Scenario: User opens the main dashboard

- **WHEN** the dashboard is rendered
- **THEN** layout, controls, dialogs, tables, and forms MUST be composed from first-party Vue components and shadcn-vue primitives styled with Tailwind CSS.

### Requirement: Web UI provides primary testing workflows

The web UI SHALL support project navigation, test case management, AI generation review, API automation, knowledge context, execution reports, and settings.

#### Scenario: Project member uses the web UI

- **WHEN** a project member signs in
- **THEN** the user MUST be able to access project-scoped testing workflows from the Nuxt application shell.

#### Scenario: Project member reviews the project workspace

- **WHEN** a project member opens the project overview
- **THEN** the UI MUST present a project-scoped workspace summary with testing assets, automation, execution, knowledge, AI, MCP, and skills signals plus quick routes into the primary workflows.

#### Scenario: Project member follows the requirement-first workspace route

- **WHEN** a project member opens the project list, creates a new project, or opens a project overview
- **THEN** Requirements MUST be the first project workspace step, new projects MUST land on Requirements, and the overview MUST show the route from requirement intake, review, and approval through AI case generation, case management, suite execution, and execution report evidence.

#### Scenario: Project workspace data is partially unavailable

- **WHEN** workspace summary data cannot be loaded
- **THEN** the UI MUST show a visible recovery state and MUST NOT silently present stale or cross-project counts.
