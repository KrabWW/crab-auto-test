## 11. Phase 3 Spec Fill (V-c second change — pure ADDED)

- [ ] 11.1 Write `specs/test-suite/spec.md` (ADDED R1–R3, self-contained SuiteRun, no test-asset-management FK) + testability review.
- [ ] 11.2 Write `specs/api-automation/spec.md` (ADDED R1–R3, explicit Phase-3 gate + secrets-as-references + clean-room provenance).
- [ ] 11.3 Write `specs/requirement-management/spec.md` (ADDED R1–R3, owner-only approval, versioned linkage).
- [ ] 11.4 Write `specs/llm-chat/spec.md` (ADDED R1–R3, session-level scope declaration, outside backend-ai-orchestration R2).
- [ ] 11.5 Write `specs/mcp-admin/spec.md` (ADDED R1–R3, project-scoped tools only, owns the rejection predicate).
- [ ] 11.6 Run `openspec validate fill-spec-gaps-phase3` and the four spec-quality gates (Gate A testability, Gate B clean-room provenance, Gate C non-goal diff — deferred to follow-on, Gate D cross-cap consistency).
- [ ] 11.7 (Follow-on, post-archive) Write `fill-spec-gaps-modifieds`: the five explicitly-enumerated MODIFIED/ADDED deltas on web-ui / backend-ai-orchestration / ai-test-generation / clean-room-rebuild / test-asset-management. Must NOT start until `rebuild-ai-test-platform` is archived.
- [ ] 11.8 (Deferred, independent impl change) Phase 3 implementation — each cap one impl change, in order test-suite → api-automation → requirement-management → llm-chat → mcp-admin. MUST NOT start before 11.1–11.7 are approved.
