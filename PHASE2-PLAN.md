# Phase 2 计划 — KB/RAG + Skills + MCP 机制 + 加固

> 状态：**待批准**。批准后用文末 autopilot 提示词执行。
> 基线：main `623e3b1`（MVP 端到端已合并：LangChain LLM + SSE + Playwright worker + e2e + isolation + CI，全绿）。
> 权威：`openspec/changes/rebuild-ai-test-platform/PLAN-UNIFIED.md` §3（Phase 2 范围）+ §9（MCP/Skills 安全边界）+ §5 数据模型 [P2] 实体 + §8 MCP/Skill 节点 [P2]。
> 范围：**仅 Phase 2**。不碰 Phase 3（test-suite/api-automation 完整套件/requirement-management/llm-chat/mcp-admin UI，均 spec-first 门控，未补 spec 不实现）。
> 硬约束不变：OpenSpec 唯一需求源；不复制 WHartTest；每步验证；不实现企业微信；不实现复杂 RBAC；不越 OpenSpec 范围。

---

## 0. 现状（MVP 已具备 vs Phase 2 增量）

### MVP 已具备（基线）
- 8 后端模块边界 + 状态机；ai-orchestration 用 LangChain 真实 LLM 草稿（B1）+ SSE 流（B2）
- **R7：MVP 图拓扑无 MCP/Skill 节点**（CI import-scan 强制）
- Playwright worker 真跑（截图/trace/redact/限额/隔离 profile）
- R5 信封加密、R3 worker token、R2 redelivery、R8 snapshot
- 4 CI 门 + Electron isolation + e2e

### Phase 2 增量（PLAN-UNIFIED §3）
| # | 增量 | OpenSpec 能力 | 关键不变量 |
|---|---|---|---|
| P2-1 | **检索后端接口 + pgvector 适配** | knowledge-rag.3 | R9（pgvector 原生 SQL + hnsw/ivfflat）；接口可替换（A1 选项）；首期 pgvector-first，Qdrant 仅接口后切备选（§11 b′5） |
| P2-2 | **知识库模块**（KB/Document/Chunk + ingest/chunk/embed/retrieve + 来源归因 + 诊断） | knowledge-rag.1,2,4,5 | 项目级隔离；RAG 上下文注入 ai-orchestration 升级 ai-test-generation.1 的 "project knowledge" 路径；来源归因进 trace |
| P2-3 | **Skills 商店模块**（包+checksum 验证/权限审查/受控适配器/回滚/调用审计） | skills-store.1–5 | 失败保留当前版（无半态）；激活前显式权限审查；仅受控适配器（无任意执行，§11 a7）；update+回滚 |
| P2-4 | **MCP 后端机制**（后端托管 MCP TS SDK client + allowlist + McpToolCall 审计） | backend-ai-orchestration.3 | 仅后端托管（绝不暴露 renderer/worker）；approved-tools allowlist；**Phase 2 用后端内部 allowlist 配置（mcp-admin UI 是 Phase 3，未补 spec 不做）**；MCP 工具项目级（§11 a5，无全局工具） |
| P2-5 | **ai-orchestration 接入 MCP 节点 + Skill 适配器节点** | backend-ai-orchestration.2（P2 部分） | **R7 放宽**：MVP 的"拓扑无 MCP/Skill"变为"仅在受控适配器后"——CI import-scan 规则更新（允许 ai-orchestration 引 MCP/Skill 适配器，仍禁 renderer/worker 引） |
| P2-6 | **Web `/knowledge` 路由** | web-ui.3（knowledge context） | 瘦客户端，无 LLM/MCP/Prisma import |
| P2-7 | **加固**：流式契约健壮性、产物保留/大小限额、审计覆盖扩展、检索后端可替换性测试 | §3 加固 | 不变量全程持有 |
| P2-8 | **Phase 2 收口门** | — | typecheck/build/test/e2e 无回归 + 4 门绿 + 新增 P2 测试绿 + clean-room 绿 |

---

## 1. 任务拆解（有序，含依赖与验收）

### 阶段 P2-A — 检索基座（P2-1）
- **P2-1 RetrievalBackend 接口 + pgvector 适配**：`services/api/src/infra/retrieval/` 定义 `RetrievalBackend { embed, query, diagnose }` 接口；pgvector 适配（`$queryRaw` ANN，hnsw/ivfflat 索引）；stub 适配证可换。Prisma 迁移加 `CREATE EXTENSION vector` + `EmbeddingRef` 表（R9：vectorRef 非 Prisma 原生列，用原生 SQL 迁移）。
  - 验收：`U-RETRIEVAL-IF`（接口一致性 + stub 切换无需改域逻辑）通过；`I-RETRIEVAL-SWAP` 通过。

### 阶段 P2-B — 知识库（P2-2，依赖 P2-A + embeddings provider）
- **P2-2 KnowledgeModule**：`services/api/src/modules/knowledge/`。KB/Document CRUD（项目隔离）；ingest→抽取文本→chunk→保留来源元数据（filename/section/page）；embeddings 经 RetrievalBackend；检索 query 返回命中 chunk + 分数 + 来源；**来源归因**注入 ai-orchestration（升级 `WorkflowStageEvent.sourceAttribution`）；诊断端点 `POST /projects/:id/retrieval/query`。NestJS 模块 + REST。Prisma 实体：KnowledgeBase/Document/DocumentChunk/EmbeddingRef [P2]。
  - 验收：`I-RAG-PIPELINE` 通过（ingest→chunk→embed→retrieve + 来源归因 + 诊断）；knowledge-rag.1–5 场景各 ≥1 测试。

### 阶段 P2-C — Skills 商店（P2-3，可与 P2-B 并行）
- **P2-3 SkillsModule**：`services/api/src/modules/skills/`。包格式解析（name/version/description/author/compatibility/permissions/entryPoints/checksum）；**installable 前验证**（checksum+metadata）；**验证失败阻断安装且保留当前版**（无半态）；install/update/disable/uninstall/rollback（`SkillInstallation.previousVersionId` 回滚指针）；**激活前显式权限审查 + 独立批准步**（`POST /skills/:id/permissions/approve`，仅 owner/member，无新角色 §11 a2）；**受控适配器**（typed adapter `langgraph|mcp|worker`，禁 eval/vm.runInNewContext/动态 require）；`SkillInvocation` 审计（argsRedacted/resultMeta/status）。Prisma 实体：Skill/SkillInstallation/SkillInvocation [P2]。
  - 验收：`U-SKILL-VALID`（失败保留当前版）+ `I-SKILL-ADAPTER`（权限策略调用）+ `I-SKILL-FAIL-KEEP`（update 失败回滚）通过；skills-store.1–5 场景各 ≥1 测试。

### 阶段 P2-D — MCP 后端机制（P2-4，可与 P2-C 并行）
- **P2-4 McpModule（机制）**：`services/api/src/modules/mcp/`。后端托管 MCP TS SDK client（`@modelcontextprotocol/sdk`）；**approved-tools allowlist**（Phase 2 用后端内部配置/DB 表，无管理 UI——mcp-admin UI 是 Phase 3 spec-first 门控）；每次调用记 `McpToolCall`（tool/server/approved/argsRedacted/resultMeta/status/timing）；**MCP 工具项目级**（无全局工具，§11 a5）；拒绝谓词归 mcp-admin（Phase 3）——Phase 2 先在后端内部 allowlist 守护，第三 change MODIFIED 后再改为引用 mcp-admin。Prisma 实体：McpToolCall [P2] + allowlist 表。
  - 验收：`I-MCP-WL`（非白名单调用前拒绝 + McpToolCall 记录）通过；backend-ai-orchestration.3 场景 ≥1 测试。

### 阶段 P2-E — 接入编排图（P2-5，依赖 P2-B/C/D）
- **P2-5 ai-orchestration 追加 MCP 节点 + Skill 适配器节点**：在 §8 节点图 `[tool-call]`（MVP 原生）后追加 `[mcp-tool-call]` + `[skill-adapter]`（P2）。LangGraph/LangChain 调用经 McpModule/SkillsModule 受控适配器；非白名单 MCP 调用前拒绝；Skill 权限未批则拒绝。**R7 放宽**：更新 `infra/ci/r7-import-scan.mjs` 规则——允许 `ai-orchestration/` 引 `@modelcontextprotocol/sdk` + `../skills` + `../mcp`，但仍禁 renderer/worker 引（新增 renderer/worker 扫描）。
  - 验收：R7 门（放宽版）PASS；`I-MCP-WL` + `I-SKILL-ADAPTER` 在图内调用路径通过；MVP 套件无回归。

### 阶段 P2-F — 前端 + 加固（P2-6, P2-7，依赖 P2-B）
- **P2-6 Web `/knowledge` 路由**：`apps/web/pages/projects/[id]/knowledge.vue`（KB 列表 + 文档上传 + 检索诊断展示）。shadcn 组件。无 LLM/MCP/Prisma import。
- **P2-7 加固**：流式契约重连/背压健壮性测试；产物保留策略 + 大小限额执行；审计覆盖扩展（KB ingest、skill install/activate、MCP 调用均审计）；检索后端可替换性测试（pgvector↔stub）。
  - 验收：`O-AUDIT-INTEGRITY` 扩展通过；`I-RETRIEVAL-SWAP` 通过；流式重连 e2e 无回归。

### 阶段 P2-G — 收口门（P2-8）
- **P2-8 Phase 2 门**：`pnpm -r typecheck && pnpm -r build` 绿；`pnpm --filter @crab/api test` 绿（含新增 P2 测试）；MVP e2e 无回归；4 CI 门绿（R7 放宽版 + F8 + clean-room + secret-scan）；clean-room 绿；提交合并。

---

## 2. 依赖顺序
```
P2-1(retrieval) ──┬──> P2-2(knowledge) ──┐
                  │                        ├──> P2-5(graph nodes) ──> P2-6(/knowledge) ──> P2-7(hardening) ──> P2-8(gate)
P2-3(skills) ─────┤                        │
P2-4(mcp) ────────┘                        │
                  └──(P2-3/P2-4 可与 P2-2 并行)
```
P2-1 是 P2-2 的硬前置（embeddings）；P2-3/P2-4 可与 P2-2 并行；P2-5 依赖 B/C/D 全部就绪。

---

## 3. 不做（硬边界）
- **Phase 3（spec-first 门控，未补 spec 不实现）**：test-suite、api-automation 完整套件、requirement-management、llm-chat、mcp-admin **UI**（P2-4 只做后端机制，不做管理界面）。
- **永久非目标**：企业微信、复杂 RBAC、全 DOCX 编辑器、分布式/远程 worker、平台全局 MCP 工具 + 全局 admin、复制 WHartTest、客户端 LLM/MCP。
- **MVP 机制不引入（仍守）**：LangGraph durable checkpointer/interrupt（R1）、BullMQ 作 worker 传输（R2）、服务端事件重放缓冲（R8）、外部密钥管理器（R5）。
- **Phase 2 内仍延后**：分布式 API 执行 worker、MCP 工具自动发现（先手动注册）、跨项目需求复用、chat 多 provider fan-out、chat tool-calling。

---

## 4. 风险
- **pgvector 原生 SQL（R9）**：Prisma 无 `vector` 类型，需 `$queryRaw` + 手写迁移 SQL（extension + hnsw/ivfflat 索引）。CI 需 Postgres + pgvector 镜像（`postgis/postgis` 或 `pgvector/pgvector`）。
- **R7 规则放宽边界**：MVP 的"图无 MCP/Skill"是结构性 absence；Phase 2 引入后须改为"仅 ai-orchestration 经适配器引，renderer/worker 仍禁"——规则要精确，避免误放。
- **MCP allowlist 归属**：Phase 2 用后端内部 allowlist；mcp-admin（Phase 3）拥有"拒绝谓词单一真相源"。须在代码注释 + 文档明确 Phase 2 是过渡态，第三 change MODIFIED 后改引用。
- **Skills 受控适配器**：禁 eval/vm/动态 require 须有测试断言（CI 扫描 + unit）。
- **MCP TS SDK 版本**：接前用 Context7 查最新 `@modelcontextprotocol/sdk` TypeScript 用法。
- **LangGraph 节点插入**：MVP 是状态机非持久 LangGraph 图；P2 节点插入仍守 R1（不引 checkpointer），只在状态机里加 MCP/Skill 调用步。

---

## 5. autopilot 提示词（计划批准后复制使用）

```
/oh-my-claudecode:autopilot "完成 crab-auto-test Phase 2（KB/RAG + Skills + MCP 机制 + 加固）。基于已合并 main 的 623e3b1 MVP。读 crab-auto-test/PHASE2-PLAN.md 与 openspec/changes/rebuild-ai-test-platform/PLAN-UNIFIED.md（§3/§5/§8/§9）为权威。

范围仅 Phase 2，按 PHASE2-PLAN.md 的阶段 P2-A→G 顺序执行：
P2-1 RetrievalBackend 接口 + pgvector 适配（infra/retrieval/；R9 原生 SQL + hnsw/ivfflat；stub 适配证可换；Prisma 迁移加 CREATE EXTENSION vector + EmbeddingRef 表）
P2-2 KnowledgeModule（KB/Document/Chunk CRUD 项目隔离；ingest→chunk→embed→retrieve；来源归因注入 ai-orchestration；诊断端点；Prisma 实体 KnowledgeBase/Document/DocumentChunk/EmbeddingRef）
P2-3 SkillsModule（包+checksum installable 前验证；失败保留当前版；install/update/disable/uninstall/rollback；激活前显式权限审查（owner/member 无新角色）；受控适配器禁 eval/vm/动态 require；SkillInvocation 审计；Prisma 实体 Skill/SkillInstallation/SkillInvocation）
P2-4 McpModule 后端机制（@modelcontextprotocol/sdk 后端托管 client；approved-tools allowlist 后端内部配置（无 UI，mcp-admin UI 是 Phase 3）；MCP 工具项目级无全局；McpToolCall 审计；Prisma 实体 McpToolCall + allowlist 表）
P2-5 ai-orchestration 追加 MCP 节点 + Skill 适配器节点（经受控适配器；非白名单拒绝；权限未批拒绝；守 R1 不引 checkpointer；更新 r7-import-scan 规则放宽为'仅 ai-orchestration 经适配器引 MCP/Skill，renderer/worker 仍禁'）
P2-6 Web /knowledge 路由（KB 列表 + 文档上传 + 检索诊断展示；shadcn 组件；无 LLM/MCP/Prisma import）
P2-7 加固（流式重连/背压测试；产物保留/大小限额执行；审计覆盖扩展 KB ingest/skill install+activate/MCP 调用；检索后端可替换性测试 pgvector↔stub）
P2-8 Phase 2 收口门（pnpm -r typecheck && build 绿；api test 绿含新增 P2 测试；MVP e2e 无回归；4 CI 门绿（R7 放宽版 + F8 + clean-room + secret-scan）；clean-room 绿；提交合并）

硬约束：
- OpenSpec 唯一需求源；不复制 WHartTest 任何源码/素材/Logo/文案/样式/配置（clean-room scan 须持续绿）
- 每步实现后运行验证（typecheck/build/test/门），失败就修，不跳过
- 不实现企业微信；不实现复杂 RBAC（仅 owner/member）
- 不越 OpenSpec 范围：不碰 Phase 3（test-suite/api-automation 完整套件/requirement-management/llm-chat/mcp-admin UI，均 spec-first 门控）；P2-4 只做 MCP 后端机制不做管理 UI
- 仍守 MVP 机制禁区：不引入 LangGraph checkpointer/interrupt（R1）、BullMQ 作 worker 传输（R2）、服务端事件重放缓冲（R8）、外部密钥管理器（R5）
- 接 @modelcontextprotocol/sdk 前用 Context7 查最新 TypeScript 用法，避免 API 过期
- pgvector 用原生 SQL 迁移（R9）；CI 用 pgvector/pgvector 镜像
- Skills 受控适配器禁 eval/vm.runInNewContext/动态 require，须有 CI 扫描 + unit 断言
- MCP allowlist Phase 2 用后端内部配置；mcp-admin 拥有拒绝谓词 SOT 是 Phase 3（第三 change MODIFIED 后改引用），代码注释明确过渡态

每完成一个阶段提交一次（feat(crab-auto-test): Phase 2 - <阶段>），全部完成后合并到 main。"
```

---

## 6. 执行边界
本文件为**待批准**计划。未写代码、未改源码、未提交。批准后用 §5 提示词跑 autopilot。
