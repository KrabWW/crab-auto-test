# WHartTest ↔ crab-auto-test Clean-Room 产品差距审计

> 本报告为**只读审计 + 差距分析**，不写任何业务代码。
> 主控：OMC（team 编排）。工程门禁：ECC。规划/验证/review 方法：Superpowers。
> 生成日期：2026-07-03。基线 commit：`39e759d`（crab-auto-test main）。

---

## 0. 审计范围与方法

| 项 | 路径 | 角色 |
|---|---|---|
| crab-auto-test（被审计方） | `D:\code\normal\RJ-CLI\crab-auto-test` | clean-room 重建产品 |
| WHartTest（参考方） | `...\crab-auto-test\WHartTest` | 产品研究参考（只读） |
| WHartTest-upstream | `...\crab-auto-test\WHartTest-upstream` | WHartTest 的上游副本，未单独审计（与 WHartTest 内容重复） |

**方法**：3 个只读 executor worker 分别审计 WHartTest 后端/MCP/Actuator、WHartTest 前端/Skills/微信、crab-auto-test 现状+OpenSpec，产出三份研究文档（`.omc/research/`），由主控综合本报告。所有 WHartTest 能力描述均为**改写**，仅引用短标识符（路由路径、模型名、工具名）作为事实参考，未复制任何源码/素材/文案/样式/提示词/配置。Docker 本地实例因 daemon 未运行未能启动（见 §7 证据），回退为静态分析。

**输入文档**：
- `.omc/research/wharttest-backend.md`（后端/MCP/Actuator 能力矩阵 + 部署拓扑）
- `.omc/research/wharttest-frontend.md`（前端路由/页面/Skills/微信宿主）
- `.omc/research/crab-current-state.md`（crab 现状 + OpenSpec 完整性）

---

## 1. WHartTest 功能矩阵

WHartTest 是 Django 5.2 + DRF + Vue 3 的 AI 驱动测试平台，monorepo 含 6 个子项目（Django 后端、Vue 前端、UI 执行器、MCP 工具服务、Skill 库、在线文档编辑器集成）。核心思路：需求 → LLM+工具 Agent → 评审/拆分 → 生成功能/API/UI 用例 → 可选执行 → 采集制品。

| # | 能力域 | WHartTest 提供的能力（改写） |
|---|---|---|
| W1 | 认证与访问控制 | JWT（access 12h / refresh 7d，刷新轮换）+ 项目级 API Key 双认证；用户/组/权限/ContentType 的完整 RBAC；默认 seeded key 生产需轮换 |
| W2 | 项目与多租户 | Project + 成员 + 项目凭证；`IsProjectMember` 权限门禁；几乎所有资源嵌套在 `projects/<id>/...` 下 |
| W3 | 功能用例管理 | 模块树、列表+思维导图双视图、套件、执行记录、截图、Excel 导入导出（列映射模板）、用例模板；AI 生成/编辑/优化/修复/运行 |
| W4 | 接口自动化 | 基于 HttpRunner 的完整资产层：接口定义（含 SQL 类型）、环境/变量/全局 Header、模块树、自定义函数、数据库配置、标签/分组、外部同步、测试任务、报告；AI 生成/编辑/修复接口用例 |
| W5 | UI 自动化 | 页面对象模型（pages→elements→page-steps→cases）、公共数据、环境配置、执行机注册表；WebSocket 驱动的 Playwright 执行器、分布式部署、Trace+截图采集、批量执行 |
| W6 | 知识库与 RAG | KB CRUD、文档上传/解析（pdf/docx/xlsx/pptx）/分块/向量化（Qdrant）、全局 embedding+reranker 配置、LangGraph retrieve→generate RAG、会话式 RAG、知识即工具 |
| W7 | 需求管理与智能评审 | 上传/解析、在线 DOCX 编辑器、token 感知的模块拆分、专项分析评审、产出带评分的报告+问题项、可重启 |
| W8 | LLM 对话与 Agent 编排 | LangGraph 对话（工具审批、token 统计、RAG、checkpointer 历史持久化）+ Agent Loop（LangChain v1 create_agent + 中间件：重试/摘要化/HITL、Blackboard 模式、SSE 步骤事件、停止/恢复、友好错误映射） |
| W9 | MCP 工具 | 远程 MCP 配置注册、ping 连通性、持久会话（按 user+project 缓存）、调用任意工具端点、官方 Playwright MCP 作为远程服务器 |
| W10 | Skills 技能库 | zip/git/url 安装、技能商店 manifest+下载、bundled skill 播种、作为 Agent 工具暴露、每 skill 持久浏览器、制品采集；高系统权限（仅内网） |
| W11 | 任务中心与调度 | 定时/周期任务（cron/hourly/daily/weekly/once）、按模块路由分发、enable/disable/run-now、执行历史+日志 |
| W12 | 提示词与模板 | 用户提示词库、默认模板、Excel 导入导出列映射 |
| W13 | 微信集成 | 扫码登录、Bot 账号、会话、消息轮询、独立 sidecar 容器桥接官方微信插件 |
| W14 | 操作日志 | 审计日志记录 + 保留期清理 |
| W15 | 独立 MCP 工具服务 | 独立 FastMCP 容器（项目/模块/用例 CRUD、截图、drawio 图、MS 平台桥接） |
| W16 | 部署拓扑 | Postgres + Redis + Qdrant +（可选 Xinference）+ backend（uvicorn+celery worker+beat）+ frontend（nginx SPA）+ MCP + Playwright MCP + 微信宿主，8 服务，统一 `run_compose.sh` |

> 完整细节见 `.omc/research/wharttest-backend.md` §3–5 与 `wharttest-frontend.md` §2–5。

---

## 2. crab-auto-test 已有能力

crab-auto-test 是 TypeScript-first 的 clean-room 重建：Nuxt3/Vue3/Tailwind/shadcn-vue 前端 + Electron 桌面 + NestJS 后端 + Prisma/PostgreSQL + LangChain.js/LangGraph.js/MCP TS SDK + Playwright worker。pnpm monorepo + turbo。已落地 MVP + Phase 2 代码（main 上 2 个 commit）。

| # | 能力域 | crab 现状（基于代码 + OpenSpec） | OpenSpec cap |
|---|---|---|---|
| C1 | 平台基础 | JWT 认证、项目+成员（**仅 owner/member 简单角色**）、model-provider 配置、审计、worker-token、envelope 加密（per-credential DEK + master-key 轮换） | `platform-foundation`（4 reqs）✅ |
| C2 | Web UI | Nuxt3 SPA、Tailwind、shadcn-vue（仅 button/card/input）、路由：login/projects/test-cases/ai-generation/executions/settings/knowledge、**`/api-automation` 占位路由** | `web-ui`（3 reqs）✅ |
| C3 | 后端 AI 编排 | NestJS **状态机**（非 durable LangGraph，R1 明确无 checkpointer）、SSE 流、snapshot、P2 MCP 节点 + Skill 适配器节点 | `backend-ai-orchestration`（4 reqs）✅ |
| C4 | AI 用例生成 | 生成→RAG 上下文→草稿→校验（有界重试）→MCP/Skill 增强→`awaiting-approval` 软停止→accept 持久化（runId+title 幂等） | `ai-test-generation`（3 reqs）✅ |
| C5 | 测试资产管理 | 模块树、用例、有序步骤、执行记录、制品 | `test-asset-management`（3 reqs）✅ |
| C6 | 知识库/RAG（P2） | KB CRUD、摄取+分块、embed+可检索（pgvector，RetrievalBackend 接口可换）、带来源归因的 RAG、诊断端点 | `knowledge-rag`（5 reqs）✅ |
| C7 | Skills 商店（P2） | 打包元数据、浏览/安装、权限审查、受控适配器、更新+回滚、checksum 校验、CI `skill-adapter-scan` 禁 eval/vm | `skills-store`（5 reqs）✅ |
| C8 | 自动化 Worker | Electron 本地 Playwright worker、执行限制、制品采集、轮询认领传输（REST，非 WS，MVP 简化保留 R2 重投递语义） | `automation-workers`（4 reqs）✅ |
| C9 | 桌面应用 | Electron、contextIsolation/sandbox、typed crabBridge 白名单、safeStorage、isolation-check 自检 | `desktop-app`（5 reqs）✅ |
| C10 | clean-room 治理 | CI `clean-room-scan.mjs` 门禁、WHartTest* 排除出 pnpm workspace | `clean-room-rebuild`（4 reqs）✅ |
| C11 | MCP 机制（P2） | 项目级 allowlist、McpToolCall 审计、invoke；运行时由 McpService 直接强制 | （`backend-ai-orchestration` 内）✅ 机制 |
| C12 | 测试 | 6 后端单元（envelope/redact/redelivery/mcp/retrieval/skills 纯逻辑）+ 5 web e2e + desktop isolation-check | — |

> 完整细节见 `.omc/research/crab-current-state.md` §3–4。

---

## 3. 缺口分析

将 WHartTest 16 个能力域对照 crab 现状，缺口分三类：

### 3.1 P0 — Phase 3 spec-gated 缺口（必须先补 OpenSpec）

这 5 个能力 crab **完全没有 committed spec**，仅在 `PLAN-SPECFILL.md` 有散文草稿，且 `specs/api-automation/` 是**空目录**（已建占位但无 spec.md）。按 plan 自身的 V-c 决策与 §11，**实现不得先于 spec**。

| 缺口 | WHartTest 对应 | crab 现状 | 门禁状态 |
|---|---|---|---|
| **测试套件**（test-suite） | W3 套件+批量执行 | 无套件实体，仅有单用例执行 | Phase-3 NEW cap，无 spec |
| **接口自动化全套**（api-automation） | W4 完整 HttpRunner 套件 | 仅占位路由（MUST-3） | Phase-3 NEW cap，**空 spec 目录** |
| **需求管理**（requirement-management） | W7 受管需求实体+评审工作流 | 需求只是 AI-gen 的输入字符串，非受管实体 | Phase-3 NEW cap，无 spec |
| **LLM 交互对话**（llm-chat） | W8 LangGraph 对话 UI | 无对话 UI（仅 AI 生成流程） | Phase-3 NEW cap，无 spec |
| **MCP 治理 UI**（mcp-admin） | W9 远程配置+ping+治理 | 仅有运行时 allowlist 机制，无治理 UI | Phase-3 NEW cap，无 spec |

### 3.2 P1 — 真实功能缺口（尚未 spec，非 Phase-3 显式门禁但确实缺失）

| 缺口 | WHartTest 对应 | crab 现状 | 备注 |
|---|---|---|---|
| **任务中心与定时调度** | W11 cron/周期/once 调度 | 仅有执行记录，无定时任务 | 真实功能缺口，未在任何 cap 中 spec |
| **UI 自动化资产管理 UI**（pages/elements/page-steps） | W5 页面对象资产 | worker 能跑 Playwright，但无 pages/elements/page-steps 资产管理 UI | 执行能力有，资产建模缺 |
| **提示词库 + Excel 导入导出模板** | W12 | 无提示词库 UI，无 Excel 模板 | 增强 |

### 3.3 P2 — 既有 cap 的薄度增强（已实现但比 WHartTest 薄）

| 增强项 | WHartTest | crab | 所属 cap |
|---|---|---|---|
| 思维导图视图 | W3 list+mindmap | 仅列表 | web-ui / test-asset-management |
| AI 编辑/优化/修复/运行 | W3 全自动 | 仅生成+审批 | ai-test-generation |
| 会话式 RAG + reranker | W6 完整 | RAG 有，reranker 为 stub | knowledge-rag |
| Agent Loop 复杂度（Blackboard/摘要化/停止恢复） | W8 完整 | 状态机，无 durable | backend-ai-orchestration（R1 明确取舍） |
| API Key 管理 UI | W1 /api-keys 页 | 仅 worker-token | platform-foundation |
| shadcn-vue 组件完整度 | — | 仅 button/card/input（缺 Table/Dialog） | web-ui |

### 3.4 P3 — 永久非目标（**不闭合，记录为架构分歧**）

crab 的 `design.md §11` 明确将这些列为永久非目标，**不应追求对等**：

| WHartTest 能力 | crab 立场 | 原因 |
|---|---|---|
| W13 企业微信集成 | 永久非目标 | 产品方向分歧 |
| W1 复杂 RBAC/权限矩阵/自定义角色 | 永久非目标（仅 owner/member） | simple-roles 不变量 |
| W7 在线 DOCX 编辑器 | 永久非目标 | 全文档编辑器非目标 |
| W5 分布式 UI 执行/远程 Playwright worker 池 | 永久非目标 | 仅本地 Electron worker |
| W9 平台全局 MCP 工具 + 全局 admin 角色 | 永久非目标 | MCP 仅项目级 |
| W15 独立 FastMCP 服务 / MS 平台桥接 | 架构分歧 | crab MCP 内嵌 NestJS，无独立服务 |

> 关键认知：**P3 不是"缺口"，是 clean-room 的设计取舍**。把它们当成 gap 去填会违反不变量。

---

## 4. 优先级

```
P0（spec-gated，阻塞 Phase 3 对等）→ 必须先补 OpenSpec
  1. requirement-management   （受管需求是 AI-gen 的上游输入，杠杆最高）
  2. test-suite               （套件+批量执行，复用现有执行记录模式）
  3. api-automation           （空 spec 目录已占位，最易误抄 HttpRunner，需独立设计）
  4. llm-chat                 （交互对话，会话级 bounded context）
  5. mcp-admin                （治理 UI，对标 skills-store 分离）

P1（真实功能缺口，需补 spec 但未显式 Phase-3 门禁）
  6. 任务中心与定时调度        （真实缺失，建议作为新 cap 或并入 test-suite）
  7. UI 自动化资产管理 UI      （pages/elements/page-steps 资产建模）
  8. 提示词库 + Excel 模板     （增强，可并入 web-ui/test-asset-management MODIFIED）

P2（既有 cap 增强，可随 Phase 3 MODIFIED change 顺带处理）
  9. 思维导图视图 / AI 编辑优化修复 / 会话式 RAG+reranker / Agent Loop 复杂度
  10. API Key 管理 UI / shadcn-vue 组件补全（Table/Dialog）

P3（永久非目标，不闭合）
  - 企业微信 / 复杂 RBAC / DOCX 编辑器 / 分布式执行 / 全局 MCP / 独立 FastMCP 服务
```

**建议执行顺序**：先执行 `待执行的提示词文件.md` 中已排队的 spec-writing autopilot（补 Phase-3 的 5 个 cap spec，纯 spec 不写业务代码），再按 P0→P1→P2 依次实现。P3 永远不动。

---

## 5. 是否需要先补 OpenSpec

**分两种对等目标：**

### MVP + Phase 2 对等（域 C1–C12）→ **不需要**
- 10 个 committed capability spec 全部完整且通过 `openspec validate`（40 个 ADDED 需求，10 cap）。
- 代码已实现这些 spec。可基于现有 spec 直接做对等增强（P2）。

### Phase 3 对等（test-suite / api-automation / requirement-management / llm-chat / mcp-admin）→ **必须先补**
**门禁序列**（plan V-c + §11 d1/e2）：
1. **archive** 当前 `rebuild-ai-test-platform` change（`openspec archive` → 填充 `openspec/specs/`，当前为空）。
2. 写第二个 change `fill-spec-gaps-phase3`（纯 ADDED，5 个新 cap spec）→ validate + approve。
3. 写第三个 change `fill-spec-gaps-modifieds`（5 个 MODIFIED/ADDED delta：web-ui R4/R5/R6、backend-ai-orchestration R3 引用、ai-test-generation R1 回链、clean-room-rebuild R5 非目标、test-asset-management 仅索引）→ post-archive。

**证据**：
- `specs/api-automation/` 与 `specs/knowledge-context/` 为**空目录**（有目录无 spec.md）——占位但未 spec。
- `PLAN-SPECFILL.md` 含 5 个 Phase-3 cap 的散文草稿（G1–G5）+ 对既有 cap 的修改枚举，但**未 committed 为 spec.md**。
- `待执行的提示词文件.md` 已排队执行步骤 2+3 的 autopilot 提示词（纯 spec，不写业务代码），**尚未运行**。
- `openspec/specs/`（归档目录）为空 → 当前 change 未归档 → MODIFIED delta 在结构上非法。

**结论**：Phase 3 实现前，OpenSpec 补全是**硬门禁**，不可绕过。`knowledge-context/` 空目录建议清理（real cap 是 `knowledge-rag`，已有 spec）。

---

## 6. Clean-Room 风险说明

| 风险 | 说明 | 缓解 |
|---|---|---|
| **WHartTest 源码在 crab 仓库内** | `WHartTest/` + `WHartTest-upstream/` 直接 check 在 crab-auto-test 仓库，审计/实现时易误抄 | `infra/ci/clean-room-scan.mjs` CI 门禁；`WHartTest*` 已排除出 pnpm workspace；本审计仅只读 |
| **api-automation DSL 误抄** | WHartTest 用 HttpRunner 的 Config/Step/RunRequest/RunSqlRequest + 断言/变量提取 DSL。crab 补 api-automation 时最易镜像其 DSL | 必须独立设计请求/断言/提取模型；clean-room review 需记录独立实现路径（provenance note） |
| **UI 自动化 step-config schema 误抄** | WHartTest Actuator 的 StepConfig（locator_type/operation_type/iframe/multi-level）是具体表达式 | crab 应基于 Playwright 原生 API 独立建模 |
| **提示词误抄** | WHartTest 的 default prompts、requirement prompt、system prompt 是受保护表达 | crab 提示词库须独立撰写；不引用 WHartTest 提示词文本 |
| **路由路径/组件布局误抄** | WHartTest 前端路由表与 Arco Design 布局是具体表达 | crab 用 shadcn-vue（已分歧，好）；路由路径可参考但布局须独立 |
| **Skills SKILL.md 格式误抄** | WHartTest skill 的 frontmatter + allowed-tools Bash glob 模式 | crab skill 包装格式须独立定义（crab 已有 `skill-adapter-scan` 禁 eval/vm，安全侧更强） |
| **`.github/copilot-instructions.md` 泄漏** | 该文件是 **WHartTest 侧**的 Copilot 指令（Django/uv/Arco/PEP8），通过 hook 注入 crab 上下文 | **不得**将 WHartTest 约定（Django/DRF/Arco）套用到 crab（Nuxt/NestJS/shadcn）；crab 遵循自身 `AGENTS.md` |
| **MCP 持久会话/全局会话模式** | WHartTest `GlobalMCPSessionManager` 跨对话共享浏览器；crab MCP 仅项目级 allowlist | crab 须保持项目级限定，不引入全局会话（与 P3 非目标一致） |
| **双 AI 运行时诱惑** | WHartTest 有 LangGraph chat + Agent Loop 双运行时；crab R1 明确选状态机 | 不因对等而引入 durable LangGraph checkpointer / `interrupt()`（F8 drift-scan 门禁） |
| **审计读取边界** | 本轮读取 WHartTest 源码做能力描述是允许的（研究用途），但不得转化为代码表达式复制 | 所有描述已改写；仅短标识符作事实引用 |

---

## 7. 只读验证证据

| 验证项 | 命令 | 结果 |
|---|---|---|
| crab git 状态 | `git status --short --branch` | `## main...origin/main`（clean） |
| Docker 可用性 | `docker --version` / `docker compose version` | Docker 29.4.0 / Compose v5.1.1（CLI 在） |
| Docker daemon 运行 | `docker ps` | **失败**：`failed to connect to docker_engine`（daemon 未启动）→ WHartTest 本地实例**未启动**，回退静态分析 |
| WHartTest compose 校验（远程镜像） | `docker compose -f docker-compose.yml config --services` | 8 服务：postgres/redis/backend/weixin-plugin-host/frontend/mcp/playwright-mcp/qdrant ✅ |
| WHartTest compose 校验（本地构建） | `docker compose -f docker-compose.local.yml config --services` | 同 8 服务 ✅ |
| OpenSpec change 校验 | `openspec validate rebuild-ai-test-platform` | **valid** ✅ |
| OpenSpec delta 统计 | `openspec show` | 40 ADDED deltas，10 cap |
| committed cap spec 数 | `find specs -name spec.md` | 10（ai-test-generation/automation-workers/backend-ai-orchestration/clean-room-rebuild/desktop-app/knowledge-rag/platform-foundation/skills-store/test-asset-management/web-ui） |
| 每 cap 需求数 | `grep -c "^### Requirement"` | ai-test-gen 3 / automation-workers 4 / backend-ai-orch 4 / clean-room 4 / desktop 5 / knowledge-rag 5 / platform-foundation 4 / skills-store 5 / test-asset 3 / web-ui 3 = **40** ✅ |
| 空 spec 目录 | `find specs -type d`（无 spec.md） | `api-automation/`、`knowledge-context/`（占位/陈旧，未 spec） |
| 归档目录 | `ls openspec/specs` | 空（当前 change 未 archive）✅ 与门禁序列一致 |
| Phase-3 prose 草稿 | `grep PLAN-SPECFILL.md` | test-suite / api-automation / requirement-management / llm-chat / mcp-admin 5 个 NEW cap 散文草稿存在，未 committed |
| crab 后端模块 | `ls services/api/src/modules` | 12 模块已实现（见 crab-current-state.md §3） |
| crab 前端路由 | `ls apps/web/pages` | auth/projects/index（含 api-automation 占位）✅ |
| 三份研究文档 | `.omc/research/*.md` | wharttest-backend.md / wharttest-frontend.md / crab-current-state.md 均已产出 ✅ |

**未验证项（诚实声明）**：
- WHartTest 本地实例未启动（Docker daemon 未运行）→ 主要页面未实际观察，能力矩阵来自静态源码审计。
- crab 的 DB 集成测试、端到端 desktop worker 运行未执行（超出本轮只读审计范围；crab-current-state.md §4 已记录测试覆盖缺口）。

---

## 8. 结论

1. **crab 已实现 MVP + Phase 2 对等**（10 cap / 40 reqs 全 valid 且代码落地），可基于现有 spec 做 P2 增强，无需先补 OpenSpec。
2. **Phase 3 对等的 5 个 cap（test-suite/api-automation/requirement-management/llm-chat/mcp-admin）是硬门禁**——必须先 archive 当前 change + 写 2 个新 change 补 spec，`待执行的提示词文件.md` 已排队该 autopilot。
3. **P1 真实缺口**（任务中心调度、UI 自动化资产 UI、提示词库+Excel 模板）需补 spec 但未显式 Phase-3 门禁。
4. **P3 永久非目标**（企业微信/复杂 RBAC/DOCX 编辑器/分布式执行/全局 MCP/独立 FastMCP）是 clean-room 设计取舍，**不闭合**。
5. **最大 clean-room 风险**：WHartTest 源码在 crab 仓库内 + api-automation 空 spec 目录诱惑镜像 HttpRunner DSL。缓解靠 CI 门禁 + 独立设计 + provenance 记录。
6. **本轮严格只读**：未修改任何 WHartTest 文件，未写业务代码，仅产出本报告 + 3 份研究文档。

---

*审计产物：`docs/wharttest-parity-audit.md`（本文件）、`.omc/research/wharttest-backend.md`、`.omc/research/wharttest-frontend.md`、`.omc/research/crab-current-state.md`、`.omc/handoffs/team-plan.md`*
