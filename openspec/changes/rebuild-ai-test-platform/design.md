## Context

WHartTest is an MIT-licensed AI automated testing platform with Vue, Django, LangChain/LangGraph, MCP, knowledge base, API automation, UI automation, and execution modules. The desired project is not a fork or reskin; it is a new product that may learn from the broad category and user workflows but must be implemented independently.

The frontend route is fixed: Nuxt 3, Vue 3, TypeScript, Tailwind CSS, and shadcn-vue. Electron provides the desktop client by wrapping the same Nuxt UI and exposing native capabilities through a narrow typed bridge. NestJS hosts LangChain.js, LangGraph.js, MCP TypeScript SDK clients/servers, WebSocket/SSE endpoints, and background workers.

## Goals / Non-Goals

**Goals:**

- Produce a spec-driven plan for a clean-room AI testing platform rebuild.
- Keep the MVP small enough to ship: project management, test case management, AI-generated test cases, Electron local Playwright worker execution, and execution records with screenshots, logs, and trace artifacts.
- Plan complete knowledge base/RAG and complete Skills store as required post-MVP capabilities.
- Use LangChain.js and LangGraph.js as the primary AI orchestration layer.
- Use Nuxt 3, Vue 3, TypeScript, Tailwind CSS, and shadcn-vue for the web UI.
- Use Electron for the desktop client while reusing the Nuxt UI.
- Keep frontend and backend implementation independent from WHartTest source, assets, naming, and exact UX.
- Choose a TypeScript-first backend architecture that can support MCP and automation workers.

**Non-Goals:**

- Do not implement enterprise WeChat.
- Do not implement complex RBAC.
- Do not reuse WHartTest source code, images, Logo, copy, styles, UI assets, prompts, or documentation text.
- No direct WHartTest fork, code migration, or asset reuse.
- No promise that changing tech stack alone removes MIT attribution obligations if upstream content is copied.
- No first-phase implementation of full online DOCX editor, full MCP administration, API automation suite, or full distributed UI automation cloud.
- No alternate frontend framework track.

## Decisions

### Decision 1: Use Nuxt 3 + Vue 3 + TypeScript + Tailwind + shadcn-vue

The UI stack is Nuxt 3 + Vue 3 + TypeScript + Tailwind CSS + shadcn-vue.

Rationale: The product should stay in the Vue ecosystem. Nuxt gives routing, layouts, server/static deployment options, and a stronger app structure than a plain SPA. shadcn-vue keeps the component approach aligned with Vue and Tailwind.

Alternatives considered:

- Vite + Vue SPA: acceptable for a smaller tool, but Nuxt gives better route/layout conventions and desktop/web reuse structure.

### Decision 2: Use NestJS as the backend application boundary

NestJS should own REST APIs, auth, simple project-scoped roles, job scheduling, model configuration, audit logs, and orchestration endpoints. Complex RBAC is intentionally out of scope for the MVP.

Rationale: NestJS is TypeScript-native and maps well to modular domains such as projects, test cases, AI, API automation, knowledge, and workers. It also avoids carrying Django-specific concepts from WHartTest.

Alternatives considered:

- Django/FastAPI: technically strong but less aligned with the desired TypeScript rewrite.
- Frontend-hosted API routes only: too thin for queue workers, long-running jobs, agent orchestration, and enterprise-style domain modules.

### Decision 3: Use LangChain.js + LangGraph.js for AI workflows

LangGraph should model generation and review as explicit graphs: classify input, retrieve context, draft cases, validate structure, request human approval, persist results, and report trace metadata.

Rationale: The requested AI layer is LangChain/LangGraph. LangGraph gives stateful, observable, interruptible workflows that fit test generation and review.

Alternatives considered:

- Direct OpenAI-compatible SDK only: simpler but weaker for graph state, tools, retries, and future human-in-the-loop flows.

### Decision 4: Use PostgreSQL, Redis, BullMQ, and a replaceable retrieval backend

PostgreSQL stores product data. Redis and BullMQ handle asynchronous AI generation and local worker job coordination. The complete knowledge base/RAG capability is required after the MVP foundation; its retrieval implementation should sit behind an interface so the project can start with pgvector or move to Qdrant without rewriting AI workflows.

Rationale: The MVP should validate the core testing loop first, but full RAG is a required product capability. Keeping retrieval behind an interface avoids coupling LangGraph workflows to a single vector store.

Alternatives considered:

- Hard-code Qdrant or pgvector directly into workflows: rejected because it makes future retrieval changes expensive.
- SQLite: useful for prototypes but not enough for multi-user execution records and background jobs.

### Decision 5: Use an Electron local Playwright worker for MVP execution

The MVP execution path should run Playwright through a local worker managed by the Electron desktop app. The backend owns job records and receives structured logs, screenshots, trace artifacts, status updates, and final execution summaries.

Rationale: Local Playwright execution avoids early distributed worker complexity while still giving users a concrete automation loop: generate or manage test cases, run locally, and inspect screenshots/logs/traces.

Alternatives considered:

- Execute tests inside NestJS request handlers: rejected due to reliability, timeout, and resource isolation risks.
- Implement server-side or distributed worker fleet in MVP: rejected because distributed UI execution is not part of the MVP.

### Decision 6: Use Electron as the desktop shell

Electron should package the Nuxt UI as a desktop client and communicate with the NestJS backend over the same API contracts used by the web app. Native desktop capabilities such as local file selection, secure local config, and optional local worker launch must be exposed through a small preload bridge with context isolation enabled.

Rationale: Electron lets the desktop app share most UI code with the Nuxt web app while still offering desktop distribution and local integration. Keeping native access behind a typed bridge reduces security risk and prevents desktop-only behavior from leaking across the whole UI.

Alternatives considered:

- Tauri: smaller footprint, but Electron has broader Node ecosystem compatibility and simpler integration with TypeScript automation tooling.
- Separate native desktop app: rejected due to duplicated UI and higher implementation cost.
- Browser-only app: rejected because the requested product includes a desktop client.

### Decision 7: Build a complete Skills store as a governed extension system

The product should include a complete Skills store after the MVP foundation. Skills must be packaged with metadata, versioning, permissions, compatibility requirements, install/update/remove flows, and runtime integration points for AI workflows and automation workers.

Rationale: Skills are valuable for extending AI testing behavior, but they create security and compatibility risk. Treating the store as a governed extension system avoids opaque script execution and makes trust decisions visible to users.

Alternatives considered:

- Ad hoc local script folder: rejected because it lacks versioning, permissions, provenance, and review.
- Reusing WHartTest Skills packages: rejected by clean-room constraints.

## Risks / Trade-offs

- Clean-room risk -> Keep a provenance log and do not copy WHartTest source code, images, Logo, copy, styles, UI assets, prompts, or documentation text.
- Scope creep -> Keep enterprise WeChat, complex RBAC, API automation suite, and distributed UI execution out of the MVP; schedule knowledge/RAG and Skills store after the MVP foundation rather than treating them as first-click blockers.
- RAG complexity risk -> Build ingestion, indexing, retrieval, and source attribution behind explicit interfaces and verify retrieval quality before using it for accepted test case generation.
- Skills security risk -> Require metadata, permissions, compatibility checks, install approval, and execution boundaries before a skill can affect AI workflows or workers.
- LangGraph.js maturity variance across features -> Start with simple graph workflows and avoid overfitting the first version.
- Local worker security risk -> Run Playwright with explicit timeouts, isolated browser profiles, artifact size limits, and log redaction.
- Frontend stack drift -> Keep the web UI dependencies limited to Nuxt 3, Vue 3, TypeScript, Tailwind CSS, and shadcn-vue.
- Electron security risk -> Enable context isolation, disable remote module patterns, avoid broad filesystem access, and keep native APIs behind a typed preload bridge.

## Migration Plan

This is a greenfield plan, so there is no code migration. The implementation plan is:

1. Create a new repository with no WHartTest source or assets.
2. Initialize Nuxt 3/Vue 3/Tailwind/shadcn-vue frontend and the NestJS backend.
3. Add Electron packaging that reuses the Nuxt UI.
4. Implement shared domain contracts from OpenSpec requirements.
5. Build the MVP execution path with Electron local Playwright worker support.
6. Add AI generation and report flows.
7. Add complete knowledge base/RAG.
8. Add complete Skills store.
9. Verify clean-room compliance before any public release.

Rollback strategy: because this is greenfield, rollback means reverting feature branches or disabling incomplete modules behind configuration flags.

## Open Questions

- Initial deployment target: local Docker Compose, single VPS, Kubernetes, or managed cloud?
- Target model providers: only OpenAI-compatible APIs, or also local Ollama/Qwen/DeepSeek gateways?
- Required compliance posture: internal-only tool, commercial SaaS, or private enterprise deployment?
- First-class language: Chinese-only, English-only, or bilingual from the start?
- Electron distribution target: Windows only first, or Windows/macOS/Linux from the first release?
