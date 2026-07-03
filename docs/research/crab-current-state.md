# crab-auto-test — Current State & OpenSpec Completeness Inventory

> Worker-3 read-only inventory (task #3). Base: `D:\code\normal\RJ-CLI\crab-auto-test`.
> Scope: crab-auto-test's OWN code + OpenSpec. `WHartTest/` and `WHartTest-upstream/` deliberately excluded.
> Source of truth referenced throughout: `openspec/changes/rebuild-ai-test-platform/` (the sole binding OpenSpec change).

---

## 1. Repo / Architecture Overview

**Monorepo layout** (pnpm workspace, `pnpm@8.15.9`, Node ≥20, turbo orchestration):

- `apps/web/` — Nuxt 3 SPA (`@crab/web`). Vue 3 + TypeScript + Tailwind + shadcn-vue (radix-vue primitives) + Pinia. `nuxt.config.ts` sets `ssr` toggleable via `CRAB_WEB_SPA` (R6 desktop reuse).
- `apps/desktop/` — Electron (`@crab/desktop`). `src/{main,preload,renderer,worker}`. esbuild-bundled to `dist-electron`. Playwright runtime for local worker.
- `services/api/` — NestJS + Fastify (`@crab/api`). All LLM/LangGraph/MCP orchestration lives here. Prisma client + PostgreSQL.
- `packages/shared-types/` — types-only contracts (DTO / StreamEnvelope / WorkerJob / BridgeApi / error codes). No runtime.
- `packages/config/` — shared tsconfig / eslint / tailwind preset.
- `infra/ci/` — 5 binary gate scripts (`.mjs`): `r7-import-scan`, `f8-drift-scan`, `clean-room-scan`, `secret-scan`, `skill-adapter-scan`.
- `docker-compose.yml` — local Postgres (pgvector/pgvector:pg16, user/pass/db `crab`, port 5432).
- `.github/workflows/ci.yml` — CI: install → prisma migrate deploy → seed → typecheck → build → unit tests → 5 gates.
- Root docs: `AGENTS.md` (runbook, last-updated for commit `623e3b1`), `MVP-FINISH-PLAN.md`, `PHASE2-PLAN.md`, `prompt.md`, `待执行的提示词文件.md`.

**Fixed tech stack** (per `openspec/config.yaml` context + proposal/design): Nuxt3 / Vue3 / TS / Tailwind / shadcn-vue / Electron / NestJS / Prisma / PostgreSQL / LangChain.js / LangGraph.js / MCP TS SDK / Playwright. CI uses pgvector image so RAG migrations run in CI.

**Git state**: branch `main`, clean. Only 2 commits: `c5827ae Bootstrap clean-room AI test platform` + `39e759d Add web auth flow and e2e coverage`. The bootstrap commit clearly landed the full monorepo + MVP + Phase 2 code in one shot (skeleton + Phase 2 modules present), then an auth/e2e follow-up. The AGENTS.md "commit 623e3b1" reference is stale relative to actual history.

---

## 2. OpenSpec Inventory

### Change proposal status

- Change id: `rebuild-ai-test-platform`. `openspec validate rebuild-ai-test-platform` → **`Change 'rebuild-ai-test-platform' is valid`**.
- `openspec show` reports **40 deltas** (all `ADDED`), across **10 capabilities**.
- Tasks: **0/51 complete** (`openspec list` shows `0/51 tasks`). All 51 task checkboxes in `tasks.md` are unchecked `[ ]`.
- **NOT archived**: `openspec/changes/archive/` is empty and `openspec/specs/` is empty. This is the "single unarchived change" state — MODIFIED deltas against it are structurally illegal (V-c rationale).

### Spec area inventory (each: specced? implemented? gaps/TODOs?)

| Capability | Reqs specced | Implemented? | Notes |
|---|---|---|---|
| `platform-foundation` | 4 (auth+scoped projects; simple roles; model provider config; audit) | ✅ Implemented | `auth/`, `projects/`, `model-providers/`, `audit/` modules + Prisma models. R3 worker-token in `auth/worker-token.service.ts`. R5 envelope encryption in `infra/crypto/`. Seed admin in `prisma/seed.ts`. |
| `web-ui` | 3 (Nuxt3+Vue3+TS; Tailwind+shadcn-vue; primary testing workflows) | ✅ Implemented (MVP slice) | Nuxt3 SPA, Tailwind, shadcn-vue (button/card/input only — minimal primitive set). Routes: login, projects list/detail, test-cases, ai-generation, executions, settings, knowledge, **`/api-automation` placeholder** (MUST-3). `nuxt.config.ts` loads `@arco-design/web-vue` plugin too (mixed: shadcn-vue + arco). |
| `backend-ai-orchestration` | 4 (NestJS owns AI; LangGraph models workflows; MCP backend-managed; streamable) | ✅ Implemented (MVP + P2) | `ai-orchestration/` service is a **state-machine, not a durable LangGraph graph** (R1: no checkpointer — explicit). Real LLM via `@langchain/openai` `withStructuredOutput` (B1). SSE stream `GET /ai/runs/:runId/stream` + snapshot `GET .../snapshot` (R8). P2 MCP node + Skill adapter node added as best-effort enrichment steps. |
| `ai-test-generation` | 3 (generate structured cases; review-before-persist; progress+trace) | ✅ Implemented | `startGeneration` → context-retrieval (RAG P2) → draft (LLM) → validate (bounded retry, MUST-2) → MCP/Skill enrichment (P2) → `awaiting-approval` soft stop → `accept` persists canonical (idempotent by runId+title, MUST-1). Deterministic fallback `draftFromRequirement` when no provider. |
| `test-asset-management` | 3 (modules/cases/steps; execution records linked; artifacts retained) | ✅ Implemented | `test-assets/` (modules tree, cases, ordered steps) + `executions/` (records + artifacts). Prisma models for Module/TestCase/TestStep/TestExecution/ExecutionArtifact. |
| `knowledge-rag` | 5 (KB CRUD; ingest+chunk; embed+retrievable; RAG w/ attribution; diagnostics) | ✅ Implemented (Phase 2) | `knowledge/` module + `infra/retrieval/` (RetrievalBackend interface + pgvector adapter + stub). Raw-SQL pgvector migration (`1_phase2_init`) with hnsw/ivfflat. Embeddings via configured `embeddings` provider, hash-stub fallback. Source attribution injected into `WorkflowStageEvent.sourceAttribution`. Diagnostics endpoint `POST /retrieval/query`. |
| `skills-store` | 5 (packaged w/ metadata; browse/install; permission review; controlled adapters; update+rollback) | ✅ Implemented (Phase 2) | `skills/` module + `skill-adapter.service.ts`. Checksum validation before install; failed-validation keeps current (no half-state); `previousVersionId` rollback pointer; `permissions/approve`; `SkillInvocation` audit. CI `skill-adapter-scan.mjs` enforces no eval/vm/dynamic-require. |
| `automation-workers` | 4 (Electron local Playwright worker; execution limits; artifact capture; distributed excluded) | ✅ Implemented | `apps/desktop/src/worker/index.ts` real Playwright engine: isolated ephemeral profile, hard timeout, network egress policy, screenshot+trace capture, redaction, artifact size limits. Polling-claim transport (REST, not WS — declared MVP simplification preserving R2 redelivery semantics). |
| `desktop-app` | 5 (reuse Nuxt UI; isolated native bridge; backend API contracts; manage worker; env config) | ✅ Implemented | Electron main/preload/renderer. `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`. Typed `crabBridge` allowlist (worker/backend/execution). `safeStorage` for endpoint profile. `isolation-check.cjs` self-test asserts renderer has no Node globals + exact bridge surface. |
| `clean-room-rebuild` | 4 (upstream = research only; new repo no upstream source; non-goals enforced; provenance) | ✅ Enforced via CI | `infra/ci/clean-room-scan.mjs` gate runs in CI. `WHartTest*` excluded from pnpm workspace globs. No upstream code/assets observed in crab-auto-test sources. |

### OpenSpec spec sections that are empty / TODO

- **None of the 10 capability specs are empty or TODO.** All 10 `specs/*/spec.md` files contain `## ADDED Requirements` with concrete WHEN/THEN scenarios (verified via grep — no `TODO/FIXME/placeholder/TBD` markers inside the spec files themselves).
- `tasks.md` (51 tasks): **all checkboxes unchecked** `[ ]` — i.e., OpenSpec task tracking has not been toggled to reflect the code that was actually written. This is a bookkeeping gap, not a spec gap.
- **Phase 3 capabilities have NO spec yet** (test-suite, api-automation, requirement-management, llm-chat, mcp-admin). Their planned requirements exist only as **prose drafts inside `PLAN-SPECFILL.md`** (15 requirements, 5 caps), NOT as committed `specs/<cap>/spec.md` files. This is the intended spec-first gate (V-c: second change `fill-spec-gaps-phase3` to be written later).

---

## 3. Current Implemented Capabilities

### Backend API surface (`services/api`, NestJS, global prefix `/api/v1`)

12 modules registered in `app.module.ts` (8 MVP + 4 Phase 2 + 3 infra):

| Module | Stage | Representative routes |
|---|---|---|
| `auth` | M | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` (+ worker-token service) |
| `projects` | M | `GET/POST /projects`, `GET/PATCH /projects/:id`, `GET/POST /projects/:id/members` |
| `model-providers` | M | `GET/POST /model-providers`, `POST /model-providers/:id/validate` (R5: never returns secret) |
| `audit` | M | `GET /audit` |
| `test-assets` | M | `GET/POST /projects/:id/modules`, `GET/POST/GET /projects/:id/test-cases[/:id]` |
| `executions` | M | `POST/GET /projects/:id/executions`, `GET /executions/:id`, `GET /executions/:id/snapshot` |
| `worker-gateway` | M | `POST /worker/jobs/claim`, `/jobs/:id/{ack,heartbeat,result,artifacts,logs}` (R2 redelivery + R3 ownership) |
| `ai-orchestration` | M core / P2 nodes | `POST /projects/:id/ai/test-generation`, `GET /ai/runs/:id`, `GET /ai/runs/:id/snapshot`, `GET /ai/runs/:id/stream` (SSE), `POST /ai/runs/:id/approve`, `POST /ai/runs/:id/reject` |
| `knowledge` | P2 | `GET/POST /projects/:id/knowledge-bases`, `GET/POST /projects/:id/knowledge-bases/:kbId/documents`, `POST /projects/:id/retrieval/query`, `GET /projects/:id/retrieval` |
| `skills` | P2 | `GET /projects/:id/skills`, `POST /skills/install`, `POST /skills/:id/{permissions/approve,disable,uninstall,rollback}` |
| `mcp` | P2 mechanism | `GET/POST /projects/:id/mcp/allowlist`, `GET /projects/:id/ai/runs/:runId/tool-calls`, `POST /projects/:id/mcp/invoke` (project-scoped allowlist, McpToolCall audit) |
| infra | — | `prisma`, `crypto` (envelope), `streaming` (snapshot service), `retrieval` (interface+pgvector+stub) |

### Frontend pages/routes (`apps/web`)

- `/auth/login` (login page)
- `/` → redirects to `/projects`
- `/projects` (list)
- `/projects/[id]` (project shell, layout)
- `/projects/[id]/test-cases`
- `/projects/[id]/ai-generation`
- `/projects/[id]/executions`
- `/projects/[id]/knowledge` (P2 KB UI)
- `/projects/[id]/settings`
- `/projects/[id]/api-automation` (**placeholder only** — "planned for a later phase", MUST-3)
- Layouts: `default.vue`, `auth.vue`. Composables: `api.ts`, `useSession.ts`, `useTheme.ts`.
- shadcn-vue primitives installed: button, card, input only (3 of the planned Button/Input/Table/Card/Dialog set — Table/Dialog not present).

### Packages

- `shared-types`: 11 source modules (ai, audit, auth, bridge, error, execution, model-provider, project, stream, test-asset, worker) — types-only.
- `config`: tailwind preset + tsconfig/eslint.

### Infra

- `docker-compose.yml`: pgvector/pgvector:pg16, `crab-postgres`, volume `crab-pgdata`.
- `infra/ci/`: 5 binary gate scripts (r7-import-scan, skill-adapter-scan, f8-drift-scan, clean-room-scan, secret-scan).
- `.github/workflows/ci.yml`: full pipeline incl. pgvector service container, prisma migrate deploy, seed, typecheck, build, unit tests, 5 gates.
- Prisma migrations: `0_init` (MVP foundation+assets+AI) + `1_phase2_init` (KB/RAG raw pgvector SQL + Skills + MCP allowlist/McpToolCall).

---

## 4. Test Coverage

### Backend unit tests (`services/api/test/`, vitest) — 6 files

| File | ID | What it covers |
|---|---|---|
| `envelope.spec.ts` | U-PROV-DECRYPT (R5/SEC-CRED-2/4) | Envelope round-trip; ciphertext excludes plaintext; constant-time safeEqual |
| `redact.spec.ts` | SEC-XC-7 / SEC-PW-4 | Redaction of bearer/JWT/email + keys named secret/token/password/credential |
| `redelivery.spec.ts` | C2 / MUST-5 (R2) | Pure state-machine: dispatched-unacked re-deliverable; running/terminal not; idempotent persist-handoff dedup |
| `mcp.spec.ts` | I-MCP-WL | Allowlist predicate (project-scoped, no global tools, reject before invocation) — pure logic, no live MCP server |
| `retrieval.spec.ts` | U-RETRIEVAL-IF | RetrievalBackend interface conformance + swappability via stub adapter |
| `skills.spec.ts` | U-SKILL-VALID / I-SKILL-FAIL-KEEP | Package validation (missing field, checksum mismatch); failure-keeps-current structural guarantee |

**Pattern**: most tests are pure-logic / state-machine / interface-conformance tests, NOT DB-backed integration. Several explicitly note "full DB+server integration runs in CI" but the CI workflow only runs `pnpm --filter @crab/api test` (the same vitest unit suite) — there is no separate integration test runner wired in CI.

### Web e2e tests (`apps/web/tests/e2e/`, Playwright) — 5 files

| File | What it covers |
|---|---|
| `tracer-bullet.spec.ts` (D1) | Full MVP loop via API: login → create project → module → test-case → ai-generation → approve → create execution → UI login smoke → assert execution queryable. Falls back to placeholder draft if no provider. |
| `auth-login.spec.ts` | Login flow |
| `navigation.spec.ts` | Root→/projects redirect; **documents that NO auth middleware exists** (unauthenticated /projects still renders — T7 snapshots current behavior, flagged for replacement when middleware lands) |
| `projects.spec.ts` | Projects page |
| `_helpers.ts` | Shared e2e helpers |

### Desktop tests

- `apps/desktop/test/isolation-check.cjs` (D2 / SEC-EL-6): Electron renderer isolation self-check — asserts no `require/process/fs/child_process` globals and exact `crabBridge` allowlist. Run via `pnpm --filter @crab/desktop test:isolation`.

### Coverage gaps observed

- No auth middleware on web (flagged in `navigation.spec.ts`).
- No DB-backed integration tests for R2 redelivery, MCP allowlist, RAG pipeline, Skill adapter invocation (only pure-logic mirrors).
- No e2e that drives the desktop worker through a real Playwright execution end-to-end against the live API (tracer-bullet asserts the API surface, not the worker run).
- shadcn-vue set is partial (Table/Dialog missing vs MVP-FINISH-PLAN A2 target).

---

## 5. OpenSpec Completeness Assessment

**Does OpenSpec need filling/completion BEFORE feature-parity work?**

For **MVP + Phase 2 parity** (domains 1,2,3,5,7,10,12,13 + the implemented halves of 6,8,11): **No.** The 10 committed capability specs are complete and valid; the code implements them. Feature-parity work against WHartTest for these domains can proceed against the existing specs.

For **Phase 3 parity** (domains 4 test-suites, 6 LLM-chat UI, 8 full API-automation suite, 9 requirement-management, 11 MCP-admin UI): **Yes — spec-first gate is the explicit blocker.** These 5 capabilities have NO committed `specs/<cap>/spec.md`. Their requirements exist only as prose drafts in `PLAN-SPECFILL.md`. Per the plan's own V-c decision and §11 (d1/e2), implementation MUST NOT start until:
1. The current `rebuild-ai-test-platform` change is archived (`openspec archive` → populates `openspec/specs/`).
2. Second change `fill-spec-gaps-phase3` (pure ADDED, 5 new cap specs) is written + validated + approved.
3. Third change `fill-spec-gaps-modifieds` (5 MODIFIED/ADDED deltas: web-ui R4/R5/R6, backend-ai-orchestration R3 ref, ai-test-generation R1 linkback, clean-room-rebuild ADDED R5 non-goal lift, test-asset-management index-only) is created post-archive.

`待执行的提示词文件.md` already contains the autopilot prompt to execute step 2+3 (spec-writing only, no business code) — it is queued, not yet run. Baseline cited there is `6d09435` (MVP + Phase 2 done).

**Which spec areas are thin?**

- The 10 committed specs are **functionally thin but testable** — each has 3-5 requirements with 1 scenario each, written as binary WHEN/THEN. They pass `openspec validate`. They are adequate as binding contracts but lack edge-case scenarios.
- **`web-ui.3`** is the one in-MVP requirement with a known coverage nuance: it SHALL-lists "API automation" among primary workflows, but the full suite is a design.md non-goal → resolved by the navigable placeholder route (MUST-3). This is already satisfied in code (`api-automation.vue`).
- **Phase 3 areas** (the 5 new caps) are the genuinely thin/absent specs — but this is intentional and gated, not an oversight.
- **`tasks.md` is stale**: 51 tasks all unchecked despite code being implemented. Should be reconciled if OpenSpec task tracking is to be trusted, but this does not block parity work.

---

## 6. Notable Decisions / Constraints from Root Docs

- **Clean-room posture** (clean-room-rebuild R1–R4 + proposal/design Non-Goals): WHartTest is product research ONLY. No copying of source, images, Logo, copy, styles, UI assets, prompts, docs, exact layouts, or API implementation details. `WHartTest*` excluded from pnpm workspace; `infra/ci/clean-room-scan.mjs` enforces in CI. Provenance log required for risky references.
- **Permanent non-goals** (§11 a1–a10): enterprise WeChat; complex RBAC / permission matrices / custom roles (only owner/member); full DOCX editor; distributed UI execution / remote Playwright worker pool; platform-global MCP tools + global admin role; any WHartTest reuse; client-side LLM/MCP execution; alternate frontend framework track; direct WHartTest fork; MIT-attribution evasion via stack swap.
- **MVP mechanism prohibitions** (Architect R1/R2/R5/R8, §11 b′): no LangGraph durable checkpointer / `interrupt()` (R1 — Prisma run-state instead); no BullMQ as worker transport (R2 — authenticated session stream, realized as polling-claim in MVP); no server-side event replay buffer (R8 — snapshot refetch instead); no external secret manager (R5 — Postgres envelope encryption with per-credential DEK + master-key rotation).
- **Retrieval backend swappability** (knowledge-rag.3, A1): pgvector-first behind a `RetrievalBackend` interface; Qdrant swappable later, not implemented now (§11 b′5). pgvector uses raw SQL (`$queryRaw` + hnsw/ivfflat) because Prisma has no native `vector` type (R9 friction flagged).
- **MCP project-scoping** (§11 a5, mcp-admin R1): MCP tools are project-scoped ONLY — no global tools, no global admin approver. In Phase 2 the allowlist is enforced directly by `McpService` (transitional); the "reject non-allowlisted before invocation" predicate's single-source-of-truth ownership is reserved for the Phase 3 `mcp-admin` capability (third change MODIFIED).
- **Simple-roles invariant** (§11 a2): all review/approval flows use owner/member only — no reviewer/approver/admin roles introduced. Applies to requirement-management (Phase 3) and skill permission approval (Phase 2, already implemented).
- **Phase plan** (PLAN-UNIFIED): MVP (domains 1,2,3,5,7,13 + config halves of 6,8,11) → Phase 2 (KB/RAG, Skills, MCP mechanism) → Phase 3 (spec-first gated: test-suite, api-automation full, requirement-management, llm-chat, mcp-admin UI). `MVP-FINISH-PLAN.md` and `PHASE2-PLAN.md` are autopilot prompt wrappers around PLAN-UNIFIED; both marked "待批准" (pending approval) in their headers but the code they describe is already on main.
- **Stale artifact defense** (F8 gate, Architect #10): `infra/ci/f8-drift-scan.mjs` guards against regression to pre-consensus `.omc/plans/rebuild-ai-test-platform-plan.md` patterns (pull-based worker registry, BullMQ-as-transport, credentialRef→secret-store, `interrupt()` humanReview).
- **Open questions still open** (design.md, not blocking structure): deployment target (Docker Compose / VPS / K8s / managed cloud); provider set (OpenAI-only vs Ollama/Qwen/DeepSeek); compliance posture; first-class language (zh/en/bilingual); Electron OS targets (Windows-first vs multi-platform). Phase 3 open questions: suite execution topology, API executor, chat scope, MCP discovery source.
