# 计划：从零实现 WHartTest 风格 AI 自动化测试平台（Clean-Room Rebuild）— 第 3 轮合并统一计划

> 状态：**PENDING APPROVAL**（本轮仅规划，未执行任何代码/文件变更；未创建/修改任何 openspec 文件）。
> 需求源：`openspec/changes/rebuild-ai-test-platform/` 是**唯一**约束性需求源。
> WHartTest 仅作**通用产品调研**参考——不引用、不复制其源码/素材/Logo/文案/样式/配置/提示词/文档/布局。
> 本轮性质：**合并 + §11 增量**。第 1 轮（PLAN.md，输出 1–10，含 Architect R1–R10 + Critic MUST-1..7）与第 2 轮（PLAN-SPECFILL.md，Phase-3 spec 结构 + 5 新 cap + V-c 载体）均已通过 Planner→Architect→Critic 共识。本轮**不重新审判**任何已定决策，仅合并并新增 §11。

> **术语消歧（Architect #2）**：本计划有两处"R5"——
> - **Architect-R5** = 第 1 轮 Architect 修订第 5 条：凭据用 Postgres 信封加密（§5/§9）。
> - **clean-room-R5** = 第 2 轮第三 change 对 `clean-room-rebuild` 新增的 ADDED Requirement R5（非目标协调，§4.4）。
> 凡 §11/§13 引用均用**限定标签**，禁止裸用"R5"。

---

## 0. RALPLAN-DR 决策摘要（第 3 轮 · 合并 + §11）

### 原则（Principles）— 6 条（承前 5 + 本轮新增第 6）
1. **Spec 门控范围**：仅 OpenSpec 场景产生约束性工作。13 域中 OpenSpec 未覆盖者一律 spec-first，绝不臆造需求。
2. **Clean-room by construction**：全新仓库/数据模型/文案/UI。上游只告诉"存在什么问题"，绝不告诉"如何实现"。有风险的参考先写 provenance 记录。
3. **编排在后端**：所有 AI/LangGraph/MCP/LLM 调用跑在 NestJS；前端与桌面是同一套 REST + 流式契约的瘦客户端。
4. **落库前必须人审 + 简单角色不变量**：AI 永不直接写入 canonical 资产；Skills/MCP 只经受控适配器 + 权限审查。所有评审/审批仅用 owner/member，不引入 reviewer/approver/全局 admin 角色。
5. **证据优先**：每个阶段以可测 WHEN/THEN 验收 + clean-room 评审门收口，验收与 OpenSpec 场景双向可追溯（MUST-6 + MUST-7 每修订绑定测试）。
6. **显式非实现可追溯性（explicit-non-implementation-traceability）**【本轮新增】：每一项"不实现/不在当前阶段实现"的声明必须可追溯到源不变量/决策。**兜底规则（Architect #1，承重）**：任何拟实施项若**既无法追溯到 §2/§3/§4 的 in-scope、又未在 §11 列出**，一律按**最保守类别**处理（即视为禁止），须经**新 change 显式 lift** 方可实施。非目标 lift 须落到 binding spec 而非 prose 编辑。§11 即此原则的可执行产物，由 §13 F1–F7 门强制。

### 决策驱动（Top 3）— 本轮为合并 + §11
1. **合并保真度（consolidation fidelity）**：两份前序产物须合并为单一内部一致文档，不得漂移、矛盾或遗失任一 R1–R10 / MUST-1..7 / 第 2 轮决策的实质。
2. **§11 详尽性 + 可追溯性**：§11 须穷尽所有非实现项并逐条引用源不变量；负契约的完整性不可证（无法证明"无遗漏"），故由兜底规则将举证负担从"证明完整"转为"阻断未列项"。
3. **不重新审判已定决策（no re-litigation）**：本轮不重开 R1–R10、MUST-1..7、V-c、自包含 SuiteRun、mcp-admin 项目级、llm-chat 会话级、第三 change MODIFIED 等任何已共识事项。

### 可行选项（合并方法）
- **选项 C1 — 合并前序产物（consolidate prior artifacts）✅ 选定**：以 PLAN.md 输出 1–10 为骨架，将 PLAN-SPECFILL.md 的 Phase-3 具体结构并入 §4，并新增 §11。理由：两份产物已分别通过完整共识；合并保留全部决策实质，成本最低、漂移风险最小。
- **选项 C2 — 从头重新推导（re-derive from scratch）**：失效。理由：会重开 R1–R10 / MUST-1..7 / V-c 等已定决策的论证，违反"不重新审判"驱动；无新信息输入下重新推导只会引入漂移。

---

## 1. WHartTest 对标功能矩阵（Feature Parity Matrix）

能力以**通用行业模式**描述（clean-room；不引用上游任何表达）。OpenSpec 覆盖态经前两轮核验（含 Critic MUST-3 对域 8 的修正与 MUST-4 对争议行的核验）。

| # | 功能域 | 通用行业能力（产品调研视角） | OpenSpec 覆盖态 | 阶段 | §11 归类 |
|---|---|---|---|---|---|
| 1 | 用户登录 | 账号登录/会话；只可访问自己拥有或受邀的项目 | Covered（platform-foundation.1） | MVP | in-scope |
| 2 | 项目管理 | 项目 + owner/member 简单角色（无复杂 RBAC） | Covered（platform-foundation.2） | MVP | in-scope |
| 3 | 测试用例 | 模块→用例→有序步骤、预期结果、优先级/状态/标签/备注 | Covered（test-asset-management.1） | MVP | in-scope |
| 4 | 测试套件 | 用例分组/排序为可运行套件 + 套件级执行/报告汇总 | Not-in-OpenSpec → 新 `test-suite` slug（自包含 SuiteRun） | Phase 3（spec-first） | §11(b6)/(c1)/(d1) |
| 5 | 测试执行记录和报告 | 执行记录关联 用例/步骤/环境 + 截图/日志/trace + 通过失败/耗时 | Covered（test-asset-management.2–3） | MVP | in-scope |
| 6 | LLM 配置 + LLM 对话 | 管理员配置 OpenAI 兼容 provider（配置 Covered）；交互式对话 UI（未覆盖） | Partial：配置 Covered；对话 UI Not-in-OpenSpec → 新 `llm-chat` slug（会话级） | 配置：MVP · 对话 UI：Phase 3 | §11(b5)/(c4)/(d1) |
| 7 | AI 生成测试用例 | 从需求文本/上传上下文/项目知识 经 LangChain+LangGraph 生成结构化用例 → 草稿人审 | Covered（ai-test-generation.1–3） | MVP | in-scope |
| 8 | 接口自动化测试 | HTTP 接口编排/执行/断言 | In-OpenSpec, 部分延后：web-ui.3 SHALL；design.md 完整套件非目标 → 新 `api-automation` slug（显式 Phase-3 门控） | 占位路由：随 Web UI · 完整套件：Phase 3 | §11(b7)/(c2)/(d1)/(d2) |
| 9 | 需求管理和需求评审 | 需求实体 + 评审/审批工作流，喂给 AI 生成 | Not-in-OpenSpec → 新 `requirement-management` slug | Phase 3（spec-first） | §11(b 隐含)/(c3)/(d1) |
| 10 | 知识库/RAG | 项目级 KB、ingest/chunk/embed/retrieve + 来源归因 + 诊断 | Covered（knowledge-rag.1–5；"required post-MVP"） | Phase 2 | in-scope |
| 11 | MCP 工具管理 | 后端托管 MCP client + 白名单 + 调用元数据（后端机制 Covered）；用户侧管理 UI（未覆盖） | Partial：后端机制 Covered（backend-ai-orchestration.3）；管理 UI Not-in-OpenSpec → 新 `mcp-admin` slug（项目级） | 后端机制：Phase 2 · 管理 UI：Phase 3 | §11(b4)/(c5)/(d1)/(d2) |
| 12 | Skills 技能库 | 包+校验和验证、install/update/disable/uninstall、权限审查、受控适配器、回滚 | Covered（skills-store.1–5；"required post-MVP"） | Phase 2 | in-scope |
| 13 | 本地 Playwright 浏览器自动化 | Electron 托管本地 worker；claim/执行/上报 非阻塞；超时/限额/策略；产物 | Covered（automation-workers.1–4；desktop-app.4） | MVP | in-scope |

**诚实的差距声明**（MUST-3 / MUST-4 已核验）：域 4、6(对话)、8(完整套件)、9、11(UI) 在当前 OpenSpec 下**非约束性**，全部 Phase 3 且**先补 OpenSpec 场景再实现**。域 8 特例：web-ui.3 已用 SHALL 提及"API automation"，故 Web UI 上线时须提供**可导航占位路由**作为 web-ui.3 的部分满足，完整套件仍 Phase 3。第 2 轮已为这 5 域确定具体新 slug 与载体（见 §4）。

---

## 2. MVP 范围（严格对齐 OpenSpec MVP）

**仅包含以下**：
- **平台基座（MVP 依赖）**：登录鉴权 + 项目访问域（platform-foundation.1）；owner/member 简单角色，无复杂 RBAC（platform-foundation.2）；模型 provider 配置（base URL + model name + **凭据引用**，Architect-R5 信封加密，platform-foundation.3）；审计日志（platform-foundation.4）。
- **测试资产（MVP）**：项目级 模块、用例、有序步骤、预期结果、优先级/状态/标签/备注（test-asset-management.1）。
- **AI 生成用例（MVP）**：从**需求文本 + 上传上下文**（`AiRunInput`，R4）生成结构化草稿；**人审 编辑/接受/拒绝 后方可 canonical**；流式进度 + 持久化 trace（ai-test-generation.1–3）。*"existing project knowledge"（RAG 路径）= Phase 2。*
- **后端 AI 编排（MVP 子集）**：NestJS 拥有编排 API；LangGraph 多步工作流含 **state / 原生 tool 调用 / 重试 / 流式 / 人审**（MUST-2 全 facet 落地，见 §8）；SSE/WebSocket 共享契约（backend-ai-orchestration.1,2,4）。**R7：MVP 图拓扑上无 MCP/Skill 节点**（.3 MCP 节点与 Skill 适配器 = Phase 2）。
- **自动化 worker（MVP）**：Electron 托管本地 Playwright worker；claim/本地执行/上报**不阻塞 NestJS API 线程**（R2：经认证会话流，非 BullMQ 传输）；超时/资源限额/网络策略/日志脱敏；截图+日志+trace 元数据登记到执行记录（automation-workers.1–4）。
- **执行记录 + 产物（MVP）**：关联 项目/用例/步骤/环境；每次本地执行保留 截图+日志+Playwright trace；产物元数据可见；显示 通过失败/失败步骤/耗时（test-asset-management.2–3）。
- **桌面 app（MVP）**：Electron 复用 Nuxt UI（R6：桌面构建为 SPA/静态，`ssr:false`/`nuxt generate`）；native 仅经窄类型化 preload 桥（context isolation，renderer 不触 Node/fs）；与 Web 同一 API/流/鉴权契约；启停/监控本地 worker；后端端点可配置、安全存储（desktop-app.1–5）。
- **Web UI（MVP 切片）**：项目导航、用例管理、AI 生成评审、执行报告、设置（web-ui.3 子集）。Nuxt3+Vue3+TS+Tailwind+shadcn-vue，全部一方组件（web-ui.1–2）。**含 `/projects/:id/api-automation` 导航占位路由**作为 web-ui.3 的部分满足（MUST-3）。

**MVP 明确排除**：详见 §11(b)。要点：KB/RAG、Skills 商店、MCP 管理 UI、LLM 对话 UI、测试套件、完整 API 自动化套件（仅占位路由）、分布式/远程 worker、LangGraph durable checkpointer/interrupt（Architect-R1 用 Prisma run-state）、BullMQ 作 worker 传输（Architect-R2 用会话流）、服务端事件重放缓冲（Architect-R8 用快照重取）、外部密钥管理器（Architect-R5 用信封加密）、Qdrant-first（A1 用 pgvector-first）。

---

## 3. 第二阶段范围（Phase 2 — OpenSpec 要求的 post-MVP + 加固）

- **完整 KB/RAG（knowledge-rag.1–5）**：项目级 KB CRUD + 隔离；ingest→抽取→chunk→保留来源元数据；embeddings + **可替换 `RetrievalBackend` 接口**（pgvector-first，A1，R9 摩擦已标记）；RAG 上下文注入生成 + 可追溯来源归因；检索诊断。并将 KB 上下文接入 AI 生成（与 R4 的 `AiRunInput` 上传上下文互补）。
- **完整 Skills 商店（skills-store.1–5）**：包格式 installable 前验证；browse/install/update/disable/uninstall；**激活前显式权限审查**；经**受控适配器**接入 LangGraph+MCP（无任意执行）；update + **回滚**；**验证失败保留当前版本**。
- **后端 MCP 集成（backend-ai-orchestration.3）**：MCP TS SDK client 后端托管，approved-tools 白名单，记录 tool-call 元数据（*机制*；管理 UI 仍 Phase 3）。**拒绝谓词的单一真相源在第 2 轮决定归于 mcp-admin**（Phase 3 cap），第三 change MODIFIED 后 backend-ai-orchestration.3 仅引用、不重述。
- **加固**：流式契约健壮性（重连/背压）、产物保留/大小限额执行、审计覆盖扩展、检索后端可替换性测试。

---

## 4. 第三阶段范围（Phase 3 — spec-first 门控）

### 4.1 门控不变量（承 PLAN.md §4）
每项**先补对应 OpenSpec 需求（WHEN/THEN 场景）并批准，才开始实现**（clean-room-rebuild.3 + 唯一需求源不变量）。默认动作：defer + 提出 spec 增补。

### 4.2 具体载体与 spec 结构（承 PLAN-SPECFILL.md 第 2 轮共识）

**载体决定 V-c**：
- **第二 change `fill-spec-gaps-phase3` = 纯 ADDED**：5 个新 `specs/<cap>/spec.md` + 自身 proposal/design/tasks。零 MODIFIED。当下可编写并通过 `openspec validate`。
- **第三 change `fill-spec-gaps-modifieds`（post-archive，显式提交产物）= 所有 MODIFIED deltas**：须在 prior change 归档后创建，MODIFIED 解引真实 `openspec/specs/`。其范围显式枚举（见 4.4），非模糊承诺。

**5 新 capability**（均 Phase 3）：

| Slug | 范围（一行） | New/Extend | 关键约束 |
|---|---|---|---|
| `test-suite` | 项目级 suite 实体 + 有序用例成员 + suite 级执行（汇总每用例结果） | Brand-new | **自包含 SuiteRun**（持执行记录 ID 列表），不改 test-asset-management 功能 FK |
| `api-automation` | HTTP 请求定义 + 断言 + 执行记录（对标浏览器执行）；Web UI 路由由此 cap 支撑 | Brand-new | **显式 Phase-3 门控**；MVP 仅占位路由 |
| `requirement-management` | 需求实体 + 评审/审批工作流（仅 owner/member）+ 已批准需求到生成用例的关联 | Brand-new | 无新角色；draft→reviewed→approved |
| `llm-chat` | 基于已配置 provider 的交互对话 + 会话持久化 + 审计；后端拥有 LLM 调用 | New slug | **会话级、无 tool-calling/多步/人审** → 不在 backend-ai-orchestration R2 范围，无需 MODIFIED/豁免 |
| `mcp-admin` | MCP 工具治理界面：propose/review/approve/allowlist/revoke | New slug | **MCP 工具限定项目级**（无平台全局工具）；审批 = 项目 owner；不引入全局 admin 角色 |

### 4.3 每个 capability 的 Requirement 列表（承 PLAN-SPECFILL §2，逐字保留实质）

- **`test-suite`** — R1 Suites group ordered test cases；R2 Suite execution rolls up per-case results；R3 Suite runs reuse the execution-record and artifact model（**由自包含 SuiteRun 持有执行记录 ID 列表**实现联动，不修改 test-asset-management 功能 FK）。
- **`api-automation`** — R1 API test cases define requests and assertions（**显式 Phase-3 门控**：MVP 仅为 web-ui 占位路由）；R2 API executions produce execution records analogous to browser executions；R3 API automation respects secrets-as-references and clean-room。
- **`requirement-management`** — R1 Requirements are managed project-scoped entities；R2 Requirements follow a review and approval workflow using simple roles（仅 owner 批准，无新角色）；R3 Approved requirements link to generated test cases（回链需求版本）。
- **`llm-chat`** — R1 Users can chat over configured model providers via backend orchestration（**会话级、无 tool-calling/多步/人审**）；R2 Chat sessions are persisted；R3 Chat interactions are audited and secrets-free。
- **`mcp-admin`** — R1 MCP tools are reviewable and approvable under simple roles（**项目级**，无全局工具/角色）；R2 The approved allowlist is the source of truth for backend MCP calls（mcp-admin 拥有拒绝谓词，orchestration 仅引用）；R3 MCP admin actions and tool calls are audited end-to-end。

> 5 cap 的可测 WHEN/THEN 场景文本承 PLAN-SPECFILL §3，实质（场景条目、断言二值性、clean-room provenance 场景）逐字保留。

### 4.4 第三 change 显式枚举（MODIFIED deltas，post-archive）
1. `web-ui`：ADDED R4（chat 路由）/ R5（mcp-admin 路由）/ R6（api-automation 路由，MVP 占位 + Phase 3 完整），**不 fattening R3**。
2. `backend-ai-orchestration`：MODIFIED R3 仅引用 mcp-admin allowlist（"MCP invocations SHALL use the mcp-admin allowlist (see mcp-admin)"），不重述拒绝谓词。
3. `ai-test-generation`：MODIFIED R1 增"已批准受管需求为可选输入 + 生成用例回链需求版本"场景。
4. `clean-room-rebuild`：**ADDED clean-room-R5**（"Non-goal reconciliation is explicit"）——永久非目标保持永久；API 自动化套件 + 完整 MCP 管理 LIFT 到 Phase-3 spec-first 门控。**保留 R3 原措辞**（非重写 R3）。
5. `test-asset-management`：**仅性能索引/约束联动**——因 test-suite 采用自包含 SuiteRun，**无功能 FK 改动需求**；第三 change 仅在性能需要时追加索引/约束（非功能前置，非禁止触碰）。

### 4.5 非目标协调的可执行性（承第 2 轮 P5 + D13）
解除 prior 非目标须落到 binding spec（clean-room-rebuild ADDED clean-room-R5），非仅 prose 编辑。在第三 change 的 clean-room-R5 落地前，API 自动化套件与完整 MCP 管理**形式上仍是 design.md 非目标**；但第二 change 的纯 ADDED spec 不违反可执行非目标（clean-room-rebuild R3 仅拒企业微信/复杂 RBAC）。

---

## 5. 数据模型草案（Prisma 取向）

阶段标记：**[M]** MVP · **[P2]** Phase 2 · **[P3]** spec-first。**任何密钥均为密文/引用，无明文列。**

### 基座
- **User [M]**：id, email(uniq), displayName, passwordHash|外部鉴权引用, isAdmin, 时间戳。
- **Project [M]**：id, name, slug(uniq), description, ownerId→User, 时间戳。
- **ProjectMember [M]**：id, projectId, userId, role `owner|member`（**仅简单角色**）, invitedAt, acceptedAt?。Uniq(projectId,userId)。
- **ModelProvider [M]**：id, scope `global|project`, projectId?, name, kind `chat|generation|embeddings`, baseUrl, modelName, **`credentialCiphertext` + `credentialKeyId`（Architect-R5 信封加密；无明文）**, status `unvalidated|valid|invalid`, lastValidatedAt, createdBy, 时间戳。
- **AuditLog [M]**：id, actorId, projectId?, action, targetType, targetId, outcome `success|failure`, metadata Json, createdAt。

### 测试资产
- **Module [M]**：id, projectId, parentId?（树）, name, order, 时间戳。
- **TestCase [M]**：id, projectId, moduleId?, title, preconditions?, priority, status, tags[], notes?, origin `manual|ai-generated`, createdBy, 时间戳。
- **TestStep [M]**：id, testCaseId, order, action, expectedResult, data?。
- **TestExecution [M]**：id, projectId, testCaseId, environment, status `queued|dispatched|running|passed|failed|aborted|timeout`, startedAt, finishedAt, durationMs, failedStepId?, reportSummary Json, **workerJobId?（R2 作业生命周期/redelivery）**。
- **ExecutionArtifact [M]**：id, executionId, type `screenshot|log|trace|report`, storageRef, filename, sizeBytes, checksum, capturedAt, metadata Json。

### AI 编排
- **AiWorkflowRun [M]**：id, projectId, kind, status `running|awaiting-approval|accepted|rejected|failed|completed`, providerId?, createdBy, startedAt, finishedAt。**canonical 运行态存此（Architect-R1：不依赖 LangGraph checkpointer）。**
- **AiRunInput [M]**（R4：MVP 上传上下文之家，独立于 P2 KB 实体）：id, runId→AiWorkflowRun, kind `requirement-text|uploaded-attachment`, contentRef, filename?, sizeBytes?, checksum?, createdAt。
- **WorkflowStageEvent [M]**：id, runId, stage `context-retrieval|drafting|validation|review|persistence`, sequence, partialOutput? Json, status `success|fail`, retryCount, sourceAttribution?[P2] Json, createdAt。
- **McpToolCall [P2]**：id, runId, toolName, serverRef, approved, argsRedacted Json, resultMeta Json, status, 时间戳。

### 知识/RAG [P2]
- **KnowledgeBase [P2]**：id, projectId（隔离）, name, description, 时间戳。
- **Document [P2]**：id, knowledgeBaseId, filename, mimeType, sizeBytes, checksum, status `ingested|failed`, sourceMetadata Json, 时间戳。
- **DocumentChunk [P2]**：id, documentId, order, text, sourceMetadata Json, tokenCount。
- **EmbeddingRef [P2]**：id, chunkId, backend `pgvector|qdrant`, vectorRef, dims, model。*（R9：pgvector 需原生 SQL 迁移建 extension + hnsw/ivfflat 索引，ANN 走 `$queryRaw`；vectorRef 非 Prisma 原生列——P2 摩擦点已标记。）*

### Skills [P2]
- **Skill [P2]**：id, name, version, description, author, compatibility Json, permissions Json, entryPoints Json, checksum, source, validationStatus, 时间戳。Uniq(name,version)。
- **SkillInstallation [P2]**：id, projectId?, skillId, state `installed|disabled|uninstalled`, activatedPermissions Json, previousVersionId?（回滚指针）, installedBy, installedChecksum, 时间戳。
- **SkillInvocation [P2]**：id, installationId, runId?, workerJobRef?, adapter `langgraph|mcp|worker`, permissionsUsed Json, argsRedacted Json, resultMeta Json, status, invokedAt。

### Phase 3（spec-first，第二 change ADDED 后定义；此处仅占位，不预先实现）
- **TestSuite / SuiteMember / SuiteRun [P3]**（test-suite）：SuiteRun 自包含持有 execution-record ID 列表（不改 test-asset-management 功能 FK）。
- **ApiTestCase / ApiAssertion / ApiExecution [P3]**（api-automation）：secrets 为信封加密引用；响应快照脱敏。
- **Requirement / RequirementVersion [P3]**（requirement-management）：draft→reviewed→approved；生成用例回链需求版本。
- **ChatSession / ChatMessage [P3]**（llm-chat）：会话级持久化；审计；凭据不入载荷。
- **McpToolAllowlist [P3]**（mcp-admin）：项目级；propose/review/approve/revoke 治理生命周期；为 backend MCP 调用单一真相源。

---

## 6. API 边界（按 NestJS 模块）

所有 AI 编排在 **NestJS**（绝不在前端/桌面）。桌面复用**同一** REST + 流 + 鉴权契约（desktop-app.3）。传输：CRUD/命令用 REST；流式用 SSE 或 WS（共享契约，backend-ai-orchestration.4）。

| NestJS 模块 | 阶段 | REST（代表） | 流式 |
|---|---|---|---|
| AuthModule | M | `POST /auth/login`, `/logout`, `GET /auth/me`, **`POST /auth/worker-token`（R3 铸造 per-user worker token）** | — |
| ProjectsModule | M | `CRUD /projects`, 成员管理（仅 owner/member） | — |
| ModelProvidersModule | M | `CRUD /model-providers`, `POST /:id/validate`（**Architect-R5 永不返回密钥**） | — |
| AuditModule | M | `GET /audit?project=&actor=&action=` | — |
| TestAssetsModule | M | `CRUD /projects/:id/modules`、`.../test-cases`、`.../steps`（有序） | — |
| ExecutionsModule | M | `GET/POST /projects/:id/executions`, `GET /executions/:id[/artifacts]` | `GET /executions/:id/events` |
| WorkerGatewayModule | M | **认证的**长连会话流分发作业（R2）；`ack/heartbeat/logs/result/artifacts`；作业持久化 `queued/dispatched/running/done`，重连重投未 ack（R2/§7） | worker↔backend 会话流（非阻塞 API 线程） |
| AiOrchestrationModule | M（核心）/ P2（MCP+Skill 节点） | `POST /ai/test-generation`, `GET /ai/runs/:id`, `POST /ai/runs/:id/approve|reject|persist`（**Architect-R1：读 Prisma run 态续跑 post-approval 子图**） | `GET /ai/runs/:id/stream`（stage/partial/成功失败） |
| KnowledgeModule | P2 | KB/文档 CRUD、ingest、`POST /projects/:id/retrieval/query`（诊断） | ingest 进度 |
| SkillsModule | P2 | install/disable/uninstall/update/rollback/permissions.approve | — |
| McpModule | P2（机制）/ P3（mcp-admin UI） | 后端内部 client 管理；`GET /ai/runs/:id/tool-calls`；**拒绝谓词归 mcp-admin**（第三 change 后引用） | — |
| WebUI 占位（web-ui.3） | 随 Web 上线 | **`/projects/:id/api-automation` 导航占位**（完整套件 Phase 3） | — |
| P3（spec-first） | P3 | Suites / ApiAutomation / Requirements / Chat / McpAdmin：**仅在 OpenSpec 增补（第二 change ADDED + 第三 change MODIFIED）批准后定义** | Chat 流式响应 |

**共享流式契约**：版本化事件包 `{ runId|executionId, seq, type, stage?, payload, ts }`；SSE/WS 同包，Web+桌面同构消费。**Architect-R8：MVP 重连 = 快照重取**（GET 当前 run/execution 权威态，措辞为"获得当前权威态"而非"补发遗漏事件"），不做服务端逐事件重放缓冲；`seq` 仅用于排序。
**边界规则**：客户端只调编排端点，绝不内嵌 LLM/LangGraph/MCP；桌面桥调**同一** HTTP/流端点，无特权旁路。

---

## 7. Electron + Playwright Worker 架构

**进程模型**：
- **Main**：生命周期；拥有类型化 IPC 面；派生/监控/停止**独立 worker 进程**；持有可配置后端端点（本地/staging/prod，安全存储）。
- **Preload（桥）**：`contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`；仅经 `contextBridge` 暴露窄类型 API；renderer **绝不**直触 Node/fs/child_process（desktop-app.2）。
- **Renderer**：Nuxt UI，**R6：桌面构建为 SPA/静态（`ssr:false` / `nuxt generate`）**，Web 目标可 SSR/SSG——共享 UI、双构建配置。经同一 REST/流/鉴权契约访问后端；桥仅用于 native/worker 控制。
- **Worker 进程（独立）**：Playwright 运行时；与 renderer 隔离；经私有通道与 main 通信；经 `WorkerGatewayModule` 上报后端，跑在 API 线程之外（automation-workers.1）。

**桥方法（白名单、无原生 Node）**：`worker.start/stop/status`、`backend.getEndpoint/setEndpoint`（枚举 profile）、`execution.subscribe`（代理流事件，renderer 无裸 socket）。

**R3 worker 鉴权**：桌面登录时后端铸造 **per-user worker token**（绑定 userId、短 TTL + refresh）；`ack/heartbeat/result/artifact` 均带该 token；后端**拒绝非本用户 worker 所属作业的结果**（防伪造/投毒）。

**R2 作业协议 + redelivery**：worker 认证后开长连会话流（**非 BullMQ 传输**——BullMQ 仅后端内部记账，N=1 单 worker 无仲裁价值）；后端把该用户作业经会话流下发，worker `ack`；socket 断开 = 离线。作业在 Prisma 持久化 `queued→dispatched→running→done`；**worker 重连时后端重投 `dispatched` 但未 ack/未完成的作业**（防会话抖动丢作业）。日志/结果/截图/trace 产物上报，后端登记元数据；失败时登记**最新**截图+日志+trace（automation-workers.3）。

**安全控制（automation-workers.2）**：每作业硬超时→停止+报 timeout；内存/CPU/并发限额（每作业单浏览器上下文）；网络 allow/deny 出站策略；日志脱敏（密钥/token/PII 上报前清洗）；每作业临时隔离浏览器 profile 用后即清；产物大小限额（超限截断/拒绝并记录元数据）。

---

## 8. LangGraph 编排方案

**节点图（需求→用例）**：
```
[start]
 → classify/route        选择路径 + provider
 → retrieve-context      [P2 拉 KB chunk + 来源归因；MVP 仅 AiRunInput 原始/上传上下文（R4）]
 → draft                 LLM 产结构化用例（title/priority/preconditions/steps/expected）
 → validate-structure    schema 校验；畸形则 有界重试（MUST-2：retries facet）
 → [tool-call]           MVP=原生工具节点（如结构化校验/格式化工具，非 MCP）；P2 追加 MCP 节点
 → [skill-adapter]       [P2 仅受控适配器 + 权限执行]
 → human-approval        接受/编辑/拒绝——accept 前禁写 canonical
 → persist-handoff       接受草稿 → TestCase/TestStep（经 TestAssetsModule）
 → trace                 收口 WorkflowStageEvent
[end]
```

**MUST-2（backend-ai-orchestration.1 全 facet 落地）**：该场景要求 "state, **tool calls, retries**, streaming, human approval"。落地拆解：
- **state**：Architect-R1——运行态存 Prisma `AiWorkflowRun`（非 LangGraph checkpointer）。
- **tool calls（MVP）**：MVP 图含**原生（非 MCP）工具节点**（如结构化输出校验/规范化工具），有 MVP 验收 + 测试；**MCP 工具 = Phase 2**（backend-ai-orchestration.3）。**R7：MVP 图拓扑上无 MCP/Skill 节点**（非开关），CI 扫描禁止 MVP 图 import MCP/Skill。
- **retries（MVP）**：`validate-structure` 与 provider 调用采用有界退避重试；耗尽→stage `fail` + run `failed`（记录 `retryCount`，不静默吞掉）。有 MVP 验收 + 测试。
- **streaming**：每节点发 `WorkflowStageEvent` → 映射共享流包（§6），Web+桌面同构渲染。
- **human approval（Architect-R1 resume）**：`human-approval` 为软边界——图跑到审批点**返回并结束**，`AiWorkflowRun.status=awaiting-approval`；**续跑 = `POST /ai/runs/:id/approve` 读 Prisma run 态作为显式输入调用 post-approval 子图/节点**（无 `interrupt()`/checkpointer 依赖）。accept 前不写 canonical（ai-test-generation.2）。

**MCP tool-call 节点 [P2]**：仅 approved 工具经后端托管 MCP client；记录 `McpToolCall`；**非白名单调用前拒绝**（拒绝谓词单一真相源 = mcp-admin allowlist，第三 change MODIFIED 后引用）。
**Skill 适配器节点 [P2]**：仅经受控适配器（无任意执行），执行安装的权限策略；记录 `SkillInvocation`；权限未批则拒绝。

---

## 9. MCP 与 Skills 安全边界

**MCP（backend-ai-orchestration.3 + mcp-admin）**：仅后端托管 client（绝不暴露给 renderer/worker）；approved-tools 白名单（图在调用前拒绝其余）；每次调用记 `McpToolCall`（工具/server/approved 标志/脱敏参数/结果元数据/状态/时序）。**mcp-admin 拥有"非白名单工具在调用前拒绝"谓词的唯一所有权**（第 2 轮 D12）；backend-ai-orchestration.3 仅引用、不重述。**MCP 工具限定项目级**（无平台全局工具 → 无全局 admin 审批角色）。

**Skills（skills-store.1–5）**：包元数据 + **checksum** installable 前验证；验证失败阻断安装且**保留当前版本**（无半态）；激活前显式权限审查 + 独立批准步（`permissions/approve`）；仅经**受控适配器**接入 LangGraph/MCP/worker（无自由代码执行）；调用在已批准权限集下运行，越权即拒；每次调用记 `SkillInvocation`；update + **回滚**到上一兼容版；验证失败保留当前版本。

**客户端/worker 隔离**：Electron `contextIsolation`+`sandbox`，renderer 无 Node/fs，仅类型化桥；Skills/MCP **绝不**从 renderer 调用——一律后端/worker 经适配器；worker 出站受 allowlist；worker 内 Skill/工具活动仍在权限策略 + 日志脱敏 + 产物限额下。

**Architect-R5 密钥机制（MVP，栈内无外部密钥管理器）**：**Postgres 信封加密**——KMS 或应用主密钥；每凭据 DEK；`credentialCiphertext` + `credentialKeyId` 密文列；`ModelProviders.validate` **进程内解密、永不返回密钥**；支持主密钥轮换（重加密 DEK）。api-automation R3（Phase 3）复用同一信封加密引用不变量。

---

## 10. 每阶段验收标准（可测、双向可追溯到 OpenSpec 场景）

> **MUST-6 双向可追溯**：每条 MVP 验收标注 OpenSpec 场景来源；每个 in-MVP 场景至少 1 条验收。
> **Clean-room 评审门（所有阶段）**：WHEN 任一模块提交 THEN 评审确认无上游 代码/图片/Logo/文案/样式/提示词/文档/布局 复制，仓库无上游 源码/迁移/打包物，有风险参考附 provenance 记录（clean-room-rebuild.1,2,4）；WHEN 请求映射到非目标（企业微信/复杂 RBAC）THEN 拒绝或延后（clean-room-rebuild.3）。
> **MUST-7**：每条 Architect 修订（R1–R10）+ Critic 必改（MUST-1..7）绑定具体测试门（见 §13）。

**Phase MVP**（逐条 OpenSpec 场景来源）：
- 登录后仅见拥有/受邀项目（platform-foundation.1）。
- 角色仅 owner/member，无复杂 RBAC 面（platform-foundation.2）。
- 配置 OpenAI 兼容 provider → 校验通过、可被 AI 选用、凭据以密文存储不返回明文（platform-foundation.3 + Architect-R5）。
- AI 创建用例 → 审计记 actor/project/action/target/timestamp/outcome（platform-foundation.4）。
- 用例/步骤 → 模块/有序步骤/预期/优先级/状态/标签/备注 项目级持久化（test-asset-management.1）。
- 提交需求文本**或上传上下文** → 结构化草稿流式进度，accept 前不可 canonical（ai-test-generation.1–2；上传上下文经 `AiRunInput`，R4）。
- 运行含 **state / 原生 tool 调用 / 重试 / 流式 / 人审** 全 facet，且 stage/partial/成功失败 trace 持久化（backend-ai-orchestration.1 + ai-test-generation.3；MUST-2）。
- 本地 Playwright 作业：不阻塞 API 线程、超时/限额/网络策略/日志脱敏执行、截图+日志+trace 元数据登记（automation-workers.1–3）。
- 执行结束 → 记录显示 通过失败/失败步骤/耗时 + 可见产物元数据（test-asset-management.2–3）。
- 桌面：renderer 仅经类型化桥（无 Node/fs），同 API/流/鉴权契约，可启停/监控 worker，端点安全存储（desktop-app.1–5）。
- Web UI 以 Nuxt3+Vue3+TS 引导（web-ui.1），布局/控件/表格/表单由一方组件 + shadcn-vue 原语经 Tailwind 组成（web-ui.2）。
- LangGraph run 发出 stage 更新/partial 输出时，后端经共享流契约转发给**已认证**客户端（backend-ai-orchestration.4）。
- **worker→后端调用携带 per-user token，非本用户作业结果被拒**（R3；automation-workers 完整性）。
- **流式重连经快照重取恢复当前权威态**（Architect-R8，措辞为"获得当前权威态"而非"补发遗漏事件"）。
- **Web UI 提供 API automation 导航占位路由**作为 web-ui.3 的部分满足（MUST-3）。
- **MUST-1 R1 人审-续跑 e2e：一次审批 = 一组 canonical 用例**（approve 幂等 + run 状态机单向 + persist-handoff 以 runId 去重）。
- **MUST-2 tool-calls + retries facet 在 MVP 有验收 + 测试**（原生工具节点 + 有界退避重试 + retryCount 记录）。
- **R7 CI import 扫描：MVP 图无 MCP/Skill import**。

**Phase 2**：
- 项目 KB CRUD/浏览项目隔离（knowledge-rag.1）；ingest → 抽取/chunk/来源元数据（.2）；检索经**可替换 `RetrievalBackend`**（pgvector-first，R9 原生 SQL 迁移），后端切换测试无需改域逻辑通过（.3）；RAG 生成含可追溯来源归因（.4）；诊断返回 query/命中/分数/来源（.5）。
- Skill 安装先验证元数据+checksum，失败则阻断且保留当前版（skills-store.1,5）；激活前显式权限审查/批准（.3）；仅经受控适配器在权限策略下运行 + 记调用元数据（.4）；update 失败可回滚到上一兼容版且保留当前版（.5）。
- AI 图调工具时仅 approved MCP 工具运行且记 `McpToolCall`（backend-ai-orchestration.3）。

**Phase 3（spec-first — 先门控）**：
- 排期 Phase-3 域（5 新 cap）时，**在补充对应 WHEN/THEN OpenSpec 需求（第二 change 纯 ADDED）并批准前不得开工**（MUST-4 争议行已核验：域 4/6对话/9/11UI = Not-in-OpenSpec；域 8 = In-OpenSpec 部分延后）。
- **第三 change `fill-spec-gaps-modifieds`（5 项 MODIFIED/ADDED）须在 prior change 归档后创建**；clean-room-R5 非目标 lift 落地前，api-automation 完整套件与完整 MCP 管理形式上仍是 design.md 非目标。
- spec 就位后，该域继承同一 clean-room 门、后端拥有编排规则、密钥引用/隔离不变量、simple-roles 不变量，并据新场景派生自身验收。
- **5 cap 的 spec 质量门**（承 PLAN-SPECFILL §6 Gate A–D）：场景可测性、clean-room provenance、非目标 diff、跨 cap 一致性 + 悬空引用 reconcile。
- **MUST-5 R2 作业 redelivery 集成测试**（断连重投恰一次）虽属 MVP 机制，Phase-3 suite 执行复用同一 worker 协议时须保持 redelivery 语义。

---

## 11. 明确哪些内容不允许实现或不在当前阶段实现（Explicit Non-Implementation / Out-of-Phase List）— 本轮新增

> 本节是第 6 原则（显式非实现可追溯性）的可执行产物。每条注明源不变量/决策，使范围蔓延无漏洞可钻。
> **兜底规则（承重，Architect #1）**：任何拟实施项若**既无法追溯到 §2/§3/§4 的 in-scope、又未在 §11 列出**，一律按**最保守类别**处理（即视为禁止），须经**新 change 显式 lift** 方可实施。§13 F7 门强制此规则。
> **跨类别重叠处理（Architect #3）**：某项可能同时属"Phase-2 排除"与"Phase-3 内仍延后"——此时归入**更严格类别 (d)**，并在 (c) 留**反向引用**，不重复条目实体。

### (a) 永久非目标（任何阶段都不实现）— permanent non-goals

| # | 禁止项 | 源不变量/决策 |
|---|---|---|
| a1 | 企业微信集成 | clean-room-rebuild R3 + proposal Non-Goals + design.md Non-Goals |
| a2 | 复杂 RBAC / 权限矩阵 / 自定义角色（reviewer/approver/admin 等新角色） | clean-room-rebuild R3 + platform-foundation.2（仅 owner/member）+ 第 2 轮 P4 simple-roles 不变量 |
| a3 | 全 DOCX 编辑器 | proposal Non-Goals + design.md Non-Goals（"full online DOCX editor"） |
| a4 | 分布式 UI 执行 / 远程 Playwright worker 池 | design.md Decision 5 + Non-Goals（"distributed UI execution"）+ PLAN.md 选项 B（B2 被 spec 排除） |
| a5 | 平台全局 MCP 工具 + 全局 admin 审批角色 | 第 2 轮 D12 + mcp-admin R1（MCP 工具限定项目级）+ §5 非目标（全局工具须先独立 change 形式化 admin 角色，本身为非目标 a2） |
| a6 | 复制任何 WHartTest 源码/素材/Logo/文案/样式/提示词/文档/布局/API 实现细节 | clean-room-rebuild R1, R2 + proposal Non-Goals + design.md Risks |
| a7 | 客户端 LLM/MCP 执行（编排永远在后端） | 第 1 轮 P3 + llm-chat R1（LLM 调用由 NestJS 发起，客户端只收流式响应）+ backend-ai-orchestration 后端拥有 |
| a8 | 备选前端框架轨道（非 Nuxt3+Vue3+TS+Tailwind+shadcn-vue） | design.md Decision 1 + Non-Goals（"No alternate frontend framework track"） |
| a9 | 直接 WHartTest fork / 代码迁移 / 资产复用 | clean-room-rebuild R2 + proposal Non-Goals + design.md Non-Goals |
| a10 | 以换栈规避 MIT 归属义务（若上游内容被复制） | clean-room-rebuild + proposal Non-Goals + design.md Non-Goals（"No promise that changing tech stack alone removes MIT attribution obligations"） |

### (b) MVP 阶段不实现（Phase 2/3 才做）— not in MVP

| # | 排除项 | 落点阶段 | 源不变量/决策 |
|---|---|---|---|
| b1 | KB/RAG（完整） | Phase 2 | proposal "Required Post-MVP" + knowledge-rag "required post-MVP" |
| b2 | Skills 商店 | Phase 2 | proposal "Required Post-MVP" + skills-store "required post-MVP" |
| b3 | MCP tool-call 节点 + Skill 适配器节点（在 LangGraph 图中） | Phase 2 | **R7 MVP 拓扑无 MCP/Skill 节点** + backend-ai-orchestration.3 = P2 |
| b4 | MCP **管理 UI**（注意：后端 MCP 机制在 Phase 2，见 §3） | Phase 3 | design.md Non-Goals（"full MCP administration"）+ mcp-admin 新 slug |
| b5 | LLM **对话 UI**（注意：provider 配置在 MVP，见 §2） | Phase 3 | 矩阵域 6 对话 Not-in-OpenSpec + llm-chat 新 slug |
| b6 | 测试套件 | Phase 3 | 矩阵域 4 Not-in-OpenSpec + test-suite 新 slug |
| b7 | 完整 API 自动化**套件**（注意：占位路由在 MVP，见 §2/MUST-3） | Phase 3 | web-ui.3 SHALL + design.md Non-Goals + api-automation 显式 Phase-3 门控 |
| b8 | 分布式/远程 worker（含远程 API 执行 worker） | 永久非目标（UI 执行，a4）/ Phase-3 内仍延后（API 执行，→(d4)） | a4 + 第 2 轮 §5 |

### (b′) MVP 排除的机制（非功能域，而是具体技术机制）— Architect #5

| # | 排除机制 | 处置 | 源不变量/决策 |
|---|---|---|---|
| b′1 | LangGraph durable checkpointer / interrupt() | **全程不引入**（MVP 起，Phase 2/3 亦不依赖其 canonical 写路径） | Architect-R1 |
| b′2 | BullMQ 作 worker 传输 | **永不**（仅后端内部记账） | Architect-R2 |
| b′3 | 服务端逐事件重放缓冲 | **永不**（MVP 起用快照重取） | Architect-R8 |
| b′4 | 外部密钥管理器 | **永不**（栈内不存在，用信封加密） | Architect-R5 |
| b′5 | Qdrant-first 检索后端首期实现 | Phase 2 仅 pgvector-first；接口保留可后切（非永久禁止，"not now, swappable later"） | A1 选项 + R9 |

### (c) Phase 2 阶段不实现（Phase 3 才做）— not in Phase 2

| # | 排除项 | 源不变量/决策 |
|---|---|---|
| c1 | test-suite（套件实体/有序成员/套件级执行汇总） | 第 2 轮 G1 + 矩阵域 4 Not-in-OpenSpec |
| c2 | api-automation 完整套件（HTTP 请求/断言/执行记录） | 第 2 轮 G2 + 显式 Phase-3 门控 |
| c3 | requirement-management（需求实体/评审审批/回链） | 第 2 轮 G3 + 矩阵域 9 Not-in-OpenSpec |
| c4 | llm-chat（交互对话/会话持久化/审计） | 第 2 轮 G4 + 矩阵域 6 对话 Not-in-OpenSpec |
| c5 | mcp-admin（治理 UI：propose/review/approve/allowlist/revoke） | 第 2 轮 G5 + design.md Non-Goals |
| c6 | 分布式 API 执行 worker | → 见 (d4)，更严格类别，此处反向引用 |
| c7 | MCP 工具自动发现（先手动注册） | → 见 (d5)，更严格类别，此处反向引用 |
| c8 | 跨项目需求复用 | → 见 (d)，此处反向引用（第 2 轮 §5） |
| c9 | chat 多 provider fan-out | → 见 (d)，此处反向引用（第 2 轮 §5） |
| c10 | chat tool-calling / 多步状态 | → 见 (d7)，更严格类别，此处反向引用 |

### (d) Phase 3 内仍延后 / 需先补 spec — deferred even within Phase 3 / spec-first gated（更严格类别，承 (c) 重叠项的实体落点）

| # | 延后项 | 前置条件 | 源不变量/决策 |
|---|---|---|---|
| d1 | 5 新 cap 中任一的实现任务 | 对应 OpenSpec spec（第二 change 纯 ADDED）批准 | clean-room-rebuild R3 + 唯一需求源不变量 + 第 2 轮 P1 spec-first 门控 |
| d2 | api-automation 完整套件 + 完整 MCP 管理的 binding lift | 第三 change `fill-spec-gaps-modifieds` 的 clean-room-R5 落地（非目标 lift） | 第 2 轮 D13 + §4.5；**在 clean-room-R5 落地前两者形式上仍是 design.md 非目标** |
| d3 | 5 cap 对既有 cap 的 MODIFIED（web-ui 路由 / backend-ai-orchestration 引用 / ai-test-generation 需求输入 / clean-room-R5 / test-asset-management 联动） | prior change 归档后第三 change 创建，MODIFIED 解引真实 `openspec/specs/` | V-c 载体 + §4.4 枚举 |
| d4 | 分布式 API 执行 worker | 独立 spec-first change | 第 2 轮 §5 |
| d5 | MCP 自动发现 | 独立 spec-first change（先手动注册） | 第 2 轮 §5 + design.md Open Questions |
| d6 | 平台全局 MCP 工具 | 须先独立 change 形式化 admin 角色（其本身为非目标 a2/a5） | 第 2 轮 D12 + §5 |
| d7 | chat tool-calling / 多步 | 须先纳入 backend-ai-orchestration R2 范围并相应 MODIFIED | 第 2 轮 D11 |
| d8 | suite 执行拓扑 / API 执行器 / chat scope / MCP 发现源 | design.md Open Questions 待产品决策（不阻断 spec 结构） | 第 2 轮 design.md Open Questions |
| d9 | 跨项目需求复用 / chat 多 provider fan-out | 第 2 轮 §5 deferred | 第 2 轮 §5 |

### (e) 结构性禁止（OpenSpec 工具/合法性约束）— structural prohibitions

| # | 禁止项 | 源不变量/决策 |
|---|---|---|
| e1 | 跨 change 的 `## MODIFIED Requirements` 针对未归档 change | V-c 载体理由（结构合法性：prior 未归档 → `openspec/specs/` 为空 → MODIFIED 无法解引） |
| e2 | 在 spec-fill change（第二 change）中启动 Phase-3 实现任务（11.8） | 第 2 轮 tasks 11.8 为独立 follow-on impl change，依赖 11.1–11.7 批准 |
| e3 | 在第二 change 中写任何 `## MODIFIED Requirements` | V-c：第二 change 纯 ADDED；所有 MODIFIED 延后第三 change |
| e4 | 臆造超出 OpenSpec 的 binding 需求 | 第 1 轮 P1 + 唯一需求源不变量；13 域矩阵中 4 域 Not-in-OpenSpec → spec-first only |
| e5 | 在 clean-room-rebuild 非目标 lift 中重写 R3 原措辞 | 第 2 轮 D13：ADDED clean-room-R5，保留 R3 原措辞（非重写） |
| e6 | test-suite 经修改 test-asset-management **功能 FK** 实现联动 | 第 2 轮 D8：自包含 SuiteRun 持执行记录 ID 列表；第三 change 对 test-asset-management 仅**性能索引/约束**联动（非功能 FK，非禁止触碰） |
| e7 | mcp-admin 引入全局 admin 角色 / 平台全局工具 | 第 2 轮 D12 + mcp-admin R1（项目级） |
| e8 | llm-chat 触动 backend-ai-orchestration R2 范围（tool-calling/多步/人审）而不经 MODIFIED | 第 2 轮 D11：会话级 scope 声明使其不属 R2 范围；若越界须先 MODIFIED |
| e9 | Phase-3 模块复用上游 API-automation DSL / prompt / 布局 / 资产 | api-automation R3 clean-room 场景 + Gate B provenance 检查 |

---

## 12. Pre-mortem（deliberate 模式 — 针对第 3 轮真实 Top 风险）

1. **合并漂移 / 两份前序产物相互矛盾（合并保真度风险）**：合并 PLAN.md（R1–R10 + MUST-1..7）与 PLAN-SPECFILL.md（V-c + 5 cap + 第三 change）时，可能在 Phase-3 描述、MCP 拒绝谓词归属、非目标措辞上产生内部矛盾。
   *缓解*：本计划已交叉对齐——§4.2/§4.4/§9 一致表述 mcp-admin 拥有拒绝谓词、backend-ai-orchestration 引用；§11(b)/(c)/(d) 与 §2/§3/§4 阶段范围逐项对照；§13 F1–F6 设合并保真交叉检查门，逐条核验 R1–R10 + MUST-1..7 + 第 2 轮决策在合并后仍存在且无矛盾。**F7 兜底门**阻断未列项；**F8 漂移门**防御 stale `.omc/plans/` 制品回归。

2. **§11 不完整留下范围蔓延漏洞（§11 详尽性风险）**：负契约的完整性不可证（无法证明"无遗漏"）；若 §11 遗漏某项，后续可能被误读为隐式允许。
   *缓解*：兜底规则（§0 第 6 原则 + §11 顶部）将举证负担从"证明完整"转为"阻断未列项"——未列即按最保守类别禁止 + 经新 change lift；§11 分 5 类穷举，每条引源不变量；§13 F4（13 域 × 阶段交叉）、F5（§11×§2–§4 无矛盾）、F6（非目标 diff）。

3. **重新审判已定决策的诱惑 + stale 制品漂移（no re-litigation + drift 风险）**：合并中可能不自觉重新论证 R1（checkpointer）、R2（BullMQ）、V-c（载体）等已共识事项；或被磁盘上 stale 的 `.omc/plans/rebuild-ai-test-platform-plan.md`（pre-consensus：pull-based worker registry + BullMQ-as-transport + credentialRef→secret store + interrupt() humanReview，与 R2/R5/R1 矛盾）带偏。
   *缓解*：本轮原则 3 明示不重新审判；§0 选项 C2 已失效；§13 **F8 漂移门**断言统一计划未回归 pull-based-registry / BullMQ-transport / secret-store-ref / interrupt-checkpointer；任何对 R1–R10 / MUST-1..7 / V-c / 自包含 SuiteRun / mcp-admin 项目级 / llm-chat 会话级 / 第三 change MODIFIED 的实质性修改须被视为越界并退回。

---

## 13. 扩展测试计划（deliberate 模式 — 验证合并保真 + §11 详尽性，MUST-7）

> 承第 1 轮 Unit/Integration/E2E/Observability/专门安全门（逐字保留实质），并新增**合并保真验证门 F1–F8**。F 门须为**二值 pass/fail**（Architect #9），非"reviewer 确认"。

### 承前测试门（逐字保留实质）
- **Unit**：角色逻辑（仅 owner/member，无提权）；`ModelProvider` 序列化永不输出凭据 + 校验状态机；LangGraph 节点 reducer（draft/validate 重试；审批边界阻断落库）；`RetrievalBackend` 接口一致性（pgvector 适配 + stub 适配证可换）[P2]；Skill 包验证含失败保留当前版 [P2]；日志脱敏 + 产物限额工具。
- **Integration**：Auth→项目隔离；AI-gen run 需求→草稿→approve→落 TestCase/TestStep，reject 不写 canonical；**R2 会话流作业生命周期 claim/heartbeat/logs/result/artifact + 断连重投恰一次**（MUST-5）；审计行（AI 创建用例、skill install/activate、MCP 调用）；MCP 白名单执行 + `McpToolCall` [P2]；Skill 适配器权限策略调用 [P2]；RAG ingest→chunk→embed→retrieve + 来源归因 + 诊断 [P2]。
- **E2E**：Web 项目导航→建用例→跑本地 worker→看含产物报告；桌面同流并断言 renderer 仅经类型化桥（无 Node/fs）、同契约、worker 启停、端点切换；**MUST-1 R1 human-approval-and-resume e2e（一次审批 = 一组 canonical 用例）**；**Architect-R8 重连快照 e2e**；流式 SSE/WS 进度 Web+桌面同构。
- **Observability**：结构化 stage-event trace 持久+可查；审计完整性断言；worker 健康（心跳缺失→作业标记丢失；超时→记 timeout）；**秘密扫描门**（日志/产物含凭据即失败）；指标（run 成功失败率、检索分数分布[P2]、worker 时长/超时计数）。
- **专门安全/门控测试（每修订绑定）**：**R3** worker-token 绑定/拒绝；**R7** CI import 扫描（MVP 图无 MCP/Skill import）；**Architect-R5** 进程内解密永不返回密钥；**R10** 矩阵-diff 门。

### 新增：合并保真验证门 F1–F8（第 3 轮，二值 pass/fail）

- **F1 — R1–R10 逐条存在性（pass/fail）**：枚举 R1（Prisma run-state + post-approval 子图，无 checkpointer）、R2（会话流 + redelivery，BullMQ 后端内部）、R3（per-user worker token）、R4（AiRunInput MVP 上传上下文 vs P2 KB）、Architect-R5（信封加密）、R6（Electron SPA/静态）、R7（MVP 图无 MCP/Skill 节点）、Architect-R8（快照重取）、R9（pgvector 摩擦）、R10（矩阵门）；逐条断言在合并后 §2/§5/§6/§7/§8/§9/§10 均有对应且实质未变。**pass = 全部命中且措辞与源一致；fail = 任一缺失或实质漂移。**
- **F2 — Critic MUST-1..7 逐条存在性（pass/fail）**：枚举 MUST-1（approval-resume spec，R1 续跑 e2e）、MUST-2（tool-calls + retries facet 在 MVP）、MUST-3（web-ui.3 API-automation 占位 + 矩阵单元格修正）、MUST-4（争议行核验）、MUST-5（R2 job redelivery spec）、MUST-6（双向可追溯）、MUST-7（每修订绑定测试）；逐条断言有对应。**注意（Architect #6）**：PLAN.md 仅显式标注 MUST-2/3/6/7，MUST-1/4/5 为"并入但未标注"——F2 须按**实质**核验（不必要求标签字面存在，但实质内容须在），fail = 任一实质缺失。
- **F3 — 第 2 轮决策逐条存在性（pass/fail）**：V-c 载体（§4.2）、自包含 SuiteRun（§4.3 test-suite R3 + §5 + e6）、mcp-admin 项目级（§4.2 + §9 + e7）、llm-chat 会话级不属 R2（§4.2 + §4.3 + e8）、clean-room-rebuild ADDED clean-room-R5 非 lift 重写 R3（§4.4 + §4.5 + e5）、第三 change 枚举 5 项 MODIFIED（§4.4）。
- **F4 — §11 × 矩阵交叉门（pass/fail）**：枚举 13 域 × 4 阶段（MVP/Phase2/Phase3/永久非目标）每个单元格，断言每个单元格**要么在 §11 有对应归类、要么在 §1–§4 显式 in-scope**。**pass = 无"既不在 §11 排除、又不在 §1–§4 包含"的悬空单元格；fail = 存在悬空单元格。**
- **F5 — §11 与 §2–§4 阶段范围无矛盾（pass/fail）**：§11(b) 项须全部出现在 §2 MVP 排除；§11(c) 项须全部不出现在 §3 Phase 2；§11(d) 项须与 §4 Phase-3 门控一致；§11(a) 项须不出现在任何阶段。**pass = 全部一致；fail = 任一矛盾。**
- **F6 — 非目标 diff 门（承第 2 轮 Gate C，pass/fail）**：断言企业微信/复杂 RBAC/全 DOCX 编辑器/分布式 UI 执行/全局 MCP 工具/备选前端/WHartTest 复制/fork/MIT 规避（§11 a1–a10）仍被拒；断言 API 自动化套件 + 完整 MCP 管理**仅** LIFT 到 Phase-3-spec-gated（§4.5 + d2）；断言无其他非目标被暗中 lift。**pass = diff 符合预期；fail = 永久非目标被弱化或额外非目标被 lift。**
- **F7 — 兜底规则执行门（pass/fail，Architect #1 承重）**：对拟实施项 X，若 X 既无 §2/§3/§4 in-scope 追溯、又不在 §11 列出 → **fail**（须按最保守类别禁止或经新 change lift）。**pass = 所有拟实施项可追溯或已列；fail = 存在未列且未追溯项。** 此门使第 6 原则从"愿景"转为"可执行"。
- **F8 — Stale 制品漂移门（pass/fail，Architect #10）**：断言统一计划**未回归**以下 stale `.omc/plans/rebuild-ai-test-platform-plan.md` 模式：pull-based worker registry、BullMQ-as-transport、`credentialRef→secret store`、`interrupt()` humanReview。**pass = 统一计划与 R2/R5/R1 一致且未含 stale 模式；fail = 任一 stale 模式回归。**

---

## 14. ADR（架构决策记录 — 第 3 轮合并）

- **Decision**：以第 1 轮 PLAN.md（输出 1–10，R1–R10 + MUST-1..7）与第 2 轮 PLAN-SPECFILL.md（V-c 载体 + 5 新 cap + 自包含 SuiteRun + mcp-admin 项目级 + llm-chat 会话级 + 第三 change MODIFIED 枚举 + clean-room-rebuild ADDED clean-room-R5 非目标协调）为已共识基线，合并为单一统一计划并新增 §11（显式非实现/越阶段列表，5 类 + (b′) 机制类，逐条可追溯 + 兜底规则）。合并方法为选项 C1（合并前序产物），选项 C2（从头重推导）以违反"不重新审判"驱动失效。
- **Drivers**：合并保真度、§11 详尽性/可追溯性（含负契约不可证 → 兜底规则转移举证负担）、不重新审判已定决策。
- **Alternatives considered**：从头重新推导（失效——重开 R1–R10/V-c 等已定决策，无新信息下只引入漂移）；§11 仅列高层次非目标（失效——留下范围蔓延漏洞，违反第 6 原则可追溯性，且负契约不可证）；§11 不引源不变量（失效——无法验证、无法在争议时仲裁）；§11 不设兜底规则（失效——第 6 原则沦为愿景，负契约漏洞未堵）。
- **Why chosen**：合并保留全部决策实质、§11 为纯增量、第 6 原则经兜底规则 + F7 门使每一项排除可追溯且负契约可执行；不扰动任何已批准的 R1–R10 / MUST-1..7 / 第 2 轮决策。
- **Consequences**：产生单一内部一致的统一计划，可直接驱动后续执行（team/ralph）；§11 作为可执行的非实现契约，任何越界实现可在 F7 评审门被拒；F8 防御 stale 制品漂移。代价为文档体量增加 + §11 与源非目标的同步维护负担（每次范围变更须更新 §11 + 引用）。Phase 3 仍受 spec-first 门控 + 第三 change 前置依赖约束（承第 2 轮）。
- **Follow-ups（承前两轮，不重开）**：归档 prior change → 创建第二 change `fill-spec-gaps-phase3`（纯 ADDED 5 cap spec）→ 创建第三 change `fill-spec-gaps-modifieds`（5 项 MODIFIED/ADDED）→ Phase 3 impl change。design.md Open Questions（部署目标、provider 集、合规姿态、语言、Electron OS 目标；Phase-3：suite 执行拓扑、API 执行器、chat scope、MCP 发现源）待产品决策，不阻断结构。

---

## 15. 执行边界（本轮）

本文件为 **PENDING APPROVAL** 规划产物（第 3 轮合并 + §11 增量）。**未运行任何变更命令、未改源码、未创建/修改任何 openspec 文件、未提交/推送/建 PR、未委派实现。** 批准后可经 `/oh-my-claudecode:team`（并行，推荐）或 `/oh-my-claudecode:ralph`（顺序）执行——执行内容为前两轮已批准的 openspec spec-writing 与业务实现，本轮不新增实现任务。
