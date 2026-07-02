## Why

The team wants to build an AI-assisted automated testing platform inspired by the high-level workflows of WHartTest while changing the technical architecture and product skin. This needs to be recorded as a clean-room rebuild so planning, implementation, and future code generation do not accidentally copy upstream protected expression.

## What Changes

- Establish a new product direction for an AI testing platform built from independent requirements, UI, code, data model, and architecture.
- Select a fixed TypeScript-first architecture: Nuxt 3, Vue 3, TypeScript, Tailwind CSS, shadcn-vue, Electron desktop shell, NestJS backend, PostgreSQL, Redis, LangChain.js, LangGraph.js, MCP TypeScript SDK, and Playwright workers.
- Define a strict MVP scope around project management, test case management, AI test case generation, Electron local Playwright worker execution, and execution records with screenshots, logs, and trace artifacts.
- Include complete knowledge base/RAG and complete Skills store as required product capabilities after the MVP foundation is stable.
- Treat enterprise WeChat, complex RBAC, full document editor, full MCP administration, distributed UI execution, and broader automation suites as non-goals for this change.
- Add governance requirements to avoid copying WHartTest source code, images, Logo, copy, styles, visual assets, brand identity, documentation prose, prompts, exact layouts, or API implementation details.

## MVP

- Project management.
- Test case management.
- AI-generated test cases.
- Electron local Playwright worker.
- Execution records, screenshots, logs, and trace artifacts.

## Required Post-MVP Capabilities

- Complete knowledge base/RAG system.
- Complete Skills store.

## Non-Goals

- Do not implement enterprise WeChat.
- Do not implement complex RBAC.
- Do not reuse WHartTest source code, images, Logo, copy, styles, UI assets, prompts, or documentation text.

## Capabilities

### New Capabilities

- `clean-room-rebuild`: Covers provenance, license-risk controls, and rules for using WHartTest only as product research.
- `web-ui`: Covers the Nuxt 3, Vue 3, TypeScript, Tailwind CSS, and shadcn-vue interface.
- `platform-foundation`: Covers users, authentication, project management, simple project roles, model configuration, and operational foundations.
- `backend-ai-orchestration`: Covers NestJS-hosted LangGraph workflows, LangChain model/tool adapters, and MCP integration boundaries.
- `test-asset-management`: Covers functional test case modules, cases, steps, execution records, screenshots, logs, trace artifacts, and reports.
- `ai-test-generation`: Covers LangChain/LangGraph-based generation, review, optimization, streaming progress, and human approval.
- `knowledge-rag`: Covers complete project knowledge base, document ingestion, chunking, embeddings, retrieval, source attribution, and AI context injection.
- `skills-store`: Covers complete Skills packaging, publishing, installing, updating, permission review, and runtime integration.
- `automation-workers`: Covers the Electron local Playwright worker and worker-to-backend communication.
- `desktop-app`: Covers Electron desktop packaging, secure native bridge boundaries, update behavior, and reuse of the Nuxt UI.

### Modified Capabilities

None. This is a new OpenSpec plan and no existing specs are being changed.

## Impact

- Creates OpenSpec planning artifacts in `openspec/changes/rebuild-ai-test-platform/`.
- Guides future repository creation and implementation choices.
- Introduces likely dependencies: Nuxt 3, Vue 3, TypeScript, Tailwind CSS, shadcn-vue, Electron, NestJS, Prisma, PostgreSQL, Redis, BullMQ, LangChain.js, LangGraph.js, MCP TypeScript SDK, and Playwright.
- Requires future implementation to maintain clean-room records and avoid importing WHartTest code or assets.
