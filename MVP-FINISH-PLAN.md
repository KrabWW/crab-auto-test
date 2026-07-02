# MVP 收尾计划 — 从骨架到端到端可跑

> 状态：**待批准**。批准后用文末 autopilot 提示词执行。
> 基线：`0526b70` MVP 骨架已合并 main（monorepo + 8 后端模块 + web + desktop + 3 CI 门，typecheck/build/test/门全绿）。
> 范围：**仅 MVP 收尾**，把"骨架+边界+状态机"补到"端到端 tracer-bullet 可跑"。不碰 Phase 2（KB/RAG/Skills/MCP 机制）、不碰 Phase 3（5 cap，spec-first 门控）。
> 硬约束不变：OpenSpec 唯一需求源；不复制 WHartTest；每步验证；不实现企业微信；不实现复杂 RBAC；不越 OpenSpec 范围。

---

## 0. 现状（已具备 vs 还差）

### 已具备（骨架层）
- pnpm monorepo + shared-types(types-only) + config
- 8 个 NestJS 模块的**边界 + 状态机 + Prisma 数据模型**
- R5 信封加密（已测）、R3 worker token、R2 redelivery 状态机、R8 snapshot
- ai-orchestration 边界（R1 Prisma 状态、R7 无 MCP/Skill、MUST-2 占位 tool/retries）
- web SPA 路由 + `/api-automation` 占位（MUST-3）
- desktop main/preload/renderer/worker **协议草案** + redaction/limits 工具
- 3 个二值 CI 门：R7 import-scan / F8 drift-scan / clean-room-scan

### 还差（MVP 端到端可跑的缺口）
| # | 缺口 | 现状 | 目标 |
|---|---|---|---|
| G1 | **数据库未初始化** | schema 已写，未 `migrate dev`，无 .env，无种子 admin | 本地 Postgres 起 + migrate + seed admin + .env |
| G2 | **AI 编排未接真 LLM** | `draftFromRequirement` 是确定性占位 | 接 LangChain.js + OpenAI-compatible provider，真实生成结构化草稿 |
| G3 | **流式未实时推送** | 只有 `GET /snapshot`（R8 快照） | 实现 `GET /ai/runs/:id/stream` SSE 实时推 stage/partial |
| G4 | **Playwright worker 未真跑** | claim→ack→redact→artifacts(placeholder)→result | 真启动浏览器、执行步骤、截图、trace、redact、上报 |
| G5 | **worker 会话流未长连** | REST 轮询 claim | R2 长连 WS/SSE session stream（或显式声明 MVP 用轮询并保留 redelivery 语义） |
| G6 | **shadcn-vue 未装** | 仅 Tailwind + 一方原生组件 | 装 shadcn-nuxt + 初始组件（Button/Input/Table/Card/Dialog） |
| G7 | **tracer-bullet e2e 未写** | 仅 2 个 unit（envelope/redact） | e2e：login→project→test-case→ai-gen→approve→worker run→report 含产物 |
| G8 | **Electron 未启动验证** | esbuild bundle 仅 | `electron .` 实际起窗口、加载 web、桥可用 |
| G9 | **secret-scan CI 未接** | 3 门中无 secret-scan | infra/ci/secret-scan.mjs 规则 + CI workflow |
| G10 | **CI workflow 文件未建** | 无 `.github/workflows/` | CI 跑 typecheck/build/test/4 门 |

---

## 1. 任务拆解（有序，含依赖与验收）

### 阶段 A — 可运行基座（G1, G6, G9, G10）
- **A1 数据库初始化**（G1）：docker-compose.yml 起 Postgres；`prisma migrate dev --name init`；seed 脚本造首个 admin（`ensureSeedAdmin`）；`.env` 模板填充指引。验收：`pnpm --filter @crab/api db:migrate` 绿；seed 后 `POST /auth/login` 返回 session。
- **A2 shadcn-vue 安装**（G6）：装 `shadcn-nuxt` + `class-variance-authority` 等；init 几个组件；把 login/projects/test-cases 页面换成 shadcn 组件。验收：`pnpm --filter @crab/web build` 绿；页面用 shadcn 组件。
- **A3 secret-scan + CI workflow**（G9, G10）：`infra/ci/secret-scan.mjs`（正则扫源码/fixture）；`.github/workflows/ci.yml` 跑 typecheck/build/test + R7/F8/clean-room/secret-scan 4 门。验收：`node infra/ci/secret-scan.mjs` PASS；CI yaml 合法。

### 阶段 B — AI 编排接真 LLM（G2, G3）
- **B1 LangChain 接线**（G2）：`ai-orchestration` 引入 `@langchain/openai` + `zod` 结构化输出；`draft` 节点用配置的 provider 真实调用，替换 `draftFromRequirement` 占位；保留 R7（MVP 图无 MCP/Skill 节点，CI 扫描仍绿——只引 langchain/openai，不引 MCP/Skill）。验收：`POST /ai/test-generation` 返回真实草稿；R7 门仍 PASS。
- **B2 SSE 实时流**（G3）：实现 `GET /ai/runs/:id/stream`（SSE），推 `WorkflowStageEvent` 映射的 envelope；保留 R8 snapshot 端点用于重连。验收：curl SSE 看到 stage/partial 事件流；断开重连 GET snapshot 恢复权威态。

### 阶段 C — Playwright worker 真跑（G4, G5）
- **C1 Playwright 执行引擎**（G4）：worker 进程真启动 chromium（隔离临时 profile SEC-PW-5）；按 job.steps 执行；超时/资源限额（SEC-PW-2）；网络策略（SEC-PW-3）；截图+trace 捕获；redact 后上报。验收：一个测试用例经 worker 跑完，execution 记录含 screenshot+trace 产物元数据。
- **C2 会话流决策**（G5）：**MVP 显式采用轮询 claim + REST 上报**（当前已实现），并在代码注释 + 文档声明 R2 redelivery 语义仍成立（dispatched 未 ack 的作业重连重投）。**不引入 WS/SSE 长连**（§11 b′2 BullMQ 不作传输已守；轮询是会话流的 MVP 简化，不违反 OpenSpec）。验收：集成测试断连重投恰一次（MUST-5）。

### 阶段 D — 端到端验证（G7, G8）
- **D1 tracer-bullet e2e**（G7）：Playwright test 跑 web：login→建 project→建 test-case→ai-generation 生成→approve→触发 execution→worker claim 执行→execution 报告含产物。验收：e2e 绿。
- **D2 Electron 启动验证**（G8）：`pnpm --filter @crab/desktop dev` 起 Electron 窗口加载 web（dev URL 模式）；断言 renderer 无 Node/fs（SEC-EL-6）；桥方法可用。验收：Electron 窗口起、登录走通、worker start/stop。

### 阶段 E — MVP 收口门
- **E1 MVP 门**：`pnpm -r typecheck && pnpm -r build && pnpm --filter @crab/api test` 全绿；e2e 绿；4 CI 门绿；clean-room scan 绿。提交并合并。

---

## 2. 依赖顺序
```
A1(DB) ──┐
A2(UI) ──┤
A3(CI) ──┤
         ├──> B1(LLM) ──> B2(SSE) ──┐
         │                          ├──> C1(PW) ──> C2(redelivery test) ──┐
         │                          │                                       ├──> D1(e2e) ──> D2(Electron) ──> E1(门)
         └──────────────────────────┘                                       │
```
A1/A2/A3 可并行；B 依赖 A1（DB）；C1 依赖 B（要有用例+执行记录）；D 依赖 B+C。

---

## 3. 不做（硬边界）
- **Phase 2**：KB/RAG、Skills 商店、MCP 后端机制节点（图里不接 MCP/Skill，R7）。
- **Phase 3**：test-suite、api-automation 完整套件、requirement-management、llm-chat、mcp-admin（spec-first 门控，未补 spec 不实现）。
- **永久非目标**：企业微信、复杂 RBAC、全 DOCX 编辑器、分布式/远程 worker、平台全局 MCP 工具、复制 WHartTest、客户端 LLM/MCP。
- **MVP 机制不引入**：LangGraph durable checkpointer/interrupt（R1）、BullMQ 作 worker 传输（R2）、服务端事件重放缓冲（R8）、外部密钥管理器（R5）。

---

## 4. 风险
- **Postgres 本地可用性**：若环境无 Docker，改用 SQLite 临时？**否决**——OpenSpec 指定 Postgres（pgvector P2 前置），MVP 就用 Postgres（testcontainers 或本地）。autopilot 须先确认 Postgres 可起。
- **LangChain.js 版本/兼容**：先查 Context7 最新 LangChain.js 用法再接，避免训练数据过期。
- **Playwright 浏览器下载**：CI/本地需 `playwright install chromium`。
- **Electron + Nuxt dev URL**：dev 模式走 `CRAB_WEB_DEV_URL`，打包模式走 `nuxt generate` 静态产物——MVP 验证 dev 模式即可。

---

## 5. autopilot 提示词（计划批准后复制使用）

```
/oh-my-claudecode:autopilot "完成 crab-auto-test MVP 收尾（基于已合并 main 的 0526b70 骨架）。读 crab-auto-test/MVP-FINISH-PLAN.md 与 openspec/changes/rebuild-ai-test-platform/PLAN-UNIFIED.md 为权威。

范围仅 MVP 收尾，按 MVP-FINISH-PLAN.md 的阶段 A→E 顺序执行：
A1 数据库初始化（docker-compose Postgres + prisma migrate dev --name init + seed admin + .env）
A2 shadcn-vue 安装（shadcn-nuxt + Button/Input/Table/Card/Dialog，替换 login/projects/test-cases 页面）
A3 secret-scan + CI workflow（infra/ci/secret-scan.mjs + .github/workflows/ci.yml 跑 typecheck/build/test + R7/F8/clean-room/secret-scan 4 门）
B1 LangChain.js 接线（ai-orchestration 引 @langchain/openai + zod 结构化输出，替换 draftFromRequirement 占位；守 R7 不引 MCP/Skill）
B2 SSE 实时流（GET /ai/runs/:id/stream 推 WorkflowStageEvent；保留 R8 snapshot 重连）
C1 Playwright 执行引擎（worker 真启动 chromium 隔离临时 profile，按 steps 执行，超时/资源限额/网络策略/截图/trace/redact 上报）
C2 redelivery 集成测试（MUST-5 断连重投恰一次；MVP 显式用轮询 claim，声明 R2 语义）
D1 tracer-bullet e2e（Playwright: login→project→test-case→ai-gen→approve→worker run→report 含产物）
D2 Electron 启动验证（pnpm --filter @crab/desktop dev 起窗口加载 web，断言 renderer 无 Node/fs，桥可用）
E1 MVP 收口门（pnpm -r typecheck && pnpm -r build && pnpm --filter @crab/api test 全绿；e2e 绿；4 CI 门绿；clean-room 绿；提交合并）

硬约束：
- OpenSpec 唯一需求源；不复制 WHartTest 任何源码/素材/Logo/文案/样式/配置（clean-room scan 须持续绿）
- 每步实现后运行验证（typecheck/build/test/门），失败就修，不跳过
- 不实现企业微信；不实现复杂 RBAC（仅 owner/member）
- 不越 OpenSpec 范围：不碰 Phase 2（KB/RAG/Skills/MCP 机制）、不碰 Phase 3（test-suite/api-automation 完整套件/requirement-management/llm-chat/mcp-admin，均 spec-first 门控）
- 不引入 LangGraph checkpointer/interrupt（R1）、BullMQ 作 worker 传输（R2）、服务端事件重放缓冲（R8）、外部密钥管理器（R5）
- 接 LangChain.js 前先用 Context7 查最新用法，避免 API 过期
- 遇到本地无 Postgres 时用 testcontainers 起，不降级 SQLite

每完成一个阶段提交一次（feat(crab-auto-test): MVP finish - <阶段>），全部完成后合并到 main。"
```

---

## 6. 执行边界
本文件为**待批准**计划。未写代码、未改源码、未提交。批准后用 §5 提示词跑 autopilot。
