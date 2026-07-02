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
