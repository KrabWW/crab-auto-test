# 计划：从零实现 WHartTest 风格 AI 自动化测试平台（Clean-Room Rebuild）

> 状态：**PENDING APPROVAL**（本轮仅规划，未执行任何代码/文件变更）
> 需求源：`openspec/changes/rebuild-ai-test-platform/` 是**唯一**约束性需求源。
> WHartTest 仅作**通用产品调研**参考——不引用、不复制其源码/素材/Logo/文案/样式/配置/提示词/文档。
> 共识：Planner → Architect → Critic（deliberate 模式，已并入 Architect 10 项修订 + Critic 7 项必改）。

---

## 0. RALPLAN-DR 决策摘要

### 原则（Principles）
1. **Spec 门控范围**：仅 OpenSpec 场景产生约束性工作。13 个域中 OpenSpec 未覆盖者一律 spec-first（先补 OpenSpec 需求再实现），绝不臆造需求。
2. **Clean-room by construction**：全新仓库/数据模型/文案/UI。上游只告诉"存在什么问题"，绝不告诉"如何实现"。有风险的参考先写 provenance 记录（观察到的需求→独立实现路径）。
3. **编排在后端**：所有 AI/LangGraph/MCP 编排跑在 NestJS；前端与桌面是同一套 REST + 流式契约的瘦客户端。
4. **落库前必须人审**：AI 永不直接写入 canonical 资产；Skills/MCP 只经受控适配器 + 权限审查。
5. **证据优先**：每个阶段以可测 WHEN/THEN 验收 + clean-room 评审门收口，验收与 OpenSpec 场景双向可追溯。

### 决策驱动（Top 3）
1. **需求完整性风险**：13 域中有 4 域（测试套件、LLM 对话 UI、需求管理/评审、MCP 管理 UI）OpenSpec 无场景，且 design.md 将"完整 MCP 管理""API 自动化套件"列为一阶段非目标。
2. **安全边界完整性**：模型凭据、Skills 包、MCP 工具、本地 Playwright worker 是最高爆炸半径面。
3. **检索后端可替换性**：OpenSpec 明确要求"可替换的检索后端接口"。

### 关键架构选项
- **选项 A — 检索后端（Phase 2）**：**A1 pgvector-first（置于 `RetrievalBackend` 接口后）✅** vs A2 Qdrant-first。
  - A1 复用既有 Postgres、单存储运维、与 KB 元数据事务一致、最低运维成本；接口保证未来可无痛切 A2。
  - A2 失效理由：项目级语料在 MVP/Phase2 规模不足以支撑第二个有状态服务的运维/安全成本。
- **选项 B — MVP 执行拓扑**：**B1 仅本地 worker（OpenSpec 强制）✅** vs B2 后端 worker 池（被 spec 明确排除）。作业协议设计为未来后端 claimer 可复用同契约（post-MVP，spec 门控）。

---

## 1. WHartTest 对标功能矩阵（Feature Parity Matrix）

能力以**通用行业模式**描述（clean-room；不引用上游任何表达）。OpenSpec 覆盖态经本轮核验。

| # | 功能域 | 通用行业能力（产品调研视角） | OpenSpec 覆盖态 | 阶段 |
|---|---|---|---|---|
| 1 | 用户登录 | 账号登录/会话；只可访问自己拥有或受邀的项目 | **Covered**（platform-foundation.1） | MVP |
| 2 | 项目管理 | 项目 + owner/member 简单角色（无复杂 RBAC） | **Covered**（platform-foundation.2） | MVP |
| 3 | 测试用例 | 模块→用例→有序步骤、预期结果、优先级/状态/标签/备注 | **Covered**（test-asset-management.1） | MVP |
| 4 | 测试套件 | 用例分组/排序为可运行套件 + 套件级执行/报告汇总 | **Not-in-OpenSpec** | Phase 3（spec-first） |
| 5 | 测试执行记录和报告 | 执行记录关联 用例/步骤/环境 + 截图/日志/trace + 通过失败/耗时 | **Covered**（test-asset-management.2–3） | MVP |
| 6 | LLM 配置 + LLM 对话 | 管理员配置 OpenAI 兼容 provider（**配置 Covered**）；交互式对话 UI（**未覆盖**） | **Partial**：配置 Covered（platform-foundation.3）；**对话 UI Not-in-OpenSpec** | 配置：MVP · 对话 UI：Phase 3（spec-first） |
| 7 | AI 生成测试用例 | 从需求文本/上传上下文/项目知识 经 LangChain+LangGraph 生成结构化用例 → 草稿人审 | **Covered**（ai-test-generation.1–3） | MVP |
| 8 | 接口自动化测试 | HTTP 接口编排/执行/断言 | **In-OpenSpec, 部分延后**：web-ui.3 明确 SHALL 支持"API automation"工作流；但 design.md 将完整套件列为一阶段非目标 | 导航占位：随 Web UI 上线 · 完整套件：Phase 3（spec-first） |
| 9 | 需求管理和需求评审 | 需求实体 + 评审/审批工作流，喂给 AI 生成 | **Not-in-OpenSpec**（需求文本目前只是 AI-gen 输入，非受管实体） | Phase 3（spec-first） |
| 10 | 知识库/RAG | 项目级 KB、ingest/chunk/embed/retrieve + 来源归因 + 诊断 | **Covered**（knowledge-rag.1–5；"required post-MVP"） | Phase 2 |
| 11 | MCP 工具管理 | 后端托管 MCP client + 白名单 + 调用元数据（**后端机制 Covered**）；用户侧管理 UI（**未覆盖**） | **Partial**：后端机制 Covered（backend-ai-orchestration.3）；管理 UI Not-in-OpenSpec（design.md 非目标） | 后端机制：Phase 2 · 管理 UI：Phase 3（spec-first） |
| 12 | Skills 技能库 | 包+校验和验证、install/update/disable/uninstall、权限审查、受控适配器、回滚 | **Covered**（skills-store.1–5；"required post-MVP"） | Phase 2 |
| 13 | 本地 Playwright 浏览器自动化 | Electron 托管本地 worker；claim/执行/上报 非阻塞；超时/限额/策略；产物 | **Covered**（automation-workers.1–4；desktop-app.4） | MVP |

**诚实的差距声明**：域 4、6(对话)、8(完整套件)、9、11(UI) 在当前 OpenSpec 下**非约束性**，全部 Phase 3 且**先补 OpenSpec 场景再实现**。域 8 特例：web-ui.3 已用 SHALL 提及"API automation"，故 Web UI 上线时须提供**可导航占位路由**作为 web-ui.3 的部分满足，完整套件仍 Phase 3。

---

## 2. MVP 范围（严格对齐 OpenSpec MVP）

**仅包含以下**：
- **平台基座（MVP 依赖）**：
  - 登录鉴权；访问域限于拥有/受邀项目（platform-foundation.1）。
  - owner/member 简单角色，**无复杂 RBAC**（platform-foundation.2）。
  - 模型 provider 配置：base URL + model name + **凭据引用**，校验后可被 AI 工作流选用（platform-foundation.3）。
  - 审计日志：actor/project/action/target/timestamp/outcome；AI 创建用例须审计（platform-foundation.4）。
- **测试资产（MVP）**：项目级 模块、用例、有序步骤、预期结果、优先级/状态/标签/备注（test-asset-management.1）。
- **AI 生成用例（MVP）**：从**需求文本 + 上传上下文**（`AiRunInput`，见 §5）生成结构化草稿；**人审 编辑/接受/拒绝 后方可 canonical**；流式进度 + 持久化 trace（ai-test-generation.1–3）。*"existing project knowledge"（RAG 路径）= Phase 2。*
- **后端 AI 编排（MVP 子集）**：NestJS 拥有编排 API；LangGraph 多步工作流含 **state / 原生 tool 调用 / 重试 / 流式 / 人审**（见 §8 对 backend-ai-orchestration.1 全 facet 的落地）；SSE/WebSocket 共享契约（backend-ai-orchestration.1,2,4）。**MCP 节点（.3）与 Skill 适配器 = Phase 2**。
- **自动化 worker（MVP）**：Electron 托管本地 Playwright worker；claim/本地执行/上报**不阻塞 NestJS API 线程**；超时/资源限额/网络策略/日志脱敏；截图+日志+trace 元数据登记到执行记录（automation-workers.1–4）。
- **执行记录 + 产物（MVP）**：关联 项目/用例/步骤/环境；每次本地执行保留 截图+日志+Playwright trace；产物元数据可见；显示 通过失败/失败步骤/耗时（test-asset-management.2–3）。
- **桌面 app（MVP）**：Electron 复用 Nuxt UI；native 仅经窄类型化 preload 桥（context isolation，renderer 不触 Node/fs）；与 Web 同一 API/流/鉴权契约；启停/监控本地 worker；后端端点可配置、安全存储（desktop-app.1–5）。
- **Web UI（MVP 切片）**：项目导航、用例管理、AI 生成评审、执行报告、设置（web-ui.3 子集）。Nuxt3+Vue3+TS+Tailwind+shadcn-vue，全部一方组件（web-ui.1–2）。

**MVP 明确排除**：KB/RAG、Skills 商店、MCP 管理 UI、LLM 对话 UI、测试套件、完整 API 自动化套件、分布式/远程 worker。

---

## 3. 第二阶段范围（Phase 2 — OpenSpec 要求的 post-MVP + 加固）

- **完整 KB/RAG（knowledge-rag.1–5）**：项目级 KB CRUD + 隔离；ingest→抽取→chunk→保留来源元数据（文件名/章节/页）；embeddings + **可替换 `RetrievalBackend` 接口**（pgvector-first，A1）；RAG 上下文注入生成 + **可追溯来源归因**；检索诊断（query/命中 chunk/分数/所选来源）。并将 KB 上下文接入 AI 生成（升级 ai-test-generation.1 的 "project knowledge" 路径）。
- **完整 Skills 商店（skills-store.1–5）**：包格式（name/version/description/author/compatibility/permissions/entry points/checksum）installable 前验证；browse/install/update/disable/uninstall 记录 version/permissions/source/checksum/actor；**激活前显式权限审查**；经**受控适配器**接入 LangGraph+MCP（无任意执行），执行权限策略并记录调用元数据；update + **回滚**到上一兼容版；**验证失败保留当前版本**。
- **后端 MCP 集成（backend-ai-orchestration.3）**：MCP TS SDK client 后端托管，approved-tools 白名单，记录 tool-call 元数据（*机制*；管理 UI 仍 Phase 3）。
- **加固**：流式契约健壮性（重连/背压）、产物保留/大小限额执行、审计覆盖扩展、检索后端可替换性测试。

---

## 4. 第三阶段范围（Phase 3 — spec-first 门控）

每项**先补对应 OpenSpec 需求（WHEN/THEN 场景）并批准，才开始实现**（clean-room-rebuild.3 + 唯一需求源不变量）。

| 域 | 门控理由 | 拟补 OpenSpec 需求（尚未约束性） |
|---|---|---|
| 测试套件 | Not-in-OpenSpec | 新 `test-suite`：套件实体、有序用例成员、套件级执行 + 报告汇总 |
| 接口自动化（完整套件） | web-ui.3 已 SHALL 但无 backing 场景；design.md 非目标 | 新 `api-automation`：请求定义、断言、执行记录（对标浏览器执行）；**Web UI 先出占位路由** |
| 需求管理/评审 | Not-in-OpenSpec | 新 `requirement-management`：需求实体、评审/审批工作流、与生成用例的关联 |
| LLM 对话 UI | Partial：仅 provider 配置被覆盖 | 扩展 platform/web-ui：基于已配置 provider 的交互对话、会话持久化、审计 |
| MCP 管理 UI | Partial：后端已覆盖，UI 是 design.md 非目标 | 扩展 backend-ai-orchestration/web-ui：审查/批准/白名单 MCP 工具的管理界面 |

**默认动作**：defer + 提出 spec 增补。是否拉进 Phase 3 由产品负责人逐域决策；Planner 不为其臆造约束性需求。

---

## 5. 数据模型草案（Prisma 取向）

阶段标记：**[M]** MVP · **[P2]** Phase 2 · **[P3]** spec-first。**任何密钥均为密文/引用，无明文列。**

### 基座
- **User [M]**：id, email(uniq), displayName, passwordHash|外部鉴权引用, isAdmin, 时间戳。
- **Project [M]**：id, name, slug(uniq), description, ownerId→User, 时间戳。
- **ProjectMember [M]**：id, projectId, userId, role `owner|member`（**仅简单角色**）, invitedAt, acceptedAt?。Uniq(projectId,userId)。
- **ModelProvider [M]**：id, scope `global|project`, projectId?, name, kind `chat|generation|embeddings`, baseUrl, modelName, **`credentialCiphertext` + `credentialKeyId`（信封加密，见 §9；无明文）**, status `unvalidated|valid|invalid`, lastValidatedAt, createdBy, 时间戳。
- **AuditLog [M]**：id, actorId, projectId?, action, targetType, targetId, outcome `success|failure`, metadata Json, createdAt。

### 测试资产
- **Module [M]**：id, projectId, parentId?（树）, name, order, 时间戳。
- **TestCase [M]**：id, projectId, moduleId?, title, preconditions?, priority, status, tags[], notes?, origin `manual|ai-generated`, createdBy, 时间戳。
- **TestStep [M]**：id, testCaseId, order, action, expectedResult, data?。
- **TestExecution [M]**：id, projectId, testCaseId, environment, status `queued|dispatched|running|passed|failed|aborted|timeout`, startedAt, finishedAt, durationMs, failedStepId?, reportSummary Json, **workerJobId?（作业生命周期，见 §7 redelivery）**。
- **ExecutionArtifact [M]**：id, executionId, type `screenshot|log|trace|report`, storageRef, filename, sizeBytes, checksum, capturedAt, metadata Json。

### AI 编排
- **AiWorkflowRun [M]**：id, projectId, kind, status `running|awaiting-approval|accepted|rejected|failed|completed`, providerId?, createdBy, startedAt, finishedAt。**canonical 运行态存此（R1：不依赖 LangGraph checkpointer）。**
- **AiRunInput [M]**（R4：MVP 上传上下文之家，独立于 P2 KB 实体）：id, runId→AiWorkflowRun, kind `requirement-text|uploaded-attachment`, contentRef, filename?, sizeBytes?, checksum?, createdAt。
- **WorkflowStageEvent [M]**：id, runId, stage `context-retrieval|drafting|validation|review|persistence`, sequence, partialOutput? Json, status `success|fail`, retryCount, sourceAttribution?[P2] Json, createdAt。
- **McpToolCall [P2]**：id, runId, toolName, serverRef, approved, argsRedacted Json, resultMeta Json, status, 时间戳。

### 知识/RAG [P2]
- **KnowledgeBase [P2]**：id, projectId（隔离）, name, description, 时间戳。
- **Document [P2]**：id, knowledgeBaseId, filename, mimeType, sizeBytes, checksum, status `ingested|failed`, sourceMetadata Json, 时间戳。
- **DocumentChunk [P2]**：id, documentId, order, text, sourceMetadata Json, tokenCount。
- **EmbeddingRef [P2]**：id, chunkId, backend `pgvector|qdrant`, vectorRef, dims, model。*（R9：pgvector 需原生 SQL 迁移建 extension + hnsw/ivfflat 索引，ANN 走 `$queryRaw`；vectorRef 非 Prisma 原生列。）*

### Skills [P2]
- **Skill [P2]**：id, name, version, description, author, compatibility Json, permissions Json, entryPoints Json, checksum, source, validationStatus, 时间戳。Uniq(name,version)。
- **SkillInstallation [P2]**：id, projectId?, skillId, state `installed|disabled|uninstalled`, activatedPermissions Json, previousVersionId?（回滚指针）, installedBy, installedChecksum, 时间戳。
- **SkillInvocation [P2]**：id, installationId, runId?, workerJobRef?, adapter `langgraph|mcp|worker`, permissionsUsed Json, argsRedacted Json, resultMeta Json, status, invokedAt。

---

## 6. API 边界（按 NestJS 模块）

所有 AI 编排在 **NestJS**（绝不在前端/桌面）。桌面复用**同一** REST + 流 + 鉴权契约（desktop-app.3）。传输：CRUD/命令用 REST；流式用 SSE 或 WS（共享契约，backend-ai-orchestration.4）。

| NestJS 模块 | 阶段 | REST（代表） | 流式 |
|---|---|---|---|
| AuthModule | M | `POST /auth/login`, `/logout`, `GET /auth/me`, **`POST /auth/worker-token`（R3 铸造 worker token）** | — |
| ProjectsModule | M | `CRUD /projects`, 成员管理（仅 owner/member） | — |
| ModelProvidersModule | M | `CRUD /model-providers`, `POST /:id/validate`（**永不返回密钥**） | — |
| AuditModule | M | `GET /audit?project=&actor=&action=` | — |
| TestAssetsModule | M | `CRUD /projects/:id/modules`、`.../test-cases`、`.../steps`（有序） | — |
| ExecutionsModule | M | `GET/POST /projects/:id/executions`, `GET /executions/:id[/artifacts]` | `GET /executions/:id/events` |
| WorkerGatewayModule | M | **认证的**长连会话流分发作业（R2）；`ack/heartbeat/logs/result/artifacts`；作业持久化 `queued/dispatched/running/done`，重连重投未 ack（R2/§7） | worker↔backend 会话流（非阻塞 API 线程） |
| AiOrchestrationModule | M（核心）/ P2（MCP+Skill 节点） | `POST /ai/test-generation`, `GET /ai/runs/:id`, `POST /ai/runs/:id/approve|reject|persist`（**R1：读 Prisma run 态续跑 post-approval 子图**） | `GET /ai/runs/:id/stream`（stage/partial/成功失败） |
| KnowledgeModule | P2 | KB/文档 CRUD、ingest、`POST /projects/:id/retrieval/query`（诊断） | ingest 进度 |
| SkillsModule | P2 | install/disable/uninstall/update/rollback/permissions.approve | — |
| McpModule | P2（机制）/ P3（UI） | 后端内部 client 管理；`GET /ai/runs/:id/tool-calls` | — |
| WebUI 占位（web-ui.3） | 随 Web 上线 | **`/projects/:id/api-automation` 导航占位**（完整套件 Phase 3） | — |
| P3（spec-first） | P3 | Suites/ApiAutomation/Requirements/Chat/McpAdmin：**仅在 OpenSpec 增补后定义** | — |

**共享流式契约**：版本化事件包 `{ runId|executionId, seq, type, stage?, payload, ts }`；SSE/WS 同包，Web+桌面同构消费。**R8：MVP 重连 = 快照重取**（GET 当前 run/execution 权威态），不做服务端逐事件重放缓冲；`seq` 仅用于排序。
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

**R2 作业协议 + redelivery**：worker 认证后开长连会话流；后端把该用户作业经会话流下发，worker `ack`；socket 断开 = 离线。作业在 Prisma 持久化 `queued→dispatched→running→done`；**worker 重连时后端重投 `dispatched` 但未 ack/未完成的作业**（防会话抖动丢作业）。日志/结果/截图/trace 产物上报，后端登记元数据；失败时登记**最新**截图+日志+trace（automation-workers.3）。

**安全控制（automation-workers.2）**：每作业硬超时→停止+报 timeout；内存/CPU/并发限额（每作业单浏览器上下文）；网络 allow/deny 出站策略；日志脱敏（密钥/token/PII 上报前清洗）；每作业临时隔离浏览器 profile 用后即清；产物大小限额（超限截断/拒绝并记录元数据）。

---

## 8. LangGraph 编排方案

**节点图（需求→用例）**：
```
[start]
 → classify/route        选择路径 + provider
 → retrieve-context      [P2 拉 KB chunk + 来源归因；MVP 仅 AiRunInput 原始/上传上下文]
 → draft                 LLM 产结构化用例（title/priority/preconditions/steps/expected）
 → validate-structure    schema 校验；畸形则 有界重试（R-facet：retries）
 → [tool-call]           MVP=原生工具节点（如结构化校验/格式化工具，非 MCP）；P2 追加 MCP 节点
 → [skill-adapter]       [P2 仅受控适配器 + 权限执行]
 → human-approval        接受/编辑/拒绝——accept 前禁写 canonical
 → persist-handoff       接受草稿 → TestCase/TestStep（经 TestAssetsModule）
 → trace                 收口 WorkflowStageEvent
[end]
```

**Critic MUST-2（backend-ai-orchestration.1 全 facet 落地）**：该场景要求 "state, **tool calls, retries**, streaming, human approval"。落地拆解：
- **state**：R1——运行态存 Prisma `AiWorkflowRun`（非 LangGraph checkpointer）。
- **tool calls（MVP）**：MVP 图含**原生（非 MCP）工具节点**（如结构化输出校验/规范化工具），有 MVP 验收 + 测试；**MCP 工具** = Phase 2（backend-ai-orchestration.3）。R7：MVP 图**拓扑上无 MCP/Skill 节点**（非开关），CI 扫描禁止 MVP 图 import MCP/Skill。
- **retries（MVP）**：`validate-structure` 与 provider 调用采用有界退避重试；耗尽→stage `fail` + run `failed`（记录 `retryCount`，不静默吞掉）。有 MVP 验收 + 测试。
- **streaming**：每节点发 `WorkflowStageEvent` → 映射共享流包（§6），Web+桌面同构渲染。
- **human approval（R1 resume）**：`human-approval` 为软边界——图跑到审批点**返回并结束**，`AiWorkflowRun.status=awaiting-approval`；**续跑 = `POST /ai/runs/:id/approve` 读 Prisma run 态作为显式输入调用 post-approval 子图/节点**（无 `interrupt()`/checkpointer 依赖）。accept 前不写 canonical（ai-test-generation.2）。

**MCP tool-call 节点 [P2]**：仅 approved 工具经后端托管 MCP client；记录 `McpToolCall`；非白名单调用前拒绝。
**Skill 适配器节点 [P2]**：仅经受控适配器（无任意执行），执行安装的权限策略；记录 `SkillInvocation`；权限未批则拒绝。

---

## 9. MCP 与 Skills 安全边界

**MCP（backend-ai-orchestration.3）**：仅后端托管 client（绝不暴露给 renderer/worker）；approved-tools 白名单（图在调用前拒绝其余）；每次调用记 `McpToolCall`（工具/server/approved 标志/脱敏参数/结果元数据/状态/时序）。

**Skills（skills-store.1–5）**：包元数据 + **checksum** installable 前验证；验证失败阻断安装且**保留当前版本**（无半态）；激活前显式权限审查 + 独立批准步（`permissions/approve`）；仅经**受控适配器**接入 LangGraph/MCP/worker（无自由代码执行）；调用在已批准权限集下运行，越权即拒；每次调用记 `SkillInvocation`；update + **回滚**到上一兼容版；验证失败保留当前版本。

**客户端/worker 隔离**：Electron `contextIsolation`+`sandbox`，renderer 无 Node/fs，仅类型化桥；Skills/MCP **绝不**从 renderer 调用——一律后端/worker 经适配器；worker 出站受 allowlist；worker 内 Skill/工具活动仍在权限策略 + 日志脱敏 + 产物限额下。

**R5 密钥机制（MVP，栈内无外部密钥管理器）**：**Postgres 信封加密**——KMS 或应用主密钥；每凭据 DEK；`credentialCiphertext` + `credentialKeyId` 密文列；`ModelProviders.validate` **进程内解密、永不返回密钥**；支持主密钥轮换（见 §11 pre-mortem c）。

---

## 10. 每阶段验收标准（可测、双向可追溯到 OpenSpec 场景）

> **Critic MUST-6 双向可追溯**：每条 MVP 验收标注 OpenSpec 场景来源；每个 in-MVP 场景至少 1 条验收。
> **Clean-room 评审门（所有阶段）**：WHEN 任一模块提交 THEN 评审确认无上游 代码/图片/Logo/文案/样式/提示词/文档/布局 复制，仓库无上游 源码/迁移/打包物，有风险参考附 provenance 记录（clean-room-rebuild.1,2,4）；WHEN 请求映射到非目标（企业微信/复杂 RBAC）THEN 拒绝或延后（clean-room-rebuild.3）。

**Phase MVP**：
- 登录后仅见拥有/受邀项目（platform-foundation.1）。
- 角色仅 owner/member，无复杂 RBAC 面（platform-foundation.2）。
- 配置 OpenAI 兼容 provider → 校验通过、可被 AI 选用、凭据以密文存储不返回明文（platform-foundation.3 + R5）。
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
- **流式重连经快照重取恢复当前权威态**（R8，措辞为"获得当前权威态"而非"补发遗漏事件"）。
- **Web UI 提供 API automation 导航占位路由**作为 web-ui.3 的部分满足（MUST-3）。

**Phase 2**：
- 项目 KB CRUD/浏览项目隔离（knowledge-rag.1）；ingest → 抽取/chunk/来源元数据（.2）；检索经**可替换 `RetrievalBackend`**（pgvector-first），后端切换测试无需改域逻辑通过（.3）；RAG 生成含可追溯来源归因（.4）；诊断返回 query/命中/分数/来源（.5）。
- Skill 安装先验证元数据+checksum，失败则阻断且保留当前版（skills-store.1,5）；激活前显式权限审查/批准（.3）；仅经受控适配器在权限策略下运行 + 记调用元数据（.4）；update 失败可回滚到上一兼容版且保留当前版（.5）。
- AI 图调工具时仅 approved MCP 工具运行且记 `McpToolCall`（backend-ai-orchestration.3）。

**Phase 3（spec-first — 先门控）**：
- 排期 Phase-3 域（测试套件/完整 API 自动化/需求管理评审/对话 UI/MCP 管理 UI）时，**在补充对应 WHEN/THEN OpenSpec 需求并批准前不得开工**。
- spec 就位后，该域继承同一 clean-room 门、后端拥有编排规则、密钥引用/隔离不变量，并据新场景派生自身验收。

---

## 11. Pre-mortem（deliberate 模式 — 针对修订后真实 Top 风险）

1. **审批续跑态重构产生分叉/重复草稿（R1 接缝）**：无 checkpointer 时 post-approval 从 Prisma 重建可能重复落库。
   *缓解*：`approve` 幂等（run 状态机 `awaiting-approval→accepted` 单向 + 唯一约束）；persist-handoff 以 runId 去重；R1 human-approval-and-resume e2e 断言"一次审批 = 一组 canonical 用例"。
2. **worker 会话断连丢作业（R2 接缝）**：会话抖动期下发的作业丢失。
   *缓解*：作业 Prisma 持久化 + 重连重投 `dispatched` 未 ack（§7）；集成测试模拟断连断言重投恰一次。
3. **主密钥泄露/轮换（R5）或 clean-room 污染**：主密钥泄露危及全部 provider 凭据；或误引入上游源码。
   *缓解*：信封加密（DEK per 凭据）限制爆炸半径；支持主密钥轮换（重加密 DEK）；密钥永不入日志/产物（脱敏）；秘密扫描 CI 对日志/产物失败即断构建；clean-room 评审门 + provenance 记录 + CI 扫描禁上游 import。

---

## 12. 扩展测试计划（deliberate 模式 — 每条修订绑定具体门，MUST-7）

**Unit**：角色逻辑（仅 owner/member，无提权路径）；`ModelProvider` 序列化永不输出凭据材料 + 校验状态机；LangGraph 节点 reducer（draft/validate 重试；审批边界阻断落库）；`RetrievalBackend` 接口一致性（pgvector 适配 + stub 适配证可换）[P2]；Skill 包验证含失败保留当前版 [P2]；日志脱敏 + 产物限额工具。
**Integration**：Auth→项目隔离；AI-gen run 需求→草稿→approve→落 TestCase/TestStep，reject 不写 canonical；**R2 会话流作业生命周期 claim/heartbeat/logs/result/artifact + 断连重投恰一次**；审计行（AI 创建用例、skill install/activate、MCP 调用）；MCP 白名单执行 + `McpToolCall` [P2]；Skill 适配器权限策略调用 [P2]；RAG ingest→chunk→embed→retrieve + 来源归因 + 诊断 [P2]。
**E2E**：Web 项目导航→建用例→跑本地 worker→看含产物报告；桌面同流并断言 renderer 仅经类型化桥（无 Node/fs）、同契约、worker 启停、端点切换；**R1 human-approval-and-resume e2e**；**R8 重连快照 e2e**；流式 SSE/WS 进度 Web+桌面同构。
**Observability**：结构化 stage-event trace 持久+可查；审计完整性断言；worker 健康（心跳缺失→作业标记丢失；超时→记 timeout）；**秘密扫描门**（日志/产物含凭据即失败）；指标（run 成功失败率、检索分数分布[P2]、worker 时长/超时计数）。
**专门安全/门控测试（每修订绑定）**：**R3** worker-token 绑定/拒绝安全测试；**R7** CI import 扫描（MVP 图无 MCP/Skill import）；**R5** 进程内解密永不返回密钥测试；**R10** 矩阵-diff 门（phase-close 前 verifier 对 13 域矩阵 vs 实际 OpenSpec 场景做 diff，本轮已核验争议行：域 4/6对话/9/11UI = Not-in-OpenSpec 正确；域 8 API 自动化 = In-OpenSpec 部分延后，已修正）。

---

## 13. ADR（架构决策记录）

- **Decision**：以 OpenSpec 为唯一需求源，clean-room 重建；MVP=OpenSpec MVP，Phase2=KB/RAG+Skills+MCP 机制，Phase3=spec-first 域；检索 pgvector-first 置于可替换接口后；MVP 执行仅本地 Electron Playwright worker；MVP AI-gen 运行态存 Prisma 而非 LangGraph checkpointer；worker 经认证会话流 + 作业重投；密钥用 Postgres 信封加密。
- **Drivers**：需求完整性风险、安全边界完整性、检索可替换性、LangGraph.js 成熟度风险、MVP 可交付性。
- **Alternatives considered**：Qdrant-first（运维/安全成本过高，接口保证可后切）；后端 worker 池（被 OpenSpec 排除）；LangGraph 持久 interrupt/checkpointer（成熟度风险耦合 canonical 写路径，改为 Prisma 态 + 续跑子图）；BullMQ 作 worker 传输（N=1 单 worker 场景无仲裁价值，改会话流，BullMQ 仅后端内部记账）；外部密钥管理器（栈内不存在，改信封加密）。
- **Why chosen**：在满足全部 OpenSpec 场景前提下，将三处 MVP 最难机制（持久 interrupt / 队列作 worker 传输 / seq 重放）降到诚实原语（Prisma 态 / 会话流 / 快照重取），不扰动 P2 架构（节点拓扑、队列、流包均保留）。
- **Consequences**：MVP 更可交付、原则更干净；代价是 Phase 2 引入 MCP/Skill 节点与检索后端时需增量接线（已由拓扑保留吸收）；pgvector 需原生 SQL 迁移（已记录）。
- **Follow-ups（design.md 开放问题，待产品决策，不阻断 MVP 结构）**：部署目标（Docker Compose/单 VPS/K8s/托管云）；provider 集（仅 OpenAI 兼容 vs 兼 Ollama/Qwen/DeepSeek——影响 `ModelProvider.kind`/校验广度与 i18n）；合规姿态；语言（中/英/双语——影响 web-ui i18n）；Electron OS 目标（首发 Windows vs 多平台——影响打包）。

---

## 14. 执行边界（本轮）

本文件为 **PENDING APPROVAL** 规划产物。未运行任何变更命令、未改源码、未提交/推送/建 PR、未委派实现。批准后可经 `/oh-my-claudecode:team`（并行，推荐）或 `/oh-my-claudecode:ralph`（顺序）执行。
