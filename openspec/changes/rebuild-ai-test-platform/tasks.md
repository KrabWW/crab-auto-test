## 1. Product And Governance

- [ ] 1.1 Decide final product name, positioning, and visual direction independent from WHartTest.
- [ ] 1.2 Create a clean-room provenance log template for external product references.
- [ ] 1.3 Define MVP personas, primary workflows, and acceptance criteria.
- [ ] 1.4 Document Nuxt 3, Vue 3, TypeScript, Tailwind CSS, shadcn-vue, Electron, NestJS, LangGraph, and MCP as the fixed architecture.

## 2. Architecture Bootstrap

- [ ] 2.1 Create a new repository without importing WHartTest files or assets.
- [ ] 2.2 Initialize the Nuxt 3 frontend with Vue 3, TypeScript, Tailwind CSS, and shadcn-vue.
- [ ] 2.3 Initialize the NestJS backend with Fastify, configuration, validation, and logging.
- [ ] 2.4 Add Prisma, PostgreSQL, Redis, and BullMQ development infrastructure.
- [ ] 2.5 Define shared API contracts and error response conventions.
- [ ] 2.6 Add Electron app shell that loads the Nuxt UI for desktop development.
- [ ] 2.7 Add backend AI orchestration module boundaries for LangGraph workflows, LangChain adapters, and MCP integrations.

## 3. Platform Foundation

- [ ] 3.1 Implement authentication, sessions or JWT, and current-user APIs.
- [ ] 3.2 Implement project CRUD, simple owner/member project roles, and scoped authorization.
- [ ] 3.3 Implement model provider configuration with encrypted credential storage or secret references.
- [ ] 3.4 Implement audit logging for project and AI operations.

## 4. Test Asset MVP

- [ ] 4.1 Implement module tree, functional test case, and test step data models.
- [ ] 4.2 Build test case list, detail, create, edit, and bulk import/export flows.
- [ ] 4.3 Implement execution record models linked to project, test case, step, status, duration, screenshots, logs, and trace metadata.
- [ ] 4.4 Build execution record and report screens with screenshots, logs, and trace artifact links.

## 5. AI Generation

- [ ] 5.1 Add LangChain.js model adapters for OpenAI-compatible providers.
- [ ] 5.2 Build a LangGraph workflow for requirement-to-test-case generation.
- [ ] 5.3 Add structured output validation for generated test cases.
- [ ] 5.4 Add streaming progress over SSE or WebSocket.
- [ ] 5.5 Add review, edit, accept, and reject UI for AI-generated drafts.
- [ ] 5.6 Add MCP TypeScript SDK integration for approved tool calls inside LangGraph workflow nodes.
- [ ] 5.7 Persist workflow run metadata, graph stage events, and MCP tool call traces.

## 6. Electron Local Playwright Worker

- [ ] 6.1 Define local worker protocol for job claim, heartbeat, logs, result events, screenshots, and trace artifacts.
- [ ] 6.2 Implement Electron-managed Playwright worker startup, health check, stop, and restart.
- [ ] 6.3 Implement local Playwright execution for MVP test cases.
- [ ] 6.4 Add worker timeout, isolated browser profile, artifact size limits, and log redaction controls.
- [ ] 6.5 Persist screenshots, logs, and trace metadata back to backend execution records.

## 7. Knowledge Base And RAG

- [ ] 7.1 Implement project-scoped knowledge base and document models.
- [ ] 7.2 Implement document upload, text extraction, chunking, and source metadata storage.
- [ ] 7.3 Implement embedding generation and a retrieval backend interface.
- [ ] 7.4 Implement semantic retrieval with source attribution for LangGraph workflows.
- [ ] 7.5 Add retrieval diagnostics showing query, matched chunks, scores, and selected sources.

## 8. Skills Store

- [ ] 8.1 Define Skill package metadata, versioning, compatibility, permissions, entry points, and checksum format.
- [ ] 8.2 Build Skills store browse, import, install, update, disable, uninstall, and rollback flows.
- [ ] 8.3 Add permission review and activation approval before a Skill can affect workflows or workers.
- [ ] 8.4 Integrate approved Skills with LangGraph workflows and MCP adapters through controlled invocation boundaries.
- [ ] 8.5 Record Skill installation, update, approval, and invocation audit events.

## 9. Desktop App

- [ ] 9.1 Configure Electron main, preload, and renderer integration around the Nuxt UI.
- [ ] 9.2 Implement typed preload bridge for approved native capabilities.
- [ ] 9.3 Add backend endpoint configuration for local, staging, and production targets.
- [ ] 9.4 Add desktop packaging scripts for the first target OS.
- [ ] 9.5 Add desktop smoke tests for login, project open, AI generation, local Playwright execution, and report viewing.

## 10. Verification And Release

- [ ] 10.1 Add unit tests for domain services and project authorization boundaries.
- [ ] 10.2 Add integration tests for AI generation job lifecycle, local Playwright execution artifact capture, RAG retrieval, and Skill invocation boundaries.
- [ ] 10.3 Add Nuxt frontend smoke tests for primary MVP workflows, knowledge base workflows, and Skills store workflows.
- [ ] 10.4 Run clean-room review before release to verify no copied WHartTest source code, images, Logo, copy, styles, UI assets, prompts, or prose.
- [ ] 10.5 Prepare Docker Compose deployment and production hardening checklist.
