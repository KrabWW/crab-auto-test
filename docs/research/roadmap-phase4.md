# Phase 4 地平线框架（Horizon Framework）

> **状态声明 / STATUS**
> Phase 4 **没有**任何 committed OpenSpec。本文档是**前瞻性框架（forward-looking framework）**，不是需求规格，不是可执行计划。文中列出的每一项 Phase 4 候选能力，若要推进，**必须先独立撰写并批准一个 OpenSpec change**（ADDED 新 cap 或对既有 cap 的 MODIFIED delta），方可进入实现。**今天这里没有任何东西是可执行的。** OpenSpec 是唯一的需求来源；Phase 4 候选项不是绑定需求，只是候选。
>
> Phase 4 = 推迟到 Phase 3 之外的能力。Phase 3 本身（`fill-spec-gaps-phase3`：test-suite / api-automation / requirement-management / llm-chat / mcp-admin 五个 cap）**尚未实现**，且仍受 spec-first gate 约束。Phase 4 在 Phase 3 落地之前不会启动。
>
> 范围来源：
> - `openspec/changes/fill-spec-gaps-phase3/proposal.md` Non-Goals "STILL DEFERRED WITHIN PHASE 3"
> - `openspec/changes/fill-spec-gaps-phase3/design.md` Non-Goals "STILL DEFERRED WITHIN PHASE 3" + Risks §8 (mcp-admin global boundary) + Open Questions
> - `docs/wharttest-parity-audit.md` §3.4 (P3 永久非目标) + §4 (优先级)
> - `docs/wharttest-feature-checklist.md` `[-]` 永久非目标项
>
> 不变量基线（每个候选项都要核对）：
> - **simple-roles**：仅 owner/member，无 reviewer/approver/admin/global-admin 角色
> - **backend-owns-orchestration**：LLM / MCP 调用必须在 NestJS 后端执行
> - **clean-room**：不得复用 WHartTest 源码/素材/文案/样式/提示词/精确布局/API 实现细节
> - **R1**：不引入 durable LangGraph checkpointer / `interrupt()`
> - **R2**：不引入 BullMQ 作为 worker 传输；多步工作流范围受 `backend-ai-orchestration` R2 约束
> - **R5**：不引入外部 secret manager（用平台 envelope 加密）
> - **R8**：不引入服务端事件重放缓冲（用 snapshot 重取）

---

## 一、Phase 4 延后候选项（8 项 × 5 维度）

### 候选 1：分布式 API 执行 worker 池（Distributed API execution worker pool）

**动机 (Motivation)**
Phase 3 的 `api-automation`（design.md D9）默认用本地 Electron worker 执行 API 用例。当 API 用例规模增长、或需要并行回归时，单本地 worker 成为吞吐瓶颈。一个后端侧或可横向扩展的 API worker 池可以提升批量 API 回归效率，并让 API 自动化脱离"必须有一台桌面端在线"的前置条件。

**为何延后 (Why deferred)**
`fill-spec-gaps-phase3/proposal.md` Non-Goals "STILL DEFERRED WITHIN PHASE 3" 明确：分布式 API 执行 worker 是 later spec-first change。Phase 3 的 `api-automation` spec 只绑定本地 Electron worker 作为默认执行器，分布式池不在 Phase 3 的绑定范围内，避免在 Phase 3 spec 批准面上引入未定的传输拓扑。

**前置 (Prerequisite)**
不能直接实现。需要先写一个独立 OpenSpec change：
- **方案 A（新 cap）**：新增 cap `distributed-api-workers`，定义 worker 池注册、任务分发、执行记录回传。
- **方案 B（MODIFIED）**：对 `api-automation` 的执行器要求做 MODIFIED delta，承认"本地 Electron worker 之外的执行器"为合法执行源；并可能 MODIFIED `automation-workers` 以区分 UI worker（本地）与 API worker（可分布）。
传输机制必须**不是 BullMQ**（R2），需在 spec 中显式声明所用传输（例如扩展轮询认领、或一个新的非-BullMQ 传输）。

**Clean-room 风险**
WHartTest W4（HttpRunner 完整资产层）+ W16 部署拓扑（celery worker + beat 做分布执行）。镜像诱惑点：(a) HttpRunner 的 Config/Step/RunRequest/RunSqlRequest DSL —— 这是 `api-automation` 整体最高风险域，分布式池不得借机引入其 DSL；(b) celery/beat 风格的分布式 worker 注册与任务路由 —— 须独立设计 worker 注册与分发模型。须记录独立实现 provenance note。

**不变量检查 (Invariant check)**
- **R2**：禁止 BullMQ 传输 —— 任意 worker 池方案必须显式声明非-BullMQ 传输。**通过前提：spec 显式排除 BullMQ。**
- **simple-roles**：worker 用 worker-token 认证，不引入新角色。**不违反。**
- **backend-owns-orchestration**：worker 池由后端调度，API 调用本身是无头 HTTP，不涉及 LLM/MCP 编排。**不违反。**
- **clean-room**：见上，须独立设计。**条件性通过。**
- **R1/R5/R8**：不涉及。**不违反。**
- **注意**：此项是"分布式 **API** 执行"，与永久非目标"分布式 **UI** 执行 / 远程 Playwright worker 池"**不同**。API 执行是无头 HTTP，不是 Playwright；不得借机引入远程 Playwright worker（那会撞 P3 永久非目标）。

---

### 候选 2：自动 MCP 工具发现（Automatic MCP tool discovery）

**动机 (Motivation)**
Phase 3 的 `mcp-admin`（design.md D12）先做手动注册：owner 手工 propose → approve → 进 allowlist。当配置了一个远程 MCP server 后，手动逐个录入工具元数据成本高。自动发现可以从已配置的 MCP server 拉取工具清单，降低治理摩擦。

**为何延后**
`fill-spec-gaps-phase3/proposal.md` Non-Goals 明确：自动 MCP 工具发现延后，先做手动注册。Phase 3 的 `mcp-admin` spec 只绑定手动注册 + allowlist 拒绝谓词，自动发现在 Phase 3 不绑定。

**前置 (Prerequisite)**
独立 OpenSpec change：对 `mcp-admin` 做 MODIFIED delta，增加"自动发现"场景。关键安全约束必须在 spec 中固化：**发现 ≠ 授权**。发现的工具仍必须经 owner approve 进入 allowlist 才能被后端调用；mcp-admin 的拒绝谓词（非白名单调用前拒绝）不得因自动发现而放松。

**Clean-room 风险**
WHartTest W9（远程 MCP 配置注册 + ping + 持久会话按 user+project 缓存）+ `GlobalMCPSessionManager`（跨对话共享浏览器）。镜像诱惑点：(a) 持久会话/全局会话模式 —— crab 必须保持项目级，**不得引入全局会话**（与 P3 永久非目标一致）；(b) 发现后自动启用的流程 —— 不得绕过 owner 审批。须记录独立 provenance note。

**不变量检查 (Invariant check)**
- **simple-roles**：发现后的审批仍是 owner/member，不引入新角色。**不违反。**
- **clean-room**：独立设计发现与注册流程，不复用 WHartTest 会话管理代码。**条件性通过。**
- **项目级限定**：发现范围必须限于项目级已配置的 MCP server，**不得引入平台全局工具**（P3 永久非目标，见永久非目标段）。**通过前提：spec 显式声明仅项目级。**
- **mcp-admin 拒绝谓词所有权**：自动发现不得削弱"非白名单调用前拒绝"。**通过前提：spec 显式保留。**
- **R1/R2/R5/R8**：不涉及。**不违反。**

---

### 候选 3：跨项目需求复用（Cross-project requirement reuse）

**动机 (Motivation)**
Phase 3 的 `requirement-management`（design.md D10）需求是项目级受管实体。当多个项目共享同一份业务需求文档（如通用登录规范、通用支付流程）时，逐项目重复上传+解析+评审成本高。跨项目复用可以让一份已批准需求被多个项目引用。

**为何延后**
`fill-spec-gaps-phase3/proposal.md` Non-Goals 明确：跨项目需求复用延后。Phase 3 的 `requirement-management` spec 只绑定项目级需求实体 + draft→reviewed→approved 工作流，跨项目引用不在 Phase 3 绑定范围。

**前置 (Prerequisite)**
独立 OpenSpec change，二选一：
- **方案 A（MODIFIED）**：对 `requirement-management` 做 MODIFIED delta，增加"跨项目引用已批准需求"场景，定义引用方项目的 owner 如何消费、被引用方 owner 如何授权。
- **方案 B（新 cap）**：新增 cap `shared-requirements`，定义共享需求实体及其与项目级需求的引用关系。
关键问题：跨项目共享会触及多租户隔离边界（`platform-foundation` 的项目资源隔离），须在 spec 中明确共享实体的所有权与各项目消费时的隔离语义。

**Clean-room 风险**
WHartTest W7（需求管理 + token 感知模块拆分 + 专项分析评审 + 带评分报告）。镜像诱惑点：token 感知拆分逻辑、评审报告结构。crab 的需求实体模型与评审工作流须保持独立设计，跨项目复用不得借机镜像其拆分/评审表达式。须记录 provenance note。

**不变量检查 (Invariant check)**
- **simple-roles**：跨项目共享需定义"谁可批准共享"——须用 owner/member 表达，**不得引入跨项目 admin 角色**。**通过前提：spec 用 owner/member 表达授权。**
- **多租户隔离**：引用不得破坏项目级资源隔离（`platform-foundation`）。**通过前提：spec 显式定义隔离边界。**
- **clean-room**：独立设计。**条件性通过。**
- **R1/R2/R5/R8**：不涉及。**不违反。**

---

### 候选 4：多 provider 对话扇出（Multi-provider chat fan-out）

**动机 (Motivation)**
Phase 3 的 `llm-chat`（design.md D11）是单会话单 provider 的交互对话。多 provider 扇出可以让同一 prompt 并行发给多个已配置 provider，对比输出质量，辅助选型与质量评估。

**为何延后**
`fill-spec-gaps-phase3/proposal.md` Non-Goals 明确：多 provider 对话扇出延后。Phase 3 的 `llm-chat` spec 只绑定单 provider 会话，扇出不在 Phase 3 绑定范围。

**前置 (Prerequisite)**
独立 OpenSpec change：对 `llm-chat` 做 MODIFIED delta，增加"扇出会话"场景；可能同时 MODIFIED `platform-foundation` 的 model-provider 配置（若需扇出专用配置）。须定义扇出会话的持久化语义（多路响应如何存入 ChatMessage）与审计。

**Clean-room 风险**
WHartTest W8（LangGraph 对话 + Agent Loop 双运行时 + checkpointer 历史持久化）。镜像诱惑点：双运行时架构、checkpointer 历史持久化。crab 的 `llm-chat` 必须保持**会话级、状态机**，**不得因扇出而引入 durable LangGraph checkpointer**（R1）或 Agent Loop。扇出只是"同一会话内并行多次后端 LLM 调用"，不是多步编排。须记录 provenance note。

**不变量检查 (Invariant check)**
- **R1**：禁止 durable checkpointer / `interrupt()` —— 扇出必须用状态机/会话级模型。**通过前提：spec 显式排除 durable graph。**
- **backend-owns-orchestration**：所有 provider 调用由 NestJS 后端发起。**不违反。**
- **R2 范围**：扇出仍是单轮/会话级，**不引入 tool-calling / 多步状态**，因此不进入 `backend-ai-orchestration` R2 多步工作流范围（与候选 5 区分）。**通过前提：spec 显式声明无 tool-calling。**
- **R8**：禁止服务端事件重放缓冲 —— 扇出流仍用 snapshot 重取。**通过前提：spec 用 snapshot。**
- **simple-roles**：会话归属 owner/member。**不违反。**
- **clean-room**：独立设计。**条件性通过。**

---

### 候选 5：对话工具调用 / 多步编排（Chat tool-calling / multi-step orchestration）

**动机 (Motivation)**
Phase 3 的 `llm-chat`（design.md D11）是**对话专用**：无 tool-calling、无多步状态、无人审批门禁。让对话能调用 MCP/Skill 工具、做多步推理，可以把 `llm-chat` 从"问答"升级为"对话式 agent"。

**为何延后**
`fill-spec-gaps-phase3/proposal.md` Non-Goals 明确：对话 tool-calling / 多步编排"如果将来需要，必须先通过对应 MODIFIED delta 进入 `backend-ai-orchestration` 的多步工作流范围"。这正是 design.md D11 把 `llm-chat` 刻意排除在 R2 之外的原因——一旦加 tool-calling/多步，就**进入 R2 范围**，需要 MODIFIED。

**前置 (Prerequisite)**
**这是 8 项中前置最重的一项。** 不能用 ADDED 绕过。必须写一个独立 OpenSpec change，对 `backend-ai-orchestration` R2 做 **MODIFIED** delta，显式承认"对话式多步工具调用"为合法的多步工作流形态；同时对 `llm-chat` 做 MODIFIED 把会话从"对话专用"扩展为"可挂载工具的多步会话"。两个 MODIFIED 必须协同，且 mcp-admin allowlist 拒绝谓词必须适用于对话工具调用（对话工具调用不得绕过 allowlist）。

**Clean-room 风险**
**8 项中最高风险。** WHartTest W8 的 LangGraph 对话（工具审批 + token 统计 + RAG + checkpointer 历史持久化）+ Agent Loop（create_agent + 中间件：重试/摘要化/HITL + Blackboard 模式 + SSE 步骤事件 + 停止/恢复）。镜像诱惑点几乎覆盖全部受保护表达：durable checkpointer、Blackboard、步骤摘要化、停止/恢复中间件。crab 必须用**状态机**实现多步，**不得**镜像 LangGraph durable 模型。须记录详尽 provenance note。

**不变量检查 (Invariant check)**
- **R1**：禁止 durable LangGraph checkpointer / `interrupt()` —— 多步对话必须用状态机 + snapshot，**不得**用 durable graph。**通过前提：spec 显式用状态机。这是此项的最大不变量风险点。**
- **R2**：禁止 BullMQ 传输 —— 多步对话的步骤调度不得用 BullMQ。**通过前提：spec 显式排除 BullMQ。**
- **R8**：禁止服务端事件重放缓冲 —— 步骤事件用 snapshot 重取。**通过前提：spec 用 snapshot。**
- **backend-owns-orchestration**：所有工具调用由 NestJS 后端发起。**不违反。**
- **mcp-admin allowlist**：对话工具调用必须经 allowlist，**不得绕过** mcp-admin 拒绝谓词。**通过前提：spec 显式引用 mcp-admin allowlist。**
- **simple-roles**：工具审批仍是 owner/member。**不违反。**
- **clean-room**：见上，最高风险。**条件性通过，需最强 provenance 证据。**
- **结论**：此项**可被不变量允许**，但只能以"状态机 + 非-BullMQ + snapshot + allowlist 引用"的形态存在；任何 durable-graph / BullMQ / 重放缓冲 / 绕过 allowlist 的实现都**立即违反** R1/R2/R8/mcp-admin 所有权。

---

### 候选 6：套件执行拓扑（开放问题：专用 suite runner vs 复用 Playwright worker）

**动机 (Motivation)**
Phase 3 的 `test-suite`（design.md D8）用自包含 SuiteRun 持有执行记录 ID 列表做 roll-up，但**谁实际跑套件**未定。复用现有 Playwright worker 可少建组件；专用 suite runner 可做套件级并发与排序控制。

**为何延后**
`fill-spec-gaps-phase3/design.md` Open Questions 明确：套件执行拓扑（复用本地 Playwright worker vs 专用 suite runner）是开放问题。Phase 3 的 `test-suite` spec 只绑定 SuiteRun 实体与 roll-up 语义，拓扑选择不绑定。

**前置 (Prerequisite)**
独立 OpenSpec change：对 `test-suite` 做 MODIFIED delta（或 design decision 更新），固化拓扑选择。若选"专用 suite runner"，可能同时 MODIFIED `automation-workers`（若 runner 复用 worker 传输）。

**Clean-room 风险**
WHartTest W3（套件 + 批量执行）+ W5（WebSocket 驱动 Playwright 执行器 + 分布式部署 + 批量执行）。镜像诱惑点：批量执行调度模型、WebSocket 实时执行流。crab 须保持本地 Electron worker + 轮询认领传输（MVP 简化），**不得**借套件拓扑引入 WebSocket 实时流或分布式 UI 执行。须记录 provenance note。

**不变量检查 (Invariant check)**
- **P3 永久非目标边界**：若拓扑演化为"分布式 UI 执行 / 远程 Playwright worker 池"，**立即撞永久非目标**（见永久非目标段）。**通过前提：spec 显式声明仅本地 Electron worker。**
- **R2**：套件任务传输不得用 BullMQ。**通过前提：spec 显式排除 BullMQ，沿用轮询认领或等价非-BullMQ 传输。**
- **R8**：套件执行事件用 snapshot 重取，不引入重放缓冲。**通过前提：spec 用 snapshot。**
- **simple-roles / backend-owns-orchestration / clean-room**：不引入新角色；套件编排由后端调度；独立设计。**不违反 / 条件性通过。**
- **R1/R5**：不涉及。**不违反。**

---

### 候选 7：API 执行器（开放问题：本地 Electron vs 后端侧 HTTP runner）

**动机 (Motivation)**
Phase 3 的 `api-automation`（design.md D9）默认本地 Electron worker 执行 API 用例。但 API 测试本质是无头 HTTP，不一定需要桌面端；后端侧 HTTP runner 可让 API 自动化脱离"必须有一台桌面端在线"的前置，并简化 CI 场景。

**为何延后**
`fill-spec-gaps-phase3/design.md` Open Questions 明确：API 执行器（本地 Electron worker vs 后端侧 HTTP runner）是开放问题。Phase 3 的 `api-automation` spec 只绑定本地 Electron worker 为默认执行器，后端侧 runner 不绑定。

**前置 (Prerequisite)**
独立 OpenSpec change：对 `api-automation` 做 MODIFIED delta，固化执行器选择。若选后端侧 HTTP runner，须定义后端模块结构与执行记录回传路径。**注意与候选 1 的关系**：单个后端侧 runner（候选 7）是候选 1（分布式池）的退化情形；若直接做后端侧 runner，spec 应显式声明"单实例，非池"，避免与候选 1 的分布式语义混淆。

**Clean-room 风险**
WHartTest W4 HttpRunner 在后端侧（celery）执行。镜像诱惑点：HttpRunner 的 RunRequest/RunSqlRequest + 断言/变量提取 DSL（`api-automation` 整体最高风险域）。后端侧 runner **不得**借机引入 HttpRunner DSL；请求/断言/提取模型须独立设计。须记录 provenance note。

**不变量检查 (Invariant check)**
- **backend-owns-orchestration**：后端侧 HTTP runner 是合法的（API 调用本身不涉及 LLM/MCP 编排）。**不违反。**
- **R2**：若后端侧 runner 用 BullMQ 做任务队列则违反；须用非-BullMQ 机制。**通过前提：spec 显式排除 BullMQ。**
- **simple-roles**：runner 用 worker-token 或等价凭证，不引入新角色。**不违反。**
- **clean-room**：见上，最高 DSL 风险。**条件性通过，需最强 provenance 证据。**
- **R1/R5/R8**：不涉及。**不违反。**
- **与永久非目标边界**：后端侧 **API** runner 不是"分布式 **UI** 执行"，不撞 P3 永久非目标。**不违反。**

---

### 候选 8：对话会话作用域（开放问题：per-user vs per-project-default）

**动机 (Motivation)**
Phase 3 的 `llm-chat`（design.md D11）定义了 ChatSession/ChatMessage/审计，但**会话归属**未定。per-user：每个成员有私有对话历史；per-project-default：项目级共享对话，成员都能看到。

**为何延后**
`fill-spec-gaps-phase3/design.md` Open Questions 明确：对话会话作用域（per-user vs per-project-default）是开放问题。Phase 3 的 `llm-chat` spec 不绑定此选择。

**前置 (Prerequisite)**
独立 OpenSpec change：对 `llm-chat` 做 MODIFIED delta，固化为 ChatSession 作用域选择。若选 per-project-default，须定义成员间的读写权限（谁可发消息、谁可读历史、谁可删除会话）。

**Clean-room 风险**
WHartTest W8 checkpointer 历史持久化。镜像诱惑点：会话历史持久化模型。crab 须保持会话级（**非 durable graph**），不得借作用域选择引入 checkpointer。须记录 provenance note。

**不变量检查 (Invariant check)**
- **R1**：无论哪种作用域，会话仍是非 durable 的会话级实体。**不违反。**
- **simple-roles**：per-user 最干净（无共享读写问题）；per-project-default 须用 owner/member 表达读写权限，**不得引入新角色**。**通过前提（per-project-default）：spec 用 owner/member 定义权限。**
- **R8**：会话事件用 snapshot 重取，不引入重放缓冲。**通过前提：spec 用 snapshot。**
- **backend-owns-orchestration / clean-room**：LLM 调用由后端发起；独立设计。**不违反 / 条件性通过。**
- **R2/R5**：不涉及。**不违反。**

---

## 二、永久非目标（不闭合 / Permanent non-goals）

> 以下项**不是 Phase 4 候选**，也**永远不会是候选**。它们是 clean-room 的**设计取舍**，不是缺口。把它们当 gap 去填会违反不变量。来源：`docs/wharttest-parity-audit.md` §3.4 + `docs/wharttest-feature-checklist.md` `[-]` 项 + `fill-spec-gaps-phase3/design.md` Risks §8。

| 永久非目标 | 为何保持关闭（一行） |
|---|---|
| **企业微信集成（W13）** | crab 是桌面优先的 clean-room 测试平台，产品方向与 IM 嵌入式宿主分歧；IM 集成不是 crab 的产品定位，关闭是方向取舍而非实现缺口。 |
| **复杂 RBAC / 权限矩阵 / 自定义角色（W1）** | **simple-roles 不变量**：仅 owner/member。复杂 RBAC/自定义角色会直接违反 simple-roles，是架构级禁止，不是功能薄。 |
| **完整在线 DOCX 编辑器（W7）** | 全文档编辑器非 crab 目标；crab 用"上传 + 解析 + 受管需求实体"路径，不做内联富文本编辑。关闭是范围取舍。 |
| **分布式 UI 执行 / 远程 Playwright worker 池（W5）** | crab 执行边界是**本地 Electron worker**（`automation-workers` + `desktop-app`）。远程 Playwright worker 池会破坏桌面隔离执行模型与 clean-room 执行边界，是架构禁止。 |
| **平台全局 MCP 工具 + 全局 admin 审批角色（W9 / design.md §8）** | MCP **仅项目级**（`mcp-admin` D12 + design.md §8）。全局工具需要全局 admin 角色，直接违反 simple-roles；design.md §8 明确"全局工具是非目标，且需要先单独 change 形式化 admin 角色"——而 admin 角色本身已被 simple-roles 永久禁止。故此项**双重关闭**。 |
| **独立 FastMCP 服务 / MS 平台桥接（W15）** | crab 的 MCP **内嵌于 NestJS**（`backend-ai-orchestration` 内的机制），不部署独立 FastMCP 容器，不做 MS 平台桥接。这是部署架构分歧（单体后端 vs sidecar 服务），不是功能缺口。 |

**关键认知（再次强调）**：P3 永久非目标不是"待补的 gap"，是 clean-room 的设计取舍。任何把它们重新分类为 Phase 4 候选的尝试，都会在 OpenSpec 审批面上撞不变量（simple-roles / 项目级 MCP / 本地执行边界），应被 Gate D 一致性检查拒绝。

---

## 三、推进规则（给将来撰写 Phase 4 OpenSpec change 的 agent）

1. **一项一 change**：每个 Phase 4 候选项若要推进，写**独立** OpenSpec change，不得在一个 change 里捆绑多个候选。
2. **ADDED vs MODIFIED 先判定**：候选 1（可能新 cap）、候选 2/3/4/6/7/8（MODIFIED 既有 Phase 3 cap）、候选 5（**必须** MODIFIED `backend-ai-orchestration` R2 + `llm-chat`，不可 ADDED 绕过）。
3. **不变量显式核对**：每个 change 的 design.md 必须显式声明对 simple-roles / backend-owns-orchestration / clean-room / R1 / R2 / R5 / R8 的影响，"不违反"须给出理由。
4. **clean-room provenance**：每个 change 须附独立实现路径 provenance note，特别是候选 5（对话多步）与候选 7（API DSL）——这两项是 WHartTest 镜像诱惑最高域。
5. **Phase 3 先落地**：Phase 4 任何 change 的 MODIFIED delta 依赖 Phase 3 cap 已 archive 进 `openspec/specs/`；Phase 3 未 archive 前，Phase 4 的 MODIFIED 在结构上非法。
6. **永久非目标不可复活**：第二节六项不得作为 Phase 4 候选重新提出；若有人提出，应判定为非目标越界并拒绝。

---

*本文档为前瞻性框架，无任何绑定需求。OpenSpec 是唯一需求来源。Phase 4 实现前，每个候选项须先有独立批准的 OpenSpec change。*
