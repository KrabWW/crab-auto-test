## Context

A prior gap audit (`openspec/changes/rebuild-ai-test-platform/PLAN-SPECFILL.md`) identified five Phase 3 capability areas that the product needs but which have no binding specs in the current change `rebuild-ai-test-platform`. The current change ships complete, validated specs and code for the MVP and Phase 2 (ten capabilities); the five Phase 3 areas exist only as prose drafts. This change fills those gaps with pure ADDED capability specs so Phase 3 implementation can begin under the project's spec-first gate, without reopening the MVP/Phase 2 approval surface.

WHartTest is used only as competitive product research. The five new capabilities are described against general industry patterns. No WHartTest source code, prompts, DSLs, UI layouts, assets, or copy is reused; each new capability carries a clean-room provenance scenario or design note.

## Goals / Non-Goals

**Goals:**

- Provide binding WHEN/THEN specs for the five Phase 3 capabilities: `test-suite`, `api-automation`, `requirement-management`, `llm-chat`, `mcp-admin`.
- Keep the change pure ADDED (zero MODIFIED) so it can be written and validated today, before the prior change is archived.
- Preserve the three invariants across the new domains: simple-roles (owner/member only), clean-room (no upstream protected expression), backend-owns-orchestration (LLM/MCP calls run on NestJS).
- Make the deferred inter-capability couplings an explicitly enumerated follow-on (`fill-spec-gaps-modifieds`), not a vague promise.

**Non-Goals:**

- Do not write business code. This change is spec-writing only.
- Do not modify any existing capability in this change (web-ui, backend-ai-orchestration, ai-test-generation, clean-room-rebuild, test-asset-management). All MODIFIED deltas go to the post-archive follow-on.
- Do not introduce LangGraph durable checkpointer / `interrupt()` (prior R1), BullMQ as worker transport (prior R2), server-side event replay buffer (prior R8), or an external secret manager (prior R5).
- Do not introduce a reviewer/approver/admin role. All review and approval uses owner/member only.
- Do not implement platform-global MCP tools or a global admin approver. MCP tools are project-scoped only.
- Do not lift any non-goal beyond the two explicitly planned (full API automation suite, full MCP administration) into Phase 3.

## Decisions

### Decision 1 (D8): test-suite uses a self-contained SuiteRun

Suite execution reuses the existing execution-record and artifact model (browser execution records, screenshots/logs/trace). The linkage is achieved by a self-contained SuiteRun entity that holds a list of execution-record identifiers — NOT by adding a foreign key to `test-asset-management`. This keeps test-suite independent of any MODIFIED delta on test-asset-management.

Rationale: a cross-change MODIFIED on test-asset-management would block this change on prior-change archival. A self-contained SuiteRun achieves the roll-up and artifact reachability with pure ADDED.

Alternatives considered: add an `ExecutionRecord.suiteRunId` FK (would be a MODIFIED delta on test-asset-management, blocking; rejected). Maintain suite runs purely as a view over existing executions (no first-class entity; loses the aborted/partial-run and ordered-membership semantics; rejected).

### Decision 2 (D9): api-automation execution records are analogous to browser executions; secrets are references

API case execution produces an execution record carrying status, duration, response metadata, and per-assertion results, linked to project and case — the same record model used by browser executions. Credentials in requests are stored as envelope-encrypted references (never plaintext); failing-assertion response snapshots are redacted. The local Electron worker is the default executor; a distributed API worker pool is deferred.

Rationale: reusing the execution-record model keeps api-automation consistent with the existing test-asset-management and automation-workers capabilities and avoids a parallel record model. Secrets-as-references reuses platform-foundation's envelope encryption (prior R5). An explicit Phase-3 gate (MVP exposes only a web-ui placeholder route) prevents the prior web-ui "API automation" mention from being read as an MVP constraint.

Alternatives considered: a separate API-specific record model (divergence and duplicated audit/artifact paths; rejected). Plaintext credentials in request definitions (security regression; rejected). Treating api-automation as in-scope for the MVP (violates the prior non-goal and the spec-first gate; rejected).

### Decision 3 (D10): requirement review uses only owner/member

Requirements transition draft → reviewed → approved using only existing owner/member roles. Only an owner can approve. Every transition is audited. No reviewer or approver role is introduced.

Rationale: preserves the simple-roles invariant. WHartTest-style complex RBAC is a permanent non-goal.

Alternatives considered: introduce a reviewer role (RBAC creep; rejected). Allow any member to approve (breaks owner-gated approval semantics; rejected).

### Decision 4 (D11): llm-chat is session-level and backend-owned

Chat lets a member hold interactive, single-turn-or-conversational sessions over a configured provider, with the LLM call made exclusively by the NestJS backend over the shared streaming contract. Chat is conversational-only: no tool-calling, no multi-step state, no human-approval gating. It is therefore NOT in scope of backend-ai-orchestration's multi-step workflow requirement (prior R2), so no MODIFIED delta or exemption is needed.

Rationale: chat sessions (ChatSession/ChatMessage/audit) are a distinct bounded context from the AI generation workflow; bundling them into backend-ai-orchestration would conflate session persistence with multi-step orchestration. Session-level scoping keeps it cleanly outside the durable-graph prohibition (prior R1).

Alternatives considered: extend backend-ai-orchestration with chat (bounded-context confusion; rejected). Add tool-calling/multi-step to chat (would enter R2 scope and require a MODIFIED delta; explicitly deferred non-goal).

### Decision 5 (D12): mcp-admin owns the rejection predicate; tools are project-scoped

The approved allowlist is the single source of truth for backend MCP invocation: any tool not in the allowlist is rejected before invocation. mcp-admin owns this rejection predicate; backend-ai-orchestration references it (in the follow-on MODIFIED) without re-stating it. MCP tools are project-scoped only; there is no global tool category and therefore no global approver role — approval is by the project owner.

Rationale: single-source-of-truth ownership prevents the rejection logic from drifting between two capabilities. Project-scoping preserves the simple-roles invariant (no global admin). Revocation takes effect on the next call.

Alternatives considered: re-state the rejection in backend-ai-orchestration (drift risk; rejected). Allow a global tool category with a global admin (RBAC creep + permanent non-goal; rejected).

### Decision 6 (D13): non-goal reconciliation is a follow-on ADDED (clean-room-rebuild R5)

The lift of "full API automation suite" and "full MCP administration" from permanent non-goal to Phase-3 spec-gated is recorded as a binding spec via an ADDED requirement on clean-room-rebuild in the post-archive follow-on change (R5), preserving the original R3 wording. The permanent non-goals (enterprise WeChat, complex RBAC, full DOCX editor, distributed UI execution, global MCP tools) remain rejected.

Rationale: rewriting clean-room-rebuild R3 would lose the original wording and reopen its approval surface; an ADDED R5 is cleaner. Because this change is pure ADDED, the reconciliation is deferred.

### Decision 7 (D14): vehicle is V-c — pure ADDED now, MODIFIED later

This change is the second change (`fill-spec-gaps-phase3`), pure ADDED with five new slugs, validatable today. A third, explicitly enumerated post-archive change (`fill-spec-gaps-modifieds`) carries all MODIFIED deltas and must be created after the prior change is archived so its MODIFIED deltas resolve against real `openspec/specs/` entries.

Rationale: V-c lets the gap-fill specs be written and validated immediately, keeps the MVP/Phase 2 approval surface clean, and makes the MODIFIED ordering tool-enforceable.

Alternatives considered: V-a revise the existing change (reopens MVP approval; rejected). V-b archive then follow-on (serializes on archival, but MODIFIED resolves cleanly — retained as a fallback if archival proceeds smoothly).

## Risks

1. **Spec sprawl.** Phase 3 quietly expanding beyond five capabilities. Mitigation: Non-Goals enumerate exactly five caps; a sixth requires a new change; the acceptance gate rejects scope additions.
2. **Clean-room pollution.** The five domains are the highest-temptation areas for mirroring WHartTest (api-automation DSL, UI step-config schema, prompts, layouts). Mitigation: each new cap has a clean-room provenance scenario or design note; no upstream DSL/prompt/layout/asset references; the CI clean-room scan should be extended to Phase 3 module paths during implementation.
3. **Cross-cap coupling.** requirement-management → ai-test-generation, mcp-admin → backend-ai-orchestration, test-suite → test-asset-management + executions. Mitigation: the follow-on MODIFIED change makes couplings single-direction and explicit; mcp-admin owns the rejection predicate solely; test-suite's self-contained SuiteRun avoids modifying test-asset-management.
4. **Phase-3 gate discipline.** Implementation before spec approval. Mitigation: clean-room-rebuild R5 (follow-on) blocks lifted-cap implementation behind prior spec; Phase 3 implementation is a separate follow-on change depending on this change's approval.
5. **Follow-on dependency.** MODIFIED deltas require prior-change archival. Mitigation: the follow-on's range is explicitly enumerated in §4 as a committed artifact, not a vague promise; after archival MODIFIED deltas resolve real specs; if the prior change is later rewritten, the follow-on MODIFIED deltas must be re-reviewed.
6. **Dangling reference risk.** Pure-ADDED prose in this change references ADDED caps of the prior change; the validator does not force resolution; if the prior change is rewritten later the references dangle. Mitigation: Gate D consistency check + reconciliation at archival.
7. **Simple-roles creep.** Review/approval flows might accidentally introduce a reviewer/approver role. Mitigation: every such requirement explicitly states "no new role"; Gate D scans for role-creep language; mcp-admin is project-scoped to avoid a global admin.
8. **mcp-admin global-tool boundary.** If platform-global MCP tools are ever needed, the current simple-roles model cannot approve them. Mitigation: D5 declares the platform provides only project-scoped tools; global tools are a non-goal and would require a separate change that first formalizes an admin role.

## Open Questions

- Suite execution topology: reuse the local Playwright worker vs a dedicated suite runner.
- API executor: local Electron worker vs a backend-side HTTP runner.
- Chat session scope: per-user vs per-project-default.
- MCP tool discovery source: manual registration vs auto-discovery (manual first; auto deferred).

## §4 Deferred MODIFIED deltas (explicitly enumerated follow-on `fill-spec-gaps-modifieds`)

This change is pure ADDED. The following five MODIFIED/ADDED deltas on existing capabilities are committed as the range of the post-archive follow-on change, not a vague promise:

1. `web-ui`: ADDED R4 (chat route) / R5 (mcp-admin route) / R6 (api-automation route, MVP placeholder + Phase 3 full), NOT fattening R3.
2. `backend-ai-orchestration`: MODIFIED R3 to reference the mcp-admin allowlist ("MCP invocations SHALL use the mcp-admin allowlist (see mcp-admin)"), without re-stating the rejection predicate.
3. `ai-test-generation`: MODIFIED R1 to add the "approved managed requirement as optional input + generated cases link back to the requirement version" scenario.
4. `clean-room-rebuild`: ADDED R5 ("Non-goal reconciliation is explicit") — permanent non-goals stay permanent; the API automation suite and full MCP administration are LIFTED to Phase-3 spec-first gating. Original R3 wording is preserved.
5. `test-asset-management`: documentation/index-only linkage — because test-suite uses a self-contained SuiteRun holding an execution-record ID list, there is NO functional FK change; the follow-on adds an index/constraint only if performance requires it.
