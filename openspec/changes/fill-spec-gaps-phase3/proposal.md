## Why

The current change `rebuild-ai-test-platform` ships complete, validated specs for the MVP and Phase 2 capabilities (platform-foundation, web-ui, backend-ai-orchestration, ai-test-generation, test-asset-management, knowledge-rag, skills-store, automation-workers, desktop-app, clean-room-rebuild), and the corresponding code is already on `main`. However, five Phase 3 capability areas that the product eventually needs — test suites, the full API automation suite, requirement management, interactive LLM chat, and MCP tool administration — have no binding specs yet. Their requirements exist only as prose drafts inside `PLAN-SPECFILL.md`.

Per the project's own spec-first gate (PLAN-UNIFIED §11 decision V-c), implementation of these five areas MUST NOT begin until binding WHEN/THEN specs exist and are aligned. This change provides the missing capability specs and records their clean-room boundaries. Implementation then proceeds in ordered module commits only after the relevant module spec is present and aligned.

## What Changes

- ADD five new capabilities, each with binding requirements and testable scenarios:
  - `test-suite`: project-scoped suites with ordered test-case membership and suite-level execution that rolls up per-case results, reusing the existing execution-record and artifact model via a self-contained SuiteRun.
  - `api-automation`: API test cases defined as HTTP requests plus ordered assertions, producing execution records analogous to browser executions, with secrets stored as encrypted references and an explicit Phase-3 gate (MVP exposes only a navigable placeholder route).
  - `requirement-management`: requirements as first-class project-scoped entities with a draft → reviewed → approved workflow using only owner/member roles, and approved requirements linking back to generated test cases.
  - `llm-chat`: interactive conversational chat over a configured model provider, with the LLM call made exclusively by the NestJS backend; session-level only (no external MCP tool-calling, no durable multi-step state, no human-approval gating), with explicit context selection, optional project-scoped RAG, internal activity display, and persisted generated outputs.
  - `mcp-admin`: project-scoped MCP tool governance (propose/review/approve/allowlist/revoke) under simple roles; the approved allowlist is the single source of truth for backend MCP invocation rejection. Platform provides only project-scoped MCP tools; no global tool category and no global approver role.
- The OpenSpec delta remains pure ADDED: zero MODIFIED deltas to existing capabilities. All MODIFIED deltas (web-ui route additions, backend-ai-orchestration allowlist reference, ai-test-generation approved-requirement input, clean-room-rebuild non-goal reconciliation, test-asset-management index/constraint linkage) are deferred to a separate, explicitly enumerated post-archive change `fill-spec-gaps-modifieds`.

## MVP

UNCHANGED. There is no MVP impact. API automation in the MVP remains a web-ui navigable placeholder route (existing web-ui requirement scope). The five added capabilities are Phase 3.

## Required Post-MVP Capabilities

Extends the prior change's post-MVP list with the five Phase 3 capabilities: complete knowledge base/RAG, complete Skills store, plus test-suite, api-automation (full suite), requirement-management, llm-chat, and mcp-admin.

## Non-Goals

- KEEP PERMANENT (never in scope, unchanged from prior change): enterprise WeChat; complex RBAC / permission matrices / custom roles; full online DOCX editor; distributed UI execution / remote Playwright worker pool; platform-global MCP tools and a global admin approver role; any reuse of WHartTest source, assets, copy, styles, prompts, exact layouts, or API implementation details.
- LIFT TO PHASE 3 (planned, spec-first gated, via this change plus the post-archive `fill-spec-gaps-modifieds` change): the full API automation suite and full MCP administration. Until the post-archive change's clean-room-rebuild reconciliation lands binding, these remain formally design.md non-goals of the prior change; the ADDED specs here do not violate the prior change's executable non-goals (clean-room-rebuild R3 rejects only enterprise WeChat / complex RBAC).
- STILL DEFERRED WITHIN PHASE 3: distributed API execution workers (API automation runs via the local Electron worker; a distributed API worker pool is a later spec-first change); automatic MCP tool discovery (manual registration first); cross-project requirement reuse; multi-provider chat fan-out; chat tool-calling / multi-step orchestration (if ever needed it must first enter backend-ai-orchestration's multi-step workflow scope via a corresponding MODIFIED delta).
- Business code is delivered only by ordered module implementation commits after that module's spec is present and aligned. No WHartTest source, assets, copy, styles, prompts, exact layouts, or API implementation details are reused.

## Capabilities

### New Capabilities

- `test-suite`
- `api-automation`
- `requirement-management`
- `llm-chat`
- `mcp-admin`

### Modified Capabilities

None in this change. All MODIFIED deltas are deferred to the explicitly-enumerated post-archive change `fill-spec-gaps-modifieds`.

## Impact

- Unblocks Phase 3 implementation under the spec-first gate as each module's spec is present, aligned, and verified before its implementation commit.
- Establishes the five Phase 3 capability boundaries and their clean-room provenance so future implementation does not mirror WHartTest's API-automation DSL, UI step-config schema, prompts, or layouts.
- Requires the follow-on post-archive change `fill-spec-gaps-modifieds` (range explicitly enumerated in `design.md` §4) to make the inter-capability couplings binding: web-ui routes for the three UI-backed caps, the backend-ai-orchestration allowlist reference, the ai-test-generation approved-requirement input link, and the clean-room-rebuild non-goal reconciliation.
