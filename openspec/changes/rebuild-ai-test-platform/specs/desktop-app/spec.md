## ADDED Requirements

### Requirement: Desktop app reuses the Nuxt UI

The system SHALL provide an Electron desktop application that reuses the Nuxt 3 Vue UI rather than implementing a separate desktop interface.

#### Scenario: Desktop app opens the main workspace

- **WHEN** a user launches the Electron app
- **THEN** the app MUST display the same primary project, test case, AI generation, and report workflows as the web UI.

### Requirement: Native desktop access is isolated

The Electron application SHALL expose native capabilities only through a narrow typed preload bridge with context isolation enabled.

#### Scenario: UI requests a local file

- **WHEN** the Vue UI needs a local file selected from disk
- **THEN** it MUST call an approved bridge method and MUST NOT access Node.js or filesystem APIs directly from the renderer.

### Requirement: Desktop app uses backend API contracts

The Electron application SHALL communicate with the NestJS backend through the same API, streaming, and authentication contracts as the web application.

#### Scenario: Desktop user starts AI generation

- **WHEN** a desktop user starts an AI test generation workflow
- **THEN** the desktop app MUST send the request through the backend API and display streamed LangGraph progress using the shared frontend client.

### Requirement: Desktop app manages local Playwright worker

The Electron application SHALL start, monitor, and stop the local Playwright worker used by MVP test execution.

#### Scenario: User runs a test case locally

- **WHEN** a user starts a test case execution from the desktop app
- **THEN** Electron MUST coordinate the local Playwright worker and display execution status, screenshots, logs, and trace availability.

### Requirement: Desktop packaging supports environment configuration

The Electron application SHALL support configurable backend endpoints for local, staging, and production environments.

#### Scenario: User switches to a private deployment

- **WHEN** a desktop user configures a private backend endpoint
- **THEN** the app MUST store the endpoint safely and use it for subsequent authenticated requests.
