# 计划：补齐 OpenSpec（Phase 3 spec-first 门控）

> 状态：**PENDING APPROVAL**（本轮仅规划 OpenSpec 修改，未创建/修改任何 openspec 文件，未写业务代码）
> 需求源：`openspec/changes/rebuild-ai-test-platform/`（前序 change，PENDING APPROVAL / 未归档）。
> WHartTest 仅作通用产品调研——不复制源码/素材/Logo/文案/样式/提示词。
> 共识：Planner → Architect（R1–R8）→ Critic（ITERATE，3 项必改 + 2 项建议）→ 修订整合。

---

## 0. RALPLAN-DR 决策摘要

### 原则
1. **Spec-first 门控**：Phase 3 域须先有批准的 WHEN/THEN 场景方可实现；本变更即门控本身。
2. **Clean-room by construction**：5 个新 cap 以通用行业模式描述；每个新 cap 附 clean-room provenance（观察到的需求→独立实现路径）。
3. **后端拥有编排**：所有 LLM/MCP/LangGraph 调用跑在 NestJS；Web/桌面为同一 REST+流式契约的瘦客户端。
4. **仅简单角色（无 RBAC 蔓延）**：所有评审/审批仅用 owner/member；不引入 reviewer/approver 角色；"admin" 仅在 platform-foundation.3 prose 出现、非已定义角色——故任何"全局"审批须显式处理（见 §3 G5）。
5. **非目标协调须显式且可执行**：解除 prior 非目标须落到 binding spec，非仅 prose 编辑。

### 决策驱动（Top 3）
1. **结构合法性**：prior change 未归档 → `openspec/specs/` 为空 → 跨 change 的 `## MODIFIED Requirements` 无法对 base 需求解引（"依赖说明 + 归档顺序"是社交承诺，非工具强制）。
2. **跨 change 引用语义**：纯 ADDED 的 prose 引用另一未归档 change 的 ADDED cap，validator 不强制解引（可通过 `openspec validate`），但若 prior change 后续被改写则存在悬空引用风险。
3. **不变量边界**：simple-roles + clean-room + 后端编排 三个不变量在 5 个新域上的边界（尤其 mcp-admin 的"全局工具审批"与 platform-foundation 角色定义的张力）。

### 关键选项
- **选项 V — 变更载体**：
  - V-a 修订既有 `rebuild-ai-test-platform` change（重开 MVP 审批面）。
  - V-b 先归档 prior change 再建 follow-on（MODIFIED 可解引，但须先批准+归档）。
  - **V-c ✅（选定）**：follow-on 纯 ADDED（5 新 slug，零 MODIFIED），所有 MODIFIED deltas 延后到**第三个、显式提交的 post-archive change**。
  - 理由：V-c 让 gap-fill spec 当下即可编写并通过 `openspec validate`，无 base-spec 依赖；保持 MVP 审批洁净；MODIFIED 排序工具可强制（归档后第三 change 的 MODIFIED 解引真实 `openspec/specs/`）。
- **选项 C — extend vs new slug（llm-chat / mcp-admin）**：**新建 slug ✅**。llm-chat 拥有 ChatSession/ChatMessage/会话持久化/审计（与 platform-foundation 身份鉴权为不同 bounded context）；mcp-admin 拥有治理生命周期（propose/review/approve/allowlist/revoke，与 backend-ai-orchestration 运行时机制分离，对标 skills-store 分离）。

---

## 1. 需要新增的 capabilities

载体：**新 change 文件夹 `openspec/changes/fill-spec-gaps-phase3/`**（V-c：纯 ADDED）。
所有"对既有 cap 的 MODIFIED"（web-ui 路由、backend-ai-orchestration allowlist 引用、ai-test-generation 需求输入、clean-room-rebuild 非目标协调、test-asset-management suite-run 联动）**延后到第三个 post-archive change**（§4 显式枚举其范围，作为已提交产物，非模糊承诺）。

| # | Slug | 范围（一行） | New/Extend | 理由 |
|---|---|---|---|---|
| G1 | `test-suite` | 项目级 suite 实体 + 有序用例成员 + suite 级执行（汇总每用例结果）。**自包含 SuiteRun 设计**（SuiteRun 持有执行记录 ID 列表），不依赖 test-asset-management 改动。 | **Brand-new** | 无既有 cap 拥有分组/有序执行；suite run 复用执行记录模式但 suite 实体+rollup 为独立关注点。 |
| G2 | `api-automation` | HTTP 请求定义 + 断言 + 执行记录（对标浏览器执行）；Web UI 路由由此 cap 支撑。**显式 Phase-3 门控**：MVP 仅占位路由。 | **Brand-new** | web-ui.3 SHALL 提及但无 backing 场景；新 cap 提供场景。 |
| G3 | `requirement-management` | 需求实体 + 评审/审批工作流（仅 owner/member）+ 已批准需求到生成用例的关联。 | **Brand-new** | 需求目前只是 AI-gen 输入串，非受管实体。 |
| G4 | `llm-chat` | 基于已配置 provider 的交互对话 + 会话持久化 + 审计；后端拥有 LLM 调用。**会话级、无 tool-calling/多步状态**→不在 backend-ai-orchestration R2 范围，无需 MODIFIED/豁免。 | **New slug** | ChatSession/Message/审计为独立 bounded context。 |
| G5 | `mcp-admin` | MCP 工具治理界面：propose/review/approve/allowlist/revoke。**MCP 工具限定项目级**（无平台全局工具），故审批 = 项目 owner；不引入全局 admin 角色。 | **New slug** | 治理生命周期独立于运行时机制；对标 skills-store。 |

**对既有 cap 的修改（延后第三 change，§4 枚举）**：`web-ui`（R4/R5/R6 per-workflow 路由，非 fattening R3）、`backend-ai-orchestration`（R3 仅引用 mcp-admin allowlist，不重述拒绝谓词）、`ai-test-generation`（R1 已批准受管需求为可选输入）、`clean-room-rebuild`（ADDED R5 非目标协调，保留 R3 原措辞）、`test-asset-management`（**仅文档联动**——因 test-suite 采用自包含 SuiteRun，无 FK 改动需求；第三 change 仅在必要时追加索引/约束）。

---

## 2. 每个 capability 的 Requirement 列表

### `test-suite`（NEW）— 3
- **R1 Suites group ordered test cases**：项目级 suite 持有既有用例的有序成员。
- **R2 Suite execution rolls up per-case results**：运行 suite 产出一个 suite run，聚合每用例结果为单一汇总（全过=passed，任一失败=failed）。
- **R3 Suite runs reuse the execution-record and artifact model**：suite 内每用例运行创建标准执行记录（含截图/日志/trace，对标 test-asset-management.2-3），**由自包含 SuiteRun 持有执行记录 ID 列表**实现联动（不修改 test-asset-management）。

### `api-automation`（NEW）— 3
- **R1 API test cases define requests and assertions**：API 用例 = HTTP method/URL/headers/body + 有序断言（status/body/headers）。**显式 Phase-3 门控**：MVP 仅为 web-ui 占位路由。
- **R2 API executions produce execution records analogous to browser executions**：执行 API 用例产执行记录（状态/耗时/响应元数据/每断言结果），关联项目与用例。
- **R3 API automation respects secrets-as-references and clean-room**：请求中凭据为信封加密引用（无明文）；响应快照脱敏；clean-room 评审 + provenance。

### `requirement-management`（NEW）— 3
- **R1 Requirements are managed project-scoped entities**：需求实体含 title/content/status/version，项目级。
- **R2 Requirements follow a review and approval workflow using simple roles**：draft→reviewed→approved，仅 owner 批准（member 不可），无新角色，每次流转审计。
- **R3 Approved requirements link to generated test cases**：仅已批准需求可选为 AI 生成输入；生成用例回链需求版本。

### `llm-chat`（NEW）— 3
- **R1 Users can chat over configured model providers via backend orchestration**：交互对话用已配置 provider；LLM 调用由 NestJS 发起，客户端只收流式响应。**会话级、无 tool-calling/多步/人审**→不属 backend-ai-orchestration R2 范围。
- **R2 Chat sessions are persisted**：会话与消息持久化，跨重连可恢复。
- **R3 Chat interactions are audited and secrets-free**：每会话/消息事件审计（actor/provider/project/timestamp/outcome）；凭据不入日志/消息载荷。

### `mcp-admin`（NEW）— 3
- **R1 MCP tools are reviewable and approvable under simple roles**：MCP 工具 propose→review→approve(allowlist)/revoke；**MCP 工具限定项目级**，项目 owner 审批；无新角色；审计。（平台不提供全局 MCP 工具；若未来需要全局工具，须先经独立 change 形式化 admin 角色再扩展——见 §5 非目标。）
- **R2 The approved allowlist is the source of truth for backend MCP calls**：mcp-admin 拥有"非白名单工具在调用前拒绝"谓词的唯一所有权；backend-ai-orchestration.3 仅引用、不重述。
- **R3 MCP admin actions and tool calls are audited end-to-end**：治理动作 + 每调用 McpToolCall 元数据可查。

---

## 3. 每个 Requirement 的验收 Scenario

> V-c：以下为**第二 change（纯 ADDED）**中将创建的 5 个 `specs/<cap>/spec.md`。对既有 cap 的 MODIFIED 场景在第三 change（§4 枚举），此处不写。

### `specs/test-suite/spec.md` — `## ADDED Requirements`

```markdown
### Requirement: Suites group ordered test cases
The system SHALL let project members create project-scoped test suites that hold an ordered membership of existing test cases.

#### Scenario: Suite is created with ordered cases
- **WHEN** a project member creates a suite and adds existing test cases in a chosen order
- **THEN** the system MUST persist the suite with its ordered case membership and MUST surface it in the project suite list.

#### Scenario: Suite membership edit preserves past runs
- **WHEN** a member removes a case from a suite after a prior suite run
- **THEN** the prior suite run and its per-case execution records MUST remain intact and queryable.
```

```markdown
### Requirement: Suite execution rolls up per-case results
The system SHALL execute a suite by running each member case and aggregating per-case outcomes into a single suite-level summary.

#### Scenario: Suite run aggregates per-case pass/fail
- **WHEN** a member runs a suite and all member cases finish
- **THEN** the system MUST create one suite run with a rolled-up status (passed only if every case passed; failed if any case failed) and MUST expose per-case pass/fail, failed step, and duration in the summary.

#### Scenario: Partial suite run records which cases ran
- **WHEN** a suite run is aborted mid-execution
- **THEN** the system MUST mark the suite run as aborted and MUST record which cases completed and which did not.
```

```markdown
### Requirement: Suite runs reuse the execution-record and artifact model
The system SHALL create, for each case run inside a suite, an execution record consistent with the browser execution record model, and SHALL link each such record to a self-contained suite-run entity that holds the list of execution-record identifiers.

#### Scenario: Per-case artifacts are captured under a suite run
- **WHEN** a case runs as part of a suite and captures screenshots, logs, or trace artifacts
- **THEN** those artifacts MUST be registered against the case's execution record and MUST be reachable from the suite run summary via the suite-run's execution-record list.
```

### `specs/api-automation/spec.md` — `## ADDED Requirements`

```markdown
### Requirement: API test cases define requests and assertions
The system SHALL let project members define API test cases as an HTTP request (method, URL, headers, body) plus ordered assertions over status code, headers, and body. This capability is Phase-3 gated: in the MVP the web UI exposes only a navigable placeholder route, and full request/assertion authoring is available only once this Phase-3 spec is approved.

#### Scenario: API case is created with assertions
- **WHEN** a member creates an API case with a GET request and a status-equals-200 assertion (Phase 3)
- **THEN** the system MUST persist the request definition and assertions and MUST surface the case alongside functional cases in the project.

#### Scenario: Secrets in requests are stored as references
- **WHEN** a member saves a request header containing a credential
- **THEN** the system MUST store the credential as an encrypted reference (never plaintext) and MUST NOT return the plaintext in any API response.
```

```markdown
### Requirement: API executions produce execution records analogous to browser executions
The system SHALL create, for each API case execution, an execution record carrying status, duration, response metadata, and per-assertion results, linked to the project and case — analogous to browser execution records.

#### Scenario: API case execution records assertion outcomes
- **WHEN** a member runs an API case and the response is received
- **THEN** the system MUST create an execution record with overall pass/fail, per-assertion pass/fail, response status, and duration, and MUST link it to the source API case.

#### Scenario: Failing assertion records a redacted response snapshot
- **WHEN** an API case execution fails on an assertion
- **THEN** the system MUST record which assertion failed and a response snapshot with secrets redacted, MUST NOT store raw credentials, and MUST mark the execution record as failed.
```

```markdown
### Requirement: API automation respects secrets-as-references and clean-room
The system SHALL treat API automation as an independent clean-room capability and MUST NOT reuse upstream API-automation source, prompts, assertion DSLs, or exact UI layouts; all credentials MUST be envelope-encrypted references.

#### Scenario: Clean-room review of API automation
- **WHEN** the API automation module is submitted for release
- **THEN** a clean-room review MUST confirm no upstream API-automation code, DSL, or asset was copied and MUST record a provenance note describing the independent implementation approach.
```

### `specs/requirement-management/spec.md` — `## ADDED Requirements`

```markdown
### Requirement: Requirements are managed project-scoped entities
The system SHALL manage requirements as first-class project-scoped entities with title, content, status, and version.

#### Scenario: Requirement is created as a draft
- **WHEN** a project member creates a requirement
- **THEN** the system MUST persist it in draft status, scoped to the project, and MUST surface it in the project requirement list.
```

```markdown
### Requirement: Requirements follow a review and approval workflow using simple roles
The system SHALL transition requirements through draft -> reviewed -> approved using only existing owner/member roles, with no new permission matrix, and MUST audit every transition.

#### Scenario: Owner approves a reviewed requirement
- **WHEN** a project owner approves a requirement in reviewed status
- **THEN** the system MUST transition it to approved, MUST record an audit event (actor, project, requirement, transition, timestamp), and MUST NOT require any role beyond owner/member.

#### Scenario: Member cannot approve
- **WHEN** a non-owner member attempts to approve a requirement
- **THEN** the system MUST reject the transition and MUST NOT introduce a custom reviewer/approver role to satisfy it.
```

```markdown
### Requirement: Approved requirements link to generated test cases
The system SHALL allow only approved requirements to be selected as AI generation input and MUST link generated test cases back to the requirement version used.

#### Scenario: Approved requirement feeds AI generation
- **WHEN** a member selects an approved requirement as the input for AI test generation
- **THEN** the system MUST use the requirement content as generation input and MUST record a link from each generated draft case to that requirement version.

#### Scenario: Revised requirement preserves prior linkage
- **WHEN** an approved requirement is revised to a new version after cases were generated
- **THEN** previously generated cases MUST retain their link to the original requirement version for traceability.
```

### `specs/llm-chat/spec.md` — `## ADDED Requirements`

```markdown
### Requirement: Users can chat over configured model providers via backend orchestration
The system SHALL let project members hold interactive, single-turn-or-conversational chat sessions over a model provider configured in platform-foundation, with the LLM call made exclusively by the NestJS backend. Chat is conversational-only (no tool-calling, no multi-step state, no human-approval gating) and therefore is not in scope of backend-ai-orchestration's multi-step workflow requirement.

#### Scenario: Member sends a chat message
- **WHEN** a member sends a message in a chat session bound to a configured provider
- **THEN** the backend MUST make the LLM call and MUST stream the response to the client over the shared streaming contract; the client MUST NOT call the LLM directly.

#### Scenario: Chat is inaccessible without a configured provider
- **WHEN** no model provider is configured for the selected kind
- **THEN** the system MUST prevent starting a chat session and MUST surface a clear reason to the user.
```

```markdown
### Requirement: Chat sessions are persisted
The system SHALL persist chat sessions and their messages so members can reopen and continue them.

#### Scenario: Member reopens a session
- **WHEN** a member reopens an existing chat session
- **THEN** the system MUST load prior messages in order and MUST allow new messages to be appended to the same session.
```

```markdown
### Requirement: Chat interactions are audited and secrets-free
The system SHALL audit chat session events (actor, provider, project, timestamp, outcome) and MUST NOT persist or log provider credentials or raw secrets.

#### Scenario: Chat session is audited
- **WHEN** a member sends a message and receives a response
- **THEN** the system MUST record an audit event linking actor, project, provider, and timestamp, and MUST NOT include provider credentials in the audit entry, logs, or persisted message payloads.
```

### `specs/mcp-admin/spec.md` — `## ADDED Requirements`

```markdown
### Requirement: MCP tools are reviewable and approvable under simple roles
The system SHALL surface discovered MCP tools for review and let a project owner approve (allowlist) or revoke project-scoped tools using no roles beyond owner/member. The platform provides only project-scoped MCP tools; there is no global MCP tool category and therefore no global approver role.

#### Scenario: Owner allowlists a project-scoped MCP tool
- **WHEN** a project owner approves a reviewed MCP tool for the project
- **THEN** the system MUST add it to the project allowlist, MUST record an audit event, and MUST NOT require a custom approver role.

#### Scenario: Owner revokes a tool
- **WHEN** an owner revokes a previously allowlisted tool
- **THEN** the system MUST remove it from the allowlist and subsequent calls to that tool MUST be rejected.
```

```markdown
### Requirement: The approved allowlist is the source of truth for backend MCP calls
The system SHALL source the set of approved MCP tools exclusively from the mcp-admin allowlist, and the backend AI orchestration MUST reject any tool call not present in the allowlist before invocation. mcp-admin owns this rejection predicate; backend-ai-orchestration references it without re-stating it.

#### Scenario: Non-allowlisted tool call is rejected
- **WHEN** a LangGraph node requests an MCP tool that is not in the approved allowlist
- **THEN** the backend MUST reject the call before invocation and MUST record the rejection.

#### Scenario: Allowlisted tool call is executed and traced
- **WHEN** a LangGraph node requests an MCP tool present in the allowlist
- **THEN** the backend MUST invoke it via the backend-managed MCP client and MUST record a McpToolCall metadata entry (tool, server, approved flag, redacted args, result meta, status, timing).
```

```markdown
### Requirement: MCP admin actions and tool calls are audited end-to-end
The system SHALL record admin governance actions (propose/review/approve/revoke) and per-call tool metadata, queryable together for a project or tool.

#### Scenario: Auditor reviews MCP tool history
- **WHEN** an auditor queries the history of an MCP tool
- **THEN** the system MUST return the admin action trail and all McpToolCall entries for that tool, with redacted arguments and no raw secrets.
```

---

## 4. 需要修改的 proposal/design/tasks

### 载体决定（V-c）
- **第二 change（本变更，`fill-spec-gaps-phase3`）= 纯 ADDED**：5 个新 `specs/<cap>/spec.md` + 自身 `proposal.md`/`design.md`/`tasks.md`。零 MODIFIED。当下可编写并通过 `openspec validate`。
- **第三 change（`fill-spec-gaps-modifieds`，post-archive，显式提交产物）= 所有 MODIFIED deltas**：须在 prior change 归档后创建，MODIFIED 解引真实 `openspec/specs/`。其范围**显式枚举如下**（非模糊承诺）：
  1. `web-ui`：ADDED R4（chat 路由）/ R5（mcp-admin 路由）/ R6（api-automation 路由，MVP 占位 + Phase 3 完整），**不 fattening R3**。
  2. `backend-ai-orchestration`：MODIFIED R3 仅引用 mcp-admin allowlist（"MCP invocations SHALL use the mcp-admin allowlist (see mcp-admin)"），不重述拒绝谓词。
  3. `ai-test-generation`：MODIFIED R1 增"已批准受管需求为可选输入 + 生成用例回链需求版本"场景。
  4. `clean-room-rebuild`：**ADDED R5**（"Non-goal reconciliation is explicit"）——永久非目标（企业微信/复杂 RBAC/全 DOCX 编辑器/分布式 UI 执行）保持永久；API 自动化套件 + 完整 MCP 管理 LIFT 到 Phase-3 spec-first 门控。**保留 R3 原措辞**。
  5. `test-asset-management`：**仅文档/索引联动**——因 test-suite 采用自包含 SuiteRun（持有执行记录 ID 列表），**无 FK 改动需求**；第三 change 仅在性能需要时追加索引/约束，非功能前置。

### `fill-spec-gaps-phase3/proposal.md`（新，纯 ADDED）
- **Why**：Phase 3 spec-first 门控；5 域缺 binding 场景；本变更是门控。
- **What Changes**：ADD capabilities: test-suite, api-automation, requirement-management, llm-chat, mcp-admin（均 Phase 3）。无 MODIFIED（延后第三 change）。
- **MVP**：UNCHANGED——明确"无 MVP 影响；API 自动化 MVP 仅为 web-ui 占位路由（web-ui 既有 R3 范畴）"。
- **Required Post-MVP Capabilities**：追加 5 新 cap 至既有清单（KB/RAG, Skills store, + 这 5 个）。
- **Non-Goals**：KEEP 永久（企业微信/复杂 RBAC/全 DOCX 编辑器/分布式 UI 执行）；LIFT 到 Phase-3（API 自动化套件/完整 MCP 管理）；注："Supersedes `rebuild-ai-test-platform/proposal.md` 与 `design.md` 中关于 API 自动化套件与完整 MCP 管理的非目标陈述——解 lift 落到第三 change 的 clean-room-rebuild R5。其余非目标不变。"
- **Capabilities → New**：5 slug。**Modified**：无（本 change）；第三 change 枚举见上。
- **Impact**：解锁 Phase 3 实现；第三 change 承载所有 MODIFIED，须 prior change 归档后创建。

### `fill-spec-gaps-phase3/design.md`（新）
- **Context**：prior gap 审计（PLAN.md §1）识别 5 域；本变更纯 ADDED 填充。
- **Goals/Non-Goals**：Goal = 5 域 binding spec + 显式非目标协调（第三 change）。Non-goals = 不改 MVP、不引入新角色、无客户端 LLM/MCP、无分布式 API 执行 worker。
- **Decisions**：
  - D8 Suite 执行复用执行记录模型，**自包含 SuiteRun**（持执行记录 ID 列表），不改 test-asset-management。
  - D9 API 执行记录对标浏览器执行；secrets-as-refs；本地 Electron worker 默认执行器；分布式 API worker 延后。**显式 Phase-3 门控**。
  - D10 需求评审仅 owner/member；draft→reviewed→approved；版本回链。
  - D11 Chat 后端拥有 LLM，复用共享流式契约；**会话级、无 tool-calling/多步/人审 → 不属 backend-ai-orchestration R2 范围，无需 MODIFIED/豁免**。
  - D12 MCP allowlist 单一真相源；mcp-admin 拥有拒绝谓词；orchestration 引用；撤销下次调用生效。**MCP 工具限定项目级**。
  - D13 非目标协调 binding（第三 change clean-room-rebuild ADDED R5），保留 R3 措辞。
  - D14 载体 V-c：纯 ADDED 第二 change + 显式第三 change 承载 MODIFIED；避免跨未归档 change 的非法 MODIFIED。
- **Risks**：spec 蔓延、clean-room 污染（5 域最高诱惑）、跨 cap 耦合、Phase-3 门控纪律、第三 change 前置依赖（显式枚举，非模糊承诺）、悬空引用风险（若 prior change 后续改写）。
- **Open Questions**：suite 执行拓扑（复用本地 Playwright worker vs 独立 runner）；API 执行器（本地 Electron vs 后端）；chat 会话 scope（用户 vs 项目默认）；MCP 工具发现源（手动注册 vs 自动发现）。

### `fill-spec-gaps-phase3/tasks.md`（新）— 任务组 11
- 11.1 写 `specs/test-suite/spec.md`（ADDED R1–R3，自包含 SuiteRun）+ 可测性评审。
- 11.2 写 `specs/api-automation/spec.md`（ADDED R1–R3，含显式 Phase-3 门控 + clean-room provenance）。
- 11.3 写 `specs/requirement-management/spec.md`（ADDED R1–R3）。
- 11.4 写 `specs/llm-chat/spec.md`（ADDED R1–R3，会话级 scope 声明）。
- 11.5 写 `specs/mcp-admin/spec.md`（ADDED R1–R3，MCP 工具限定项目级）。
- 11.6 运行 spec 验收门（§6 Gate A–D）。
- 11.7 （第三 change，post-archive）写 `fill-spec-gaps-modifieds`：枚举的 5 项 MODIFIED/ADDED deltas。
- 11.8 （延后，独立 impl change）Phase 3 实现——11.1–11.7 批准前不得开工。

---

## 5. 风险和非目标

### 风险
1. **Spec 蔓延**：Phase 3 暗中扩张超 5 域。*缓解*：Non-Goals 枚举恰好 5 cap；第 6 cap 须新 change；验收门拒范围新增。
2. **Clean-room 污染**：5 域为 WHartTest 对标诱惑最高处。*缓解*：每新 cap 附 clean-room provenance 场景（如 api-automation R3）+ §6 provenance 检查；无上游 DSL/prompt/layout/asset 复用；CI clean-room 扫描扩至 Phase 3 模块。
3. **跨 cap 耦合**：requirement-management→ai-test-generation、mcp-admin→backend-ai-orchestration、suite→test-asset+executions。*缓解*：MODIFIED（第三 change）使耦合单向显式；mcp-admin 拥有拒绝谓词唯一所有权；test-suite 自包含 SuiteRun 避免改 test-asset-management。
4. **Phase-3 门控纪律**：实现早于 spec 批准。*缓解*：clean-room-rebuild（第三 change ADDED R5）阻塞 lifted-cap 实现前置 spec；tasks 11.8 为独立 impl change 依赖 11.1–11.7。
5. **第三 change 前置依赖**：MODIFIED 须 prior change 归档。*缓解*：第三 change 范围显式枚举（§4），为已提交产物非模糊承诺；归档后 MODIFIED 解引真实 specs；若 prior change 被改写，第三 change MODIFIED 须重审。
6. **悬空引用风险**：纯 ADDED 第二 change 的 prose 引用 prior change 的 ADDED cap，validator 不强制解引；若 prior change 后续改写则悬空。*缓解*：§6 Gate D 一致性检查 + 归档时 reconcile。
7. **Simple-roles 蔓延**：评审/审批工作流可能误引入 reviewer/approver 角色。*缓解*：每此类 requirement 显式"无新角色"；§6 扫描角色蔓延语言；mcp-admin 限定项目级工具避免全局 admin。
8. **mcp-admin 全局工具边界**：若未来需平台全局 MCP 工具，当前 simple-roles 无法审批。*缓解*：D12 显式声明平台仅项目级 MCP 工具；全局工具为后续独立 change（须先形式化 admin 角色）——列为非目标。

### 非目标（显式协调）
- **KEEP 永久（绝不在范围）**：企业微信；复杂 RBAC（无权限矩阵/自定义角色）；全 DOCX 编辑器；分布式 UI 执行/远程 Playwright worker 池；**平台全局 MCP 工具 + 全局 admin 审批角色**（mcp-admin 仅项目级）。
- **LIFT 到 Phase 3（planned，spec-first 门控，由本变更 + 第三 change）**：API 自动化套件（完整）；完整 MCP 管理。
- **Phase 3 内仍延后**：分布式 API 执行 worker（API 自动化经本地 Electron worker；分布式 API worker 为后续 spec-first change）；MCP 工具自动发现（先手动注册）；跨项目需求复用；chat 多 provider fan-out；chat tool-calling/多步（若需要须先纳入 backend-ai-orchestration R2 范围并相应 MODIFIED）。

---

## 6. Spec 质量验证（扩展"测试计划"——deliberate 模式）

因本变更为 *spec-writing*，验证为 spec 质量，非单元/集成代码测试。4 门，归档前全过：

- **Gate A — 场景可测性评审**：每 `#### Scenario:` ≥1 `WHEN` + ≥1 `THEN`；THEN 二值可检（持久/未、存在/不存在、拒/受）；无 "should/may/appropriately" 含糊。评审 = code-reviewer/critic 道。
- **Gate B — Clean-room provenance 检查（每新 cap）**：5 新 cap 各有 clean-room 场景或 design.md provenance 注记；CI clean-room 扫描扩至 5 新模块路径；无上游 DSL/prompt/asset/layout 名引用。
- **Gate C — 非目标 diff 门**：diff clean-room-rebuild R3/R5 before/after——确认企业微信/复杂 RBAC/全 DOCX 编辑器/分布式 UI 执行仍被拒；确认 API 自动化套件 + 完整 MCP 管理**仅** LIFT 到 Phase-3-spec-gated；确认无其他非目标被暗中 lift。评审 = critic 道。（第三 change 落地时执行。）
- **Gate D — 跨 cap 一致性检查**：耦合单向且被引 requirement 存在：mcp-admin R2 引用 backend-ai-orchestration.3（第三 change MODIFIED 一致）；requirement-management R3 引用 ai-test-generation.1（第三 change MODIFIED 一致）；test-suite R3 引用 test-asset-management.2-3（既有，自包含 SuiteRun 不改）；llm-chat R1 引用 platform-foundation.3（既有，存在）；web-ui（第三 change）引用 3 个 UI-backed 新 cap；simple-roles 不变量在 requirement-management R2 与 mcp-admin R1 成立（无角色蔓延）。**悬空引用检查**：第二 change prose 引用的 prior change ADDED cap 须在归档时 reconcile。

### Pre-mortem（针对修订后真实 Top 风险）
1. **第三 change 前置依赖 / 悬空引用**：第二 change 纯 ADDED 可过 validate，但其 prose 引用 prior change 的 ADDED cap；若 prior change 后续被改写/拒绝，引用悬空；或第三 change 未交付则 MODIFIED（含非目标 lift）永不生效，api-automation/mcp-admin 形式上仍是 design.md 非目标。
   *缓解*：第三 change 范围显式枚举（§4）为已提交产物；归档顺序强制（prior 先归档）；Gate D 归档时 reconcile；若 prior 被改写，第三 change MODIFIED 重审。
2. **SuiteRun 自包含设计的实现偏差**：test-suite R3 假设 SuiteRun 持执行记录 ID 列表，但实现可能误读为需改 test-asset-management FK。
   *缓解*：D8 明确自包含设计；R3 场景措辞明示"由 SuiteRun 持有执行记录 ID 列表"；Gate D 确认无 test-asset-management MODIFIED 依赖。
3. **mcp-admin 全局工具边界被突破**：实现中引入平台全局 MCP 工具却无全局审批角色 → RBAC 蔓延或不可审批工具。
   *缓解*：D12 + mcp-admin R1 显式声明仅项目级工具；全局工具为非目标（§5）；Gate D 扫描角色蔓延。
4. **api-automation 被读为 MVP 约束**：web-ui.3 既有 SHALL 提及"API automation"，若 R1 无 Phase-3 门控声明则被误读为 MVP 约束。
   *缓解*：api-automation R1 显式 Phase-3 门控 + MVP 仅占位路由；Gate C 确认。

### Spec 验收门（本 gap-fill change 何时可归档？）
全部满足：
- 5 新 `specs/<cap>/spec.md` 存在，`## ADDED Requirements`，每 requirement ≥1 可测 WHEN/THEN 场景。
- proposal/design/tasks deltas（§4）完整；Non-Goals 显式协调 kept-permanent vs lifted-Phase-3。
- Gates A/B/D 通过并记录（Gate C 在第三 change 落地时执行）。
- 第三 change（`fill-spec-gaps-modifieds`）范围显式枚举，作为已提交 follow-up 产物登记。
- 无 Phase-3 实现任务（11.8）在本变更中开工/标记完成——为独立 follow-on impl change。

---

## 7. ADR

- **Decision**：载体 V-c——第二 change `fill-spec-gaps-phase3` 纯 ADDED（5 新 slug：test-suite/api-automation/requirement-management/llm-chat/mcp-admin），所有 MODIFIED deltas 显式枚举于第三 post-archive change `fill-spec-gaps-modifieds`。test-suite 用自包含 SuiteRun（不改 test-asset-management）。mcp-admin 限定项目级工具（不引入全局 admin）。llm-chat 会话级、不属 backend-ai-orchestration R2 范围（无需 MODIFIED/豁免）。非目标协调落 clean-room-rebuild ADDED R5（保留 R3 措辞）。
- **Drivers**：结构合法性（跨未归档 change MODIFIED 非法）、跨 change 引用语义、simple-roles/clean-room/后端编排不变量边界、MVP 审批洁净。
- **Alternatives considered**：V-a 修订既有 change（重开 MVP 审批面，否决）；V-b 先归档再 follow-on（须先批准+归档，序列化阻塞，但 MODIFIED 可解引——保留为若归档顺畅的备选）；llm-chat/mcp-admin extend 既有 cap（bounded context 混淆，否决）；test-suite 改 test-asset-management 加 FK（跨 change MODIFIED 阻塞 + 不必要，改自包含 SuiteRun）；mcp-admin 引入全局 admin（RBAC 蔓延，改限定项目级）；非目标 lift 重写 clean-room-rebuild R3（失原措辞，改 ADDED R5）。
- **Why chosen**：V-c 让 gap-fill spec 当下可写可验证、保 MVP 审批洁净、MODIFIED 排序工具可强制；自包含 SuiteRun 避免 test-asset-management 依赖；项目级 MCP 工具守 simple-roles 不变量；会话级 chat 无须触动 backend-ai-orchestration R2。
- **Consequences**：第二 change 可独立批准；api-automation/mcp-admin 的非目标 lift 须待第三 change（clean-room-rebuild R5）方 binding 生效——在此之前它们形式上仍是 design.md 非目标，但本变更的 ADDED spec 不违反可执行非目标（clean-room-rebuild R3 仅拒企业微信/复杂 RBAC）。代价：第三 change 为功能前置（已显式枚举，非模糊承诺）。
- **Follow-ups**：归档 prior change → 创建第三 change `fill-spec-gaps-modifieds`（5 项 MODIFIED/ADDED）→ Phase 3 impl change。Open Questions（design.md）：suite 执行拓扑、API 执行器、chat scope、MCP 发现源。

---

## 8. 执行边界（本轮）

本文件为 **PENDING APPROVAL** 规划产物。**未创建/修改任何 openspec 文件、未写业务代码、未提交/推送/建 PR、未委派实现。** 批准后可经 `/oh-my-claudecode:team`（并行，推荐）或 `/oh-my-claudecode:ralph`（顺序）执行——执行内容为创建上述 openspec spec/proposal/design/tasks 文件（spec-writing），非业务代码。
