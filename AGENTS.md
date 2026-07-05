# AGENTS.md — crab-auto-test 启动与运行指南

> 给后续接手的 agent(以及在家里的我自己)看：如何从一台干净机器把项目跑起来并看到 UI。
> 平台：Windows 11 + Git Bash + Node 20 + pnpm 8 + Docker。最后更新基于 commit `623e3b1`(MVP 收尾已合并 main)。

---

## 0. 前置环境（一次性）

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | ≥ 20 | 运行 web / api / desktop |
| pnpm | 8.15.9（`packageManager` 已锁定） | monorepo 包管理 |
| Docker | 任意现代版（本机 29.4.0） | 起本地 Postgres |
| Git Bash | — | Windows 下执行本文档命令（POSIX 语法） |

> 本机**没有** `psql`，数据库全靠 Docker 容器；不要假设有本地 Postgres 服务。

---

## 1. 克隆并安装依赖

```bash
git clone <repo> crab-auto-test
cd crab-auto-test
pnpm install            # workspace: apps/web, apps/desktop, services/api, packages/*
```

> `apps/web` 有 `postinstall: nuxt prepare`，首次安装会生成 `.nuxt/` 类型。若 web 首次 `dev` 报类型缺失，重跑 `pnpm --filter @crab/web postinstall`。

---

## 2. 起数据库（Postgres，Docker）

```bash
docker compose up -d            # 起 crab-postgres (postgres:16-alpine, 端口 5432)
docker ps                       # 确认 crab-postgres 健康
```

容器规格（见 `docker-compose.yml`）：用户 `crab` / 密码 `crab` / 库 `crab` / 端口 `5432`。
停：`docker compose down`（加 `-v` 清数据卷 `crab-pgdata`）。

---

## 3. 配置后端 .env

```bash
cd services/api
cp .env.example .env
```

`.env` 必填项（模板已给默认值，**只有一项必须改**）：

| Key | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgresql://crab:crab@localhost:5432/crab?schema=public` | 与 docker-compose 一致，不用改 |
| `JWT_SECRET` | `dev-only-jwt-secret-change-me` | 本地够用 |
| `ENVELOPE_MASTER_KEY_B64` | `AAAA...`（占位 32 字节） | **必须生成真的**，见下 |
| `SEED_ADMIN_EMAIL` | `admin@crab.local` | 种子管理员 |
| `SEED_ADMIN_PASSWORD` | `admin12345` | 种子管理员密码 |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | API 端口 |

生成信封主密钥（R5 信封加密需要 32 字节 base64）：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# 把输出粘到 .env 的 ENVELOPE_MASTER_KEY_B64=
```

> ⚠️ API 启动时若 `ENVELOPE_MASTER_KEY_B64` 缺失或不是 32 字节，`EnvelopeEncryptionService.onModuleInit` 会直接抛错拒绝启动。

---

## 4. 建表 + 种子管理员

```bash
cd services/api
pnpm db:generate         # 生成 Prisma client（已生成则跳过）
pnpm db:migrate          # prisma migrate dev，应用 migrations/0_init
pnpm db:seed             # 造 admin@crab.local / admin12345
```

> Prisma schema 里 `AiWorkflowRun.kind`/`status` 和 `WorkflowStageEvent.stage` 是 `String` 列（不是 enum）——因为共享类型里有连字符值如 `test-generation`，Prisma enum 不允许连字符。这是**设计如此**，不是 bug。

---

## 5. 起后端 API（端口 3000）

```bash
pnpm --filter @crab/api dev     # nest start --watch
```

健康检查：

```bash
curl http://localhost:3000/api/v1/auth/me      # 应返回 401（未登录，正常）
```

> AI 编排接了真 LLM（`@langchain/openai`）。要真生成草稿需先在 web 设置页配一个 model provider（含凭据），否则 AI 生成会用兜底逻辑。本地只看 UI 流程可不配。

---

## 6. 起 Web 前端（端口 3001）

> ⚠️ **端口坑**：Nuxt 默认端口是 3000，会和 API 冲突。必须显式指定 3001。

```bash
NUXT_PORT=3001 pnpm --filter @crab/web dev
# 或 Git Bash 下：
PORT=3001 pnpm --filter @crab/web dev
```

打开浏览器：**http://localhost:3001**

登录：
- 邮箱 `admin@crab.local`
- 密码 `admin12345`

> Web 是 `ssr: false` 的 SPA（`nuxt.config.ts`，为 Electron renderer 复用 R6）。API base 默认 `http://localhost:3000/api/v1`（见 `composables/api.ts`），本地起 API 在 3000 即对得上。

---

## 7.（可选）起 Electron 桌面端

```bash
# 先确保 web dev server 在 3001 跑着
CRAB_WEB_DEV_URL=http://localhost:3001 pnpm --filter @crab/desktop dev
# desktop dev = node build.mjs && electron .
```

桌面端会加载 `http://localhost:3001`（dev 模式），桥 `window.crabBridge` 可用。

---

## 8. 端到端跑通验证（tracer-bullet e2e）

```bash
cd apps/web
pnpm test:e2e          # playwright test，需先 playwright install chromium
```

e2e 流程：login → 建 project → 建 test-case → ai-generation 生成 → approve → 触发 execution → worker claim 执行 → 报告含产物。
需 API + DB + (可选 web dev) 都在跑。

---

## 9. 常用命令速查

```bash
# 根目录（turbo 编排全部）
pnpm dev                 # 起所有 dev（注意端口冲突，建议分开起）
pnpm build               # 全量构建
pnpm -r typecheck        # 全 workspace 类型检查
pnpm -r lint
pnpm --filter @crab/api test          # vitest unit
pnpm --filter @crab/web test:e2e      # playwright e2e

# 后端单独
pnpm --filter @crab/api db:generate
pnpm --filter @crab/api db:migrate
pnpm --filter @crab/api db:seed
pnpm --filter @crab/api db:push       # 开发期快速同步 schema 到 DB（跳过 migration）
```

---

## 10. 启动顺序速记（在家开机后的最小步骤）

```bash
cd crab-auto-test
docker compose up -d                                    # 1. 数据库
pnpm --filter @crab/api db:migrate                      # 2. 建表（已建过可跳）
pnpm --filter @crab/api db:seed                         # 3. 种子（已种过可跳）
pnpm --filter @crab/api dev        &                    # 4. API :3000
NUXT_PORT=3001 pnpm --filter @crab/web dev              # 5. Web :3001 → 浏览器开 localhost:3001
```

登录：`admin@crab.local` / `admin12345`。

---

## 11. 排错

| 症状 | 原因 / 修法 |
|---|---|
| API 启动报 `ENVELOPE_MASTER_KEY_B64 is required` | .env 没填或不是 32 字节 base64，按 §3 生成 |
| `pnpm db:migrate` 报 `Can't reach database server` | Postgres 容器没起，`docker compose up -d` |
| Web `dev` 起在 3000 报 `EADDRINUSE` | 被 API 占了，用 `NUXT_PORT=3001` 起到 3001 |
| 登录 401 / network error | API 没在 3000 跑，或 `.env` 的 `DATABASE_URL` 和容器不一致 |
| `db:seed` 报 admin 已存在 | 正常，seed 幂等，已种过会跳过 |
| web 首次 dev 报类型缺失 | `pnpm --filter @crab/web postinstall` 重生成 `.nuxt/` |
| Prisma client 找不到 | `pnpm --filter @crab/api db:generate` |
| e2e 报 chromium 没装 | `npx playwright install chromium` |

---

## 12. 架构快照（MVP，commit 623e3b1）

- **`services/api`** NestJS+Fastify+Prisma，8 模块：auth / projects / model-providers / audit / test-assets / executions / worker-gateway / ai-orchestration。所有 LLM/LangGraph 编排在后端。
- **`apps/web`** Nuxt3 SPA（ssr:false）+ Tailwind + shadcn-vue（button/card/input）。瘦客户端，无 LLM/MCP/Prisma import。
- **`apps/desktop`** Electron main/preload/renderer/worker，worker 是本地 Playwright 执行器。
- **`packages/shared-types`** types-only 契约（DTO/StreamEnvelope/WorkerJob/BridgeApi）。
- **`packages/config`** 共享 tsconfig/eslint/tailwind preset。

阶段边界：MVP 已合并 main。Phase 2（KB/RAG/Skills/MCP 机制）见 `PHASE2-PLAN.md`，未实施。Phase 3（5 个 spec-first cap）未动。

---

## 13. Product Design Guardrails

- Crab is a Proof Case workbench, not a flat testing toolbox.
- Phase 1 first-level navigation is Workbench, Verification Tasks, Asset Library, System Context, and Settings.
- Phase 1 P0 design slice is Proof Case closed loop plus Workbench; System Context stays lightweight placeholder/status until the loop is clear.
- Default project entry is Overview First: Proof Case Queue, Release Risk, Failed Evidence, Pending Approvals, Coverage Gaps, Recent Runs, and Next Actions.
- Workbench first screen is action + risk dual queues: My To-dos plus Risks and Blockers.
- Proof Case creation in phase 1 starts from requirement description, tested system, and business entry point, with similar asset recommendations.
- Proof Case detail follows: Requirement -> State Transition -> Cases -> Automation -> Execution -> Evidence -> Report.
- Proof Case detail first screen is next-action-first: what is blocked, what needs confirmation, and what the user should do next.
- AI draft confirmation is risk-tiered: low-risk uses minimum confirmation, high-risk uses full confirmation, with simple explicit tiering in phase 1.
- State Transition uses graph + table dual views, with table as the default working view for confirmation and bulk editing.
- Evidence Matrix is two-layered: default by state transition and evidence type, expanded by case, step, artifact, assertion, and reviewer decision.
- Proof Report is two-layered: first screen answers ship/no-ship, why, remaining risk, and confirmer; drill-down serves QA/developer evidence review.
- Asset Library is reuse-recommendation-first: show similar assets during Proof Case creation, with fit scope, latest run result, and maintainer.
- System Context is evidence-collection context: tested system, environments, accounts, page entries, API sources, glossary, DB/log entries, state-field mapping, and collection methods; governance stays in Settings.
- AI entry points are stage actions plus a right-side assistant: actions do task execution; assistant explains sources, risks, tool calls, history, and follow-up.
- AI correction is structured: accept/edit/reject/regenerate/view sources plus error reason; phase 1 keeps generation history and last human confirmation, not complex rollback.
- Script details are progressive disclosure: default hidden, with explicit entry on generation failure, execution failure, review, modification, reuse, or debugging.
- Expert QA efficiency in phase 1 is batch confirmation plus search/filtering; defer full shortcuts, batch rerun, and complex comparison.
- Evidence Reports are not a phase-1 first-level menu; keep them as a Proof Case detail stage and generated artifact until sharing, search, audit, and history comparison become high-frequency.
- State Transition is required only for requirements that involve business state changes; non-stateful copy/visual/content/config changes may skip it with a recorded reason.
- API automation code reference is Hoppscotch. Do not use Bruno as the retained API reference unless explicitly re-approved.
- Execution and Reports are evidence-first; trace/log/network/source details are drill-down evidence.
- Knowledge is Source Trust Center. MCP is Server Governance Center. Skills are governed assets; AI Chat is a contextual invocation drawer.
- Settings is Project Governance Settings: General, Members, Model Providers, Credentials, Audit, Danger Zone.
- UI component baseline is recorded in `docs/UI-COMPONENT-BASELINE.md`: use shadcn-vue/Tailwind/Radix/lucide as the foundation, follow its module matrix, and do not add a second full UI system without an explicit design revision.
- Product design checklists are recorded in `docs/PRODUCT-DESIGN-CHECKLISTS.md`: page design must pass UX, UI, visual, component, content, evidence-trust, and handoff checks before it is treated as ready.
- Confirmed horizontal product-design standards are recorded in `docs/PRODUCT-DESIGN-HORIZONTAL-STANDARDS.zh-CN.md`; use it as the accepted v1 for visual, component, content, handoff, and review-checklist decisions.
- Release gate is lightweight tiered evidence with final human pass/fail in phase 1. CI pipeline integration is future-facing and must not complicate current product design.
- Local open-source reference products live at `D:\code\auto-test\crab-auto-test\.claude\reference-products\oss`.
- Concrete reference-product page-structure mapping is recorded in `docs/REFERENCE-PRODUCT-PAGE-MAPPING.md`; future feature specs for API automation, UI execution evidence, reports, Knowledge, Skills, AI Chat, MCP, or Settings should consult it before proposing page structure.
- Reference product rule: borrow page structure, not product boundary. Hoppscotch -> API workbench; Playwright -> execution evidence detail; Allure -> proof report; Dify -> Knowledge source trust; Open WebUI -> Skills and AI asset separation; Cline -> MCP permission and tool-call transparency; Supabase -> project governance settings.
