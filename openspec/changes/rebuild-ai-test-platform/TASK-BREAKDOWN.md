# 任务拆解与执行顺序 — Clean-Room AI 测试平台实现

> 状态：**PENDING APPROVAL**（本轮只输出任务拆解与执行顺序，不写代码、未创建任何源码/openspec 文件）
> 需求源：`openspec/changes/rebuild-ai-test-platform/PLAN-UNIFIED.md`（绑定）+ 9 个 capability spec
> 输入：explore 仓库映射 + architect 模块边界 + security-reviewer 安全任务 + test-engineer 测试策略
> 硬约束：OpenSpec 唯一需求源；WHartTest 仅产品调研不复制；栈固定（Nuxt3+Vue3+TS+Tailwind+shadcn-vue + Electron + NestJS+Prisma+LangChain+LangGraph+MCP+Playwright）

---

## 0. 仓库现状（explore 映射结论）

- **真 greenfield**：根目录仅有 `openspec/`（需求源）、`WHartTest/` + `WHartTest-upstream/`（上游参考，**禁复制**，仅产品调研）、`.omc/`、`.codex/`、`prompt.md`。无任何实现代码、无 `package.json`/`pnpm-workspace.yaml`。
- **新代码落地**：在 `crab-auto-test/` 根新建 pnpm monorepo：`apps/web`（Nuxt3）、`apps/desktop`（Electron）、`services/api`（NestJS）、`packages/{shared-types,ui,config}`、`infra/`（CI/脚本）。
- **clean-room 边界**：`WHartTest*` 须从新 workspace globs 排除（gitignore/pnpm ignores），F8 漂移门防御 stale `.omc/plans/rebuild-ai-test-platform-plan.md` 回归。

---

## 1. 模块边界（architect 输出，任务 file scope 基准）

### 后端 `services/api/src/modules/`（NestJS，**所有 AI/LangGraph/MCP/LLM 跑在此**）
| ID | 模块 | 能力 | 阶段 |
|---|---|---|---|
| A1 | `auth/` | platform-foundation.1/2 + R3 worker-token | M |
| A2 | `projects/` | platform-foundation.2（owner/member） | M |
| A3 | `model-providers/` | platform-foundation.3 + Architect-R5 信封加密 | M |
| A4 | `audit/` | platform-foundation.4 | M |
| A5 | `test-assets/` | test-asset-management.1 | M |
| A6 | `executions/` | test-asset-management.2–3 + R8 流式 | M |
| A7 | `worker-gateway/` | automation-workers.1–4 + R2 会话流 + R3 token | M |
| A8 | `ai-orchestration/` | backend-ai-orchestration.1,2,4 + ai-test-generation.1–3 + MUST-2 + R1/R7 | M（核心）/ P2（MCP+Skill 节点） |
| A9 | `knowledge/` | knowledge-rag.1–5 | P2 |
| A10 | `skills/` | skills-store.1–5 | P2 |
| A11 | `mcp/` | backend-ai-orchestration.3（机制） | P2 机制 / P3 UI |
| A12 | `infra/prisma/` | 数据层 + pgvector 原生 SQL [P2] | M |
| A13 | `infra/crypto/envelope/` | Architect-R5 信封加密 + 主密钥轮换 | M |
| A14 | `infra/streaming/` | 共享流式契约 + R8 快照重取 | M |
| A15 | `infra/retrieval/` | RetrievalBackend 接口 + pgvector 适配 [P2] | P2 |

### 前端 `apps/web/` + `packages/ui/`（瘦客户端，**禁 LLM/LangGraph/MCP/Prisma import**）
| ID | 模块 | 能力 | 阶段 |
|---|---|---|---|
| B1 | `apps/web/` shell | web-ui.1,2 + web-ui.3 子集 | M |
| B2 | `apps/web/pages/` 路由 | web-ui.3（含 `/api-automation` 占位 MUST-3） | M + P3sf |
| B3 | `packages/ui/` | web-ui.2 shadcn-vue + 一方组件 | M |

### 桌面 `apps/desktop/`（Electron，R6 SPA/静态，contextIsolation+sandbox）
| ID | 模块 | 能力 | 阶段 |
|---|---|---|---|
| C1 | `main/` | desktop-app.1,3,4,5 | M |
| C2 | `preload/` | desktop-app.2 类型化桥 | M |
| C3 | `renderer/` | desktop-app.1 + R6 | M |
| C4 | `worker/` | automation-workers.1–4（Playwright） | M |

### 共享 `packages/`
| ID | 模块 | 说明 | 阶段 |
|---|---|---|---|
| D1 | `shared-types/` | DTO/流式包/worker 协议/错误码 — **types only** | M |
| D2 | `config/` | tsconfig/eslint/tailwind/prettier | M |

### Phase-3 spec-first 门控 cap 模块（**spec 批准前不实现**）
| ID | 模块 | 能力 | 阶段 |
|---|---|---|---|
| E1 | `test-suite/` | test-suite（自包含 SuiteRun，e6） | P3sf |
| E2 | `api-automation/` | api-automation（显式 Phase-3 门控，e9） | P3sf（占位路由 M） |
| E3 | `requirements/` | requirement-management（owner 批准，a2） | P3sf |
| E4 | `llm-chat/` | llm-chat（会话级，e8 不属 R2） | P3sf |
| E5 | `mcp-admin/` | mcp-admin（项目级，a5/e7，拥有拒绝谓词 SOT） | P3sf |

### 跨切契约
- **F1 REST**：`/api/v1`，NestJS 拥有，鉴权+项目域 guard；客户端唯一消费者。
- **F2 流式包**：`{runId|executionId,seq,type,stage?,payload,ts}`；SSE/WS；**R8 快照重取**（非事件重放，b′3）。
- **F3 Worker 作业协议**：认证会话流（R3 token）+ `queued→dispatched→running→done` + 重投未 ack（R2/MUST-5）；BullMQ 仅后端内部（b′2）。
- **F4 Electron 类型化桥**：`worker.start/stop/status`、`backend.getEndpoint/setEndpoint`、`execution.subscribe`（renderer 无裸 socket）。

**依赖方向不变量**（证明后端拥有编排）：`apps/*` 与 `packages/ui` 箭头**仅**指向 `services/api`（REST/流）与 `packages/shared-types`（types）；无任何 `apps/*`→LangChain/LangGraph/MCP/Prisma/LLM provider 箭头。

---

## 2. 安全任务（security-reviewer 输出，按阶段织入）

### MVP 阻塞（必须随 MVP 模块实现）
- **凭据（CRITICAL）**：SEC-CRED-1..5 — 信封加密（A3/A13）、decrypt-never-return-secret 门（SEC-CRED-4 = T-U-PROV-DECRYPT）、主密钥轮换、审计。
- **Worker 鉴权/传输（CRITICAL）**：SEC-XC-1..6 — per-user worker token（A1/A7）、认证会话流+重投（A7）、token 绑定/拒绝门（SEC-XC-4 = T-E-R3-WORKERTOKEN）、redelivery 恰一次门（SEC-XC-5 = T-I-R2-REDELIVERY）。
- **Electron（CRITICAL）**：SEC-EL-1..7 — webPreferences 硬化（C1）、类型化桥 allowlist（C2）、端点安全存储（C1）、worker 子进程 bounded args（C1）、renderer 隔离 e2e 门（SEC-EL-6/7）。
- **Playwright（HIGH）**：SEC-PW-1..8 — 超时/资源限额（C4）、网络 egress 策略（C4）、日志脱敏（C4 + SEC-XC-7 共享 util）、临时隔离 profile（C4）、产物大小限额（C4 + A6）、secret-scan 门（SEC-PW-7 = T-O-SECRET-SCAN）。
- **Clean-room + 门禁**：SEC-CR-1,2,4,5,6,7 — clean-room 扫描、F4/F5/F6/F7/F8、R7 import-scan、R10 矩阵门。
- **跨切**：SEC-XC-7..13 — 脱敏 util、simple-roles guard、流式鉴权、审计完整性、secrets scan、依赖审计、approval 状态机完整性（MUST-1）。

### P2
- **MCP**：SEC-MCP-1..5 — 后端托管 client + allowlist 拒绝谓词（A11）、McpToolCall 审计、项目级（无全局）、allowlist 门。
- **Skills**：SEC-SKILL-1..7 — 包+checksum 验证（失败保留当前版，A10）、权限审查+激活批准、受控适配器（无任意执行，A8 适配器）、回滚、SkillInvocation 审计、验证失败门。

### P3（spec 门控）
- SEC-CRED-6（api-automation 信封复用）、SEC-MCP-6（mcp-admin 治理 UI）、SEC-CR-3（Phase-3 模块无上游复用）。

---

## 3. 测试任务（test-engineer 输出，测试先行 MUST-7）

层级：Unit(~70%) / Integration(~20%) / E2E(~10%) / Observability + Gate。完整 ID 表见 test-engineer 输出；关键绑定：
- **R1**→U-LG-RESUME/E-MUST1-APPROVE；**R2**→I-R2-REDELIVERY；**R3**→U-WORKER-TOKEN/E-R3-WORKERTOKEN；**R4**→I-AI-GEN-UPLOAD；**Architect-R5**→U-PROV-DECRYPT；**R6**→E-DESKTOP-SPA；**R7**→G-R7-IMPORT；**Architect-R8**→U-SNAPSHOT-REFETCH/E-R8-RECONNECT；**R9**→U-RETRIEVAL-IF/I-RETRIEVAL-SWAP；**R10**→G-R10-MATRIX。
- **MUST-1**→E-MUST1-APPROVE；**MUST-2**→U-LG-TOOL-NODE+U-LG-REDUCERS；**MUST-3**→E-WEBAPI-PLACEHOLDER；**MUST-5**→I-R2-REDELIVERY；**MUST-6**→F2 可追溯矩阵；**MUST-7**→每修订绑定命名测试。
- **F1–F8**→`infra/ci/f*.ts` 二值脚本（F7 兜底规则承重、F8 stale 漂移防御）。
- **测试基础设施**：TI-1 Postgres+pgvector testcontainer、TI-2 Playwright、TI-3 Electron smoke harness、TI-4 CI、TI-5 secret-scan、TI-6 clean-room scan、TI-7 import-scan、TI-8 F-gate 矩阵生成器。

---

## 4. 有序任务列表 + 依赖图

> 约定：每个实现任务 **测试先行**（MUST-7）—— T-* 测试在对应 impl 任务前或并行首批。`blockedBy` 用任务 ID。Phase 0→1→2→3 顺序硬约束；同 phase 内按依赖图并行。

### Phase 0 — Bootstrap（基础设施，无业务逻辑）
| ID | 任务 | scope | blockedBy | 安全/测试绑定 |
|---|---|---|---|---|
| P0-1 | pnpm monorepo 脚手架（root package.json + pnpm-workspace.yaml + turbo.json + .gitignore 排除 WHartTest*） | 根 | — | SEC-CR-1 威胁模型；F8 stale 检查起点 |
| P0-2 | `packages/config/`（tsconfig/eslint/tailwind/prettier） | D2 | P0-1 | — |
| P0-3 | `packages/shared-types/` 骨架（DTO/StreamEnvelope/WorkerJob/BridgeApi/ErrorCode，types only） | D1 | P0-2 | U-STREAM-PKG 测试先行 |
| P0-4 | `services/api/` NestJS+Fastify 脚手架 + `infra/prisma/`（Prisma client + 迁移框架） | A12 | P0-2 | TI-1 testcontainer 起 Postgres |
| P0-5 | `infra/crypto/envelope/`（Architect-R5 信封加密 + 主密钥轮换） | A13 | P0-4 | SEC-CRED-1..3；U-PROV-DECRYPT 先行 |
| P0-6 | `infra/streaming/`（共享流式包 + R8 快照重取 helper） | A14 | P0-3 | U-STREAM-PKG, U-SNAPSHOT-REFETCH |
| P0-7 | CI 管线骨架（lint→unit→integration→e2e→gates） | infra/ | P0-4 | TI-4, TI-5, TI-6, TI-7, TI-8 |
| P0-8 | F-gate 脚本 F1–F8 + 可追溯矩阵生成器 | infra/ci/ | P0-3, P0-7 | T-G-F1THRU-F8；F7 兜底、F8 漂移 |

**Phase 0 出口门**：CI 绿；F8 通过（无 stale 模式）；信封加密 unit 通过；clean-room scan 通过（仓库无 WHartTest 复制）。

### Phase 1 — MVP 核心（依赖 P0）
| ID | 任务 | scope | blockedBy | 安全/测试绑定 |
|---|---|---|---|---|
| P1-1 | A1 `auth/`（登录/me + R3 per-user worker-token） | A1 | P0-4, P0-5 | SEC-XC-1,2；SEC-XC-8 simple-roles guard；U-AUTH-ROLES, U-WORKER-TOKEN, T-I-AUTH-ISOLATION |
| P1-2 | A2 `projects/`（CRUD + owner/member 成员） | A2 | P1-1 | SEC-XC-8；U-AUTH-ROLES |
| P1-3 | A4 `audit/`（append-only AuditLog + 查询） | A4 | P1-1 | SEC-XC-10；T-I-AUDIT, T-O-AUDIT-INTEGRITY |
| P1-4 | A3 `model-providers/`（配置 + Architect-R5 信封加密 + validate 永不返回密钥） | A3 | P0-5, P1-1 | SEC-CRED-2,3,5；SEC-CRED-4 门；U-PROV-SERIAL, U-PROV-DECRYPT, T-O-SECRET-SCAN |
| P1-5 | A5 `test-assets/`（模块树/用例/有序步骤） | A5 | P1-2 | U-LG-REDUCERS（persist-handoff） |
| P1-6 | A6 `executions/`（执行记录 + 产物元数据 + R8 流式 events） | A6 | P1-5, P0-6 | SEC-PW-6 产物限额；U-SNAPSHOT-REFETCH, T-O-TRACE-QUERY |
| P1-7 | A7 `worker-gateway/`（R2 认证会话流 + 重投 + R3 token 验证 + 作业持久化） | A7 | P1-1, P1-6, P0-6 | SEC-XC-2,3,4,5,6；SEC-PW-6；I-R2-REDELIVERY（MUST-5）, E-R3-WORKERTOKEN |
| P1-8 | A8 `ai-orchestration/` MVP 图（classify/retrieve[MVP=AiRunInput R4]/draft/validate 重试/native tool 节点/human-approval[R1 Prisma 续跑]/persist-handoff/trace；**R7 无 MCP/Skill 节点**） | A8 | P1-4, P1-5, P0-6 | SEC-XC-13（MUST-1 状态机）；SEC-CR-6 R7 import-scan；U-LG-REDUCERS, U-LG-TOOL-NODE, U-LG-RESUME, I-AI-GEN-FULL, I-AI-GEN-UPLOAD, E-MUST1-APPROVE |
| P1-9 | B3 `packages/ui/`（shadcn-vue + 一方组件，SSR-safe） | B3 | P0-2, P0-3 | E-WEBUI-STACK |
| P1-10 | B1/B2 `apps/web/`（Nuxt shell + 路由：login/projects/test-cases/ai-generation/executions/settings + `/api-automation` 占位 MUST-3） | B1,B2 | P1-9, P1-1..P1-8（API 就绪） | SEC-EL-（renderer 无 Node）；E-WEB-FULL, E-WEBAPI-PLACEHOLDER, E-STREAM-ISO, E-R8-RECONNECT |
| P1-11 | C1 `apps/desktop/main/`（生命周期 + 端点安全存储 + worker 子进程 bounded args） | C1 | P1-10 | SEC-EL-2,4,5；E-DESKTOP-SPA |
| P1-12 | C2 `apps/desktop/preload/`（类型化桥 allowlist，contextBridge） | C2 | P1-11, P0-3 | SEC-EL-3；E-DESKTOP-BRIDGE |
| P1-13 | C3 `apps/desktop/renderer/`（加载 apps/web SPA/静态 R6，注入桥，同契约） | C3 | P1-10, P1-12 | SEC-EL-6,7；E-DESKTOP-BRIDGE, E-DESKTOP-SPA |
| P1-14 | C4 `apps/desktop/worker/`（Playwright runtime + R2 会话流客户端 + 超时/限额/网络策略/脱敏/临时 profile/产物限额） | C4 | P1-7, P1-12 | SEC-PW-2,3,4,5,6；SEC-XC-7 脱敏 util；U-REDACT, T-O-WORKER-HEALTH |
| P1-15 | 端到端 tracer-bullet 打通：web→API→ai-orchestration→worker 本地执行→报告含产物 | 跨 | P1-1..P1-14 | E-WEB-FULL, E-DESKTOP-BRIDGE, E-MUST1-APPROVE, E-R8-RECONNECT, E-R3-WORKERTOKEN |

**Phase 1 出口门（MVP 关闭）**：§10 全 MVP 验收通过；MUST-1/2/3/5 测试通过；F1/F2/F4/F5/F6/F7/F8 全通过；clean-room 门 + secret-scan 门通过；R7 import-scan（MVP 图无 MCP/Skill）+ R10 矩阵门通过。

### Phase 2 — KB/RAG + Skills + MCP 机制（依赖 P1 关闭）
| ID | 任务 | scope | blockedBy | 安全/测试绑定 |
|---|---|---|---|---|
| P2-1 | A15 `infra/retrieval/`（RetrievalBackend 接口 + pgvector 适配 + stub 适配证可换，R9 原生 SQL） | A15 | P1-4（embeddings provider）, P0-4 | U-RETRIEVAL-IF, I-RETRIEVAL-SWAP |
| P2-2 | A9 `knowledge/`（KB/Document CRUD + ingest/chunk/embed + 检索诊断 + 来源归因，注入 ai-orchestration） | A9 | P2-1, P1-8 | SEC-CR-2；I-RAG-PIPELINE, T-O-METRICS-RAG |
| P2-3 | A10 `skills/`（包+checksum 验证[失败保留当前版] + 权限审查+激活 + 受控适配器 + 回滚 + SkillInvocation 审计） | A10 | P1-3 | SEC-SKILL-2..7；U-SKILL-VALID, I-SKILL-ADAPTER, I-SKILL-FAIL-KEEP |
| P2-4 | A11 `mcp/` P2 机制（后端托管 MCP client + allowlist 引用[拒绝谓词 SOT 归 mcp-admin，P3] + McpToolCall 审计 + 项目级） | A11 | P1-8, P1-3 | SEC-MCP-2,3,4；I-MCP-WL |
| P2-5 | A8 追加 MCP 节点 + Skill 适配器节点（P2，R7 扫描放宽至"仅在适配器后"） | A8 | P2-3, P2-4 | SEC-SKILL-4；I-MCP-WL, I-SKILL-ADAPTER |
| P2-6 | B2 路由 `/projects/:id/knowledge`（KB 上下文 UI） | B2 | P2-2 | E-WEB-FULL 扩展 |

**Phase 2 出口门**：knowledge-rag.1–5 通过；检索后端可替换性测试通过；skills-store.1,3,4,5 通过（失败保留当前版 + 权限审查 + 受控适配器 + 回滚）；MCP 白名单 + McpToolCall 通过；MVP 套件无回归。

### Phase 3 — spec-first 门控（**spec 批准前不实现**）
| ID | 任务 | scope | blockedBy | 安全/测试绑定 |
|---|---|---|---|---|
| P3-0a | 归档 prior change `rebuild-ai-test-platform`（openspec archive） | openspec | P1 关闭（MVP 落地后） | — |
| P3-0b | 第二 change `fill-spec-gaps-phase3`（纯 ADDED 5 cap spec）编写+批准 | openspec | P3-0a | T-G-SPEC-A, T-G-SPEC-B（spec 质量门 A/B） |
| P3-0c | 第三 change `fill-spec-gaps-modifieds`（5 项 MODIFIED/ADDED：web-ui R4/R5/R6、backend-ai-orchestration R3 引用、ai-test-generation R1 linkback、clean-room-R5 非目标 lift、test-asset-management 仅索引） | openspec | P3-0a, P3-0b | T-G-SPEC-C, T-G-SPEC-D（门 C/D） |
| P3-1 | E1 `test-suite/`（自包含 SuiteRun，无 test-asset-management FK 变动 e6） | E1 | P3-0c | SEC-CR-3；U-SUITE-SELFCONTAINED, E-PHASE3-CAP |
| P3-2 | E2 `api-automation/` 完整套件（显式 Phase-3 门控；secrets 信封引用 e9；占位路由已 M） | E2 | P3-0c | SEC-CRED-6, SEC-CR-3；U-APIAUTO-SECRETREF, E-PHASE3-CAP |
| P3-3 | E3 `requirements/`（draft→reviewed→approved，owner 批准 a2，回链生成用例） | E3 | P3-0c, P1-8 | U-REQ-WF, E-PHASE3-CAP |
| P3-4 | E4 `llm-chat/`（会话级，无 tool-calling/多步/人审 e8；后端拥有 LLM a7） | E4 | P3-0c, P1-4 | U-CHAT-SCOPE, E-PHASE3-CAP |
| P3-5 | E5 `mcp-admin/`（项目级治理 UI，拥有拒绝谓词 SOT，a5/e7） | E5 | P3-0c, P2-4 | SEC-MCP-6；U-MCPADMIN-PROJ, I-MCPADMIN-SOT, E-PHASE3-CAP |
| P3-6 | B2 路由 `/test-suites` `/requirements` `/chat` `/mcp-admin`（完整，非占位） | B2 | P3-1..P3-5 | E-PHASE3-CAP |

**Phase 3 出口门**：spec 门 A–D 通过（实现前）；每 cap 验收 e2e 通过；F3（第 2 轮决策存在）重通过；MUST-5 R2 redelivery 语义在 suite 执行复用 worker 协议时保持。

---

## 5. 依赖图（ASCII）

```
Phase 0 (Bootstrap)
  P0-1 monorepo ── P0-2 config ── P0-3 shared-types ─┬── P0-6 streaming ──┐
                                                      │                    │
                       P0-4 api/prisma ── P0-5 crypto ┘                    │
                              │                                            │
                       P0-7 CI ── P0-8 F-gates                             │
                                                                           │
Phase 1 (MVP) ─────────────────────────────────────────────────────────────┘
  P1-1 auth(+R3 token) ──┬── P1-2 projects ── P1-5 test-assets ── P1-6 executions ──┐
                         │                                                            │
                         ├── P1-3 audit                                               │
                         │                                                            │
                         └── P1-4 model-providers(R5) ──────────────────── P1-8 ai-orchestration(R1/R7/MUST-2)
                                                                      │                │
                                                                      │                ├── (R4 AiRunInput)
                                                                      │                │
  P1-7 worker-gateway(R2/R3) ◄── P1-1, P1-6 ◄─────────────────────────┘                │
        │                                                                              │
        ├── (SEC-XC redelivery, token)                                                 │
        │                                                                              │
  P1-9 packages/ui ── P1-10 apps/web(+占位路由 MUST-3) ── P1-11 desktop/main ── P1-12 preload ── P1-13 renderer
                              │                                                          │
                              └── (E-WEB-FULL, E-WEBAPI-PLACEHOLDER)                     │
                                                                                         │
  P1-14 desktop/worker(Playwright, SEC-PW) ◄── P1-7, P1-12 ──► P1-15 tracer-bullet (E2E 全打通)
                                                                                         │
Phase 2 (KB/Skills/MCP) ◄── P1 关闭 ────────────────────────────────────────────────────┘
  P2-1 retrieval(R9) ── P2-2 knowledge ──► (注入) P1-8
  P2-3 skills ──► (适配器) P2-5 ──► P1-8
  P2-4 mcp 机制 ──► (MCP 节点) P2-5
  P2-6 web /knowledge 路由 ◄── P2-2

Phase 3 (spec-first 门控) ◄── P2 关闭 + openspec 归档
  P3-0a archive prior ── P3-0b 2nd change(纯ADDED) ── P3-0c 3rd change(MODIFIEDs, clean-room-R5 lift)
        │
        ├── P3-1 test-suite ──┐
        ├── P3-2 api-automation┤
        ├── P3-3 requirements ─┼── P3-6 web 完整路由
        ├── P3-4 llm-chat ─────┤
        └── P3-5 mcp-admin ────┘ (P3-5 依赖 P2-4 mcp 机制)
```

---

## 6. 关键执行原则

1. **测试先行（MUST-7）**：每个 impl 任务先落对应 T-* 测试（红→绿）。CI 在 PR 上跑 U/I/E/G + F-gates。
2. **后端拥有编排**：任何 `apps/*` 或 `packages/ui` 不得 import LangChain/LangGraph/MCP/Prisma；由 R7 import-scan CI 强制（MVP 图无 MCP/Skill）。
3. **§11 兜底（F7 承重）**：任何拟实施项既无法追溯 §2/§3/§4 in-scope、又未在 §11 列出 → 一律禁止，须经新 change lift。
4. **clean-room**：`WHartTest*` 排除出 workspace；F8 防御 stale `.omc/plans/` 漂移；secret-scan + clean-room scan CI 持续运行。
5. **Phase 3 spec 门控**：P3-0a/b/c 是 P3-1..P3-6 的硬前置；spec 未批准前不得写任何 cap 实现代码（§11 d1/e2）。
6. **tracer-bullet 优先**：P1-15 端到端打通是 MVP 价值验证的最早信号，应在 P1-1..P1-14 就绪后立即跑通。
7. **不变量全程持有**：simple-roles（a2）、信封加密（Architect-R5）、后端编排（a7）、MCP 项目级（a5/e7）、llm-chat 会话级（e8）、自包含 SuiteRun（e6）—— 任何阶段不得违反。

---

## 7. ADR（任务拆解）

- **Decision**：按 architect 模块边界（A1–A15/B1–B3/C1–C4/D1–D2/E1–E5）+ security-reviewer SEC-* + test-engineer T-*/F-* 三方输出，合成 4 阶段（P0 Bootstrap → P1 MVP → P2 KB/Skills/MCP → P3 spec-gated）有序任务列表，每任务带 file scope + blockedBy + 安全/测试绑定。测试先行（MUST-7），后端拥有编排，§11 兜底（F7），clean-room 全程（F8 + scan）。
- **Drivers**：模块边界清晰、安全/测试与 impl 同任务绑定（避免脱节）、spec-first 门控（Phase 3）、tracer-bullet 早期价值验证。
- **Alternatives considered**：按功能域而非模块切分（否决——会跨 file scope 冲突）；安全/测试后置（否决——违反 MUST-7 且延后风险暴露）；Phase 3 与 MVP 并行（否决——违反 spec-first 门控 §11 d1）。
- **Why chosen**：模块边界即任务 file scope（无冲突）；安全+测试织入每任务（MUST-7 + 安全左移）；硬依赖顺序保证 spec 门控与基础设施先行；tracer-bullet 尽早打通价值路径。
- **Consequences**：任务粒度适中（~15 MVP + ~6 P2 + ~9 P3），可并行度高（P1 内 auth/projects/audit/test-assets 可并行，web/desktop 在 API 就绪后并行）；代价是 P0/P1 前期串行段较长，但被 tracer-bullet 与测试先行补偿。Phase 3 严格受 openspec 归档+2nd/3rd change 时序约束。
- **Follow-ups**：批准后经 `/team`（并行）或 `/ralph`（顺序）执行；执行前需先决策 design.md 开放问题（部署目标/provider 集/合规/语言/Electron OS 目标）以定 ModelProvider.kind 广度、i18n、打包。

---

## 8. 执行边界（本轮）

本文件为 **PENDING APPROVAL** 任务拆解产物。**未写代码、未创建源码/openspec 文件、未提交/推送/建 PR。** 批准后执行内容为按上述顺序创建 monorepo + 实现 MVP→P2→P3（Phase 3 须 spec 先批准）。
