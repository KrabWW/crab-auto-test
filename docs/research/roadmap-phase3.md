# Phase 3 可执行 Roadmap（5 capabilities）

> 产出方：worker-2（task #7）。基线 commit：`39e759d`（crab-auto-test main）。
> OpenSpec 依据：`openspec/changes/fill-spec-gaps-phase3/`（已 `openspec validate` 通过，5 cap × 3 reqs = 15 ADDED）。
> 性质：**纯 roadmap 文档，不写业务代码**。每 cap 输出 7 维度 + 全局门控 + 实现顺序。
> Clean-room 约束：所有数据模型/路由/UI/测试均为**独立设计**，不搬 WHartTest 实现细节（尤其 api-automation 的 HttpRunner DSL、UI step-config schema、提示词、布局）。

---

## 0. 全局门控（HARD — 实现前必须满足）

Phase 3 实现受**三道硬门控**约束，顺序不可颠倒：

| # | 门控 | 当前状态 | 阻塞动作 |
|---|---|---|---|
| G1 | `fill-spec-gaps-phase3` 通过 validate | ✅ 已完成（`openspec validate` PASS） | 无 |
| G2 | `rebuild-ai-test-platform` 归档（`openspec archive` → 填充 `openspec/specs/`） | ⏳ 未归档（`openspec/specs/` 与 `archive/` 均空） | **阻塞 G3**：MODIFIED delta 在结构上无法解析真实 spec |
| G3 | `fill-spec-gaps-modifieds` 落地 5 个 MODIFIED/ADDED delta | ⏳ 未创建（依赖 G2） | **阻塞实现**：web-ui 路由 / backend-ai-orchestration 引用 / ai-test-generation 回链 / clean-room-rebuild R5 非目标提升 / test-asset-management 索引均未绑定 |

**门控序列**（来自 `design.md` §4 + `tasks.md` 11.7/11.8）：
```
G1 fill-spec-gaps-phase3 (ADDED, done)
   → G2 openspec archive rebuild-ai-test-platform
      → G3 fill-spec-gaps-modifieds (5 MODIFIED/ADDED, post-archive)
         → 实现（每 cap 一个 impl change，顺序见 §7）
```

**G3 的 5 个 delta（实现前必须先 binding）**：
1. `web-ui` ADDED R4/R5/R6 — chat / mcp-admin / api-automation 三条路由。
2. `backend-ai-orchestration` MODIFIED R3 — 引用 mcp-admin allowlist（"MCP invocations SHALL use the mcp-admin allowlist"），不重述拒绝谓词。
3. `ai-test-generation` MODIFIED R1 — "approved managed requirement 作为可选输入 + 生成用例回链 requirement version" 场景。
4. `clean-room-rebuild` ADDED R5 — 非目标提升显式化：永久非目标保持永久；API 自动化全套 + 全 MCP 管理 LIFT 到 Phase-3 spec-first。R3 原文不动。
5. `test-asset-management` — 仅索引/约束（test-suite 用自包含 SuiteRun，无 FK 变更；性能需要时才加索引）。

> **关键**：G3 未落地前，任何 cap 的实现 PR 都应被 CI/review 拒绝（理由：MODIFIED 未 binding，跨 cap 耦合未定义）。

---

## 1. 实现顺序与依赖

```
test-suite (C1) ────────► 独立，仅依赖现有 execution-record 模型（已存在）
api-automation (C2) ────► 独立，复用 execution-record + envelope 加密（已存在）；替换 web-ui 占位路由
requirement-management (C3) ► 独立实体；落地后 C4 的 ai-test-generation MODIFIED R1 才能生效（approved req 作输入）
llm-chat (C4) ──────────► 独立；复用 model-provider + streaming 契约（已存在）；落地 web-ui R4 chat 路由
mcp-admin (C5) ─────────► 最后；它 owns 拒绝谓词，落地后 backend-ai-orchestration MODIFIED R3 引用才能生效；当前 mcp 模块的 allowlist 机制是过渡态，C5 接管 single-source-of-truth
```

| 阶段 | Cap | 依赖前置 | 解锁下游 |
|---|---|---|---|
| 1 | test-suite | G3 | 无（独立） |
| 2 | api-automation | G3 | 无（替换占位路由） |
| 3 | requirement-management | G3 | ai-test-generation MODIFIED R1（approved req → case 回链） |
| 4 | llm-chat | G3 | web-ui R4 chat 路由 |
| 5 | mcp-admin | G3 | backend-ai-orchestration MODIFIED R3（allowlist 引用） |

> 顺序由 `tasks.md` 11.8 指定。mcp-admin 最后，因其 owns 拒绝谓词，是 backend-ai-orchestration 的依赖源。

---

## 2. test-suite

**spec ref**: `fill-spec-gaps-phase3/specs/test-suite/spec.md` R1–R3（自包含 SuiteRun，不加 test-asset-management FK — D8）。

### 2.1 范围
- R1: 项目级 test suite，持有**有序** test case 成员；编辑成员不破坏历史 run。
- R2: suite 执行按序跑每个 case，聚合为单一 suite-level 摘要（全 pass 才 pass，任一 fail 即 fail）；中途 abort 记录已完成/未完成。
- R3: 每 case run 复用现有 execution-record + artifact 模型，链到自包含 SuiteRun（持有 execution-record ID 列表），**不加 test-asset-management FK**。

### 2.2 数据模型（Prisma 描述，不写代码）
- `model TestSuite`: `id`, `projectId`, `name`, `description?`, `createdBy`, `createdAt`, `updatedAt`。关系 `project`, `creator`, `members TestSuiteMember[]`, `runs SuiteRun[]`。
- `model TestSuiteMember`: `id`, `suiteId`, `testCaseId`, `order Int`。关系 `suite`, `testCase`。`@@unique([suiteId, testCaseId])` + `@@index([suiteId, order])`。**有序靠 `order` 字段，不靠数组**。
- `model SuiteRun`: `id`, `suiteId`, `projectId`, `status SuiteRunStatus`(queued/running/passed/failed/aborted), `startedAt`, `finishedAt?`, `summary Json?`(rolled-up per-case), `createdAt`。关系 `suite`, `project`, `executionRecords SuiteRunExecutionRecord[]`。**自包含：通过 join 表持 execution-record ID 列表，非 test-asset-management FK**。
- `model SuiteRunExecutionRecord`: `id`, `suiteRunId`, `executionRecordId String`, `testCaseId String`, `order Int`, `ran Boolean`, `createdAt`。关系 `suiteRun`。`@@index([suiteRunId, order])`。**这是 SuiteRun ↔ 已存在 TestExecution 的 join，TestExecution 本身不改**。
- `enum SuiteRunStatus`: queued / running / passed / failed / aborted。
- 迁移：`2_phase3_init`（test-suite 段）。

### 2.3 API 路由（NestJS，global prefix `/api/v1`，project-scoped `@Controller("projects/:projectId")`）
- `POST /projects/:projectId/suites` — 建 suite（含有序 case 成员）。
- `GET /projects/:projectId/suites` — 列表。
- `GET /projects/:id/suites/:suiteId` — 详情（含成员）。
- `PATCH /projects/:id/suites/:suiteId` — 改成员（增删/重排）；**历史 run 不动**。
- `DELETE /projects/:id/suites/:suiteId`。
- `POST /projects/:id/suites/:suiteId/runs` — 触发 suite 执行（按序 dispatch 每个 case，复用 executions 模块的执行记录创建路径 + worker-gateway 调度）。
- `GET /projects/:id/suites/:suiteId/runs` — run 历史。
- `GET /projects/:id/suites/:suiteId/runs/:runId` — run 摘要（rolled-up per-case pass/fail + failed step + duration，经 execution-record ID 列表可达 artifacts）。
- `POST /projects/:id/suites/:suiteId/runs/:runId/abort` — 中止（标记 aborted + 记录已完成/未完成）。
- 权限：`IsProjectMember`（建/改/跑）；查看同成员。

### 2.4 UI 页面（`apps/web/pages/projects/[id]/`，shadcn-vue）
- `suites.vue` — suite 列表 + 新建（需补 Table/Dialog primitive，见 §6 全局增强）。
- `suites/[suiteId].vue` — 成员管理（vuedraggable 风格的拖拽重排，但用独立实现；列出有序 case + 来源 module）。
- `suites/[suiteId]/runs/[runId].vue` — run 摘要（per-case 表格：pass/fail + failed step + duration + 跳到 artifact）。
- 入口：项目侧栏加 "Suites"（web-ui R 系列 MODIFIED 在 G3 处理，此处实现待 G3 落地后）。

### 2.5 测试策略
- 后端单测（vitest，纯逻辑/状态机）：suite 成员有序持久化；成员编辑后历史 run 不变（snapshot 对比）；rolled-up 状态机（全 pass→passed，任一 fail→failed，abort→aborted + 已完成集）；自包含 SuiteRun 经 execution-record ID 列表可达 artifact。
- 集成（CI）：建 suite → run → 断言每个 case 生成一条 TestExecution + SuiteRunExecutionRecord join → abort 中途 → 断言 partial 记录。
- e2e（Playwright）：UI 建含 3 case 的 suite → 跑 → 看摘要 per-case 结果。

### 2.6 安全门禁
- 项目级权限（`IsProjectMember`），无新角色。
- suite run 复用 worker-gateway 的 R2 redelivery + R3 ownership（不引入新传输）。
- 不引入分布式 suite runner（D8 open question：复用本地 Playwright worker vs 专用 runner — **默认复用本地 worker**，分布式 deferred）。
- clean-room：suite/run 数据模型为独立设计（自包含 ID 列表），不搬 WHartTest 的 suite/run schema。

### 2.7 验收命令
```bash
npx openspec validate fill-spec-gaps-phase3          # G1 仍 pass
pnpm --filter @crab/api test                          # 新增 test-suite 单测 pass
pnpm --filter @crab/web test:e2e                      # suite e2e pass
pnpm -r typecheck                                     # Prisma client + shared-types 类型 OK
pnpm --filter @crab/api db:migrate                    # 2_phase3_init 应用
node infra/ci/clean-room-scan.mjs                     # 无 WHartTest 引用
```

---

## 3. api-automation

**spec ref**: `fill-spec-gaps-phase3/specs/api-automation/spec.md` R1–R3（Phase-3 gate + secrets-as-references + clean-room — D9）。**clean-room 最高风险域**。

### 3.1 范围
- R1: API test case = HTTP 请求（method/URL/headers/body）+ 有序断言（status code / headers / body）。MVP 仅占位路由（`apps/web/pages/projects/[id]/api-automation.vue` 已存在），完整 authoring 是 Phase 3。
- R2: API case 执行产 execution record（status/duration/response metadata/per-assertion 结果），类比 browser execution。
- R3: 独立 clean-room 能力，**不搬上游 API-automation 源码/提示词/断言 DSL/UI 布局**；credential 全部 envelope-encrypted reference。

### 3.2 数据模型（Prisma 描述 — 独立设计，不镜像 HttpRunner Config/Step/RunRequest/RunSqlRequest）
- `model ApiCase`: `id`, `projectId`, `moduleId?`(可选挂模块树), `title`, `method HttpMethod`(GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS), `url String`, `headers Json?`(请求头，含敏感字段以 `cred:` 前缀引用 credentialId), `body Json?`(请求体，结构化), `assertions Json`(有序断言数组，见下), `createdBy`, `createdAt`, `updatedAt`。关系 `project`, `module?`, `creator`, `executions ApiExecution[]`。
- **断言模型（独立设计）**：每条断言为 `{ kind: "status"|"header"|"body-json"|"body-text", op: "equals"|"contains"|"jsonpath-equals"|..., target: string, expected: string, credentialRef?: string }`。**不引入 HttpRunner 的 RunRequest/RunSqlRequest/extract/validate DSL 语义**；用扁平的 kind+op+target+expected 表达。
- `model ApiExecution`: `id`, `projectId`, `apiCaseId`, `status ExecutionStatus`(复用现有 enum), `startedAt`, `finishedAt?`, `durationMs?`, `responseStatus Int?`, `responseHeaders Json?`(redacted), `responseBodySnapshot Json?`(redacted，仅 fail 时存), `assertionResults Json`(per-assertion pass/fail + actual), `workerJobId?`, `createdAt`。关系 `project`, `apiCase`, `artifacts ExecutionArtifact[]`(复用现有 artifact 模型)。
- **Credential 引用**：复用 `infra/crypto/` 的 envelope 加密。新增 `model ApiCredential`（或复用 model-providers 的 credentialCiphertext/keyId 模式）: `id`, `projectId`, `name`, `credentialCiphertext Bytes`, `credentialKeyId String`, `createdAt`。请求头/body 里的 credential 以 `cred:<apiCredentialId>` 引用，**绝不存明文**。
- 迁移：`2_phase3_init`（api-automation 段）。

### 3.3 API 路由
- `POST /projects/:id/api-cases` — 建 API case（headers/body 中的 credential 立即转 reference）。
- `GET /projects/:id/api-cases`（支持 module 过滤）。
- `GET /projects/:id/api-cases/:caseId`（**不返回 credential 明文**）。
- `PATCH /projects/:id/api-cases/:caseId`。
- `DELETE /projects/:id/api-cases/:caseId`。
- `POST /projects/:id/api-cases/:caseId/run` — 触发执行（见执行器选择）。
- `GET /projects/:id/api-cases/:caseId/executions`。
- `GET /projects/:id/api-cases/:caseId/executions/:execId`（response snapshot 已 redacted）。
- `POST /projects/:id/api-credentials` — 建 credential（envelope 加密，**永不返回明文**，R5）。
- 权限：`IsProjectMember`。

### 3.4 UI 页面（替换占位路由）
- `api-automation.vue` → 升级为完整 authoring（替换现有 placeholder 注释）：
  - case 列表（按 module 树分组）。
  - case 编辑器：method 选择 + URL + headers 表格（credential 字段用 credential picker）+ body 编辑器（JSON）。
  - 断言编辑器：有序断言列表（kind/op/target/expected）。
  - 执行面板：触发 run + 显示 response（redacted）+ per-assertion 结果。
- 入口已在侧栏（占位路由存在），Phase 3 替换为真实页面。

### 3.5 测试策略
- 后端单测：credential 持久化为 reference、API 响应永不返回明文（round-trip + 断言 ciphertext 不含 plaintext，复用 `envelope.spec.ts` 模式）；断言引擎纯逻辑（status/header/body-json/body-text 各 op 的 pass/fail）；failing assertion 的 response snapshot redaction（secrets/cred 命名字段 redacted，复用 `redact.spec.ts` 模式）。
- 集成：建 case（含 cred header）→ run → 断言 execution record 含 per-assertion 结果 + response snapshot redacted + artifact 可达。
- e2e：UI 建 GET case + status-equals-200 断言 → run → 看 pass。

### 3.6 安全门禁（**最高优先级**）
- **clean-room provenance note 必写**（R3 场景）：实现 PR 须含独立实现路径说明，记录断言模型为何是 kind+op+target+expected 而非 HttpRunner DSL。
- credential 全部 envelope-encrypted reference（复用 `infra/crypto/`，R5）；**绝不存明文**，**API 响应永不返回明文**。
- response snapshot fail 时 redacted（secrets 命名字段 + cred 引用值 redacted）。
- 执行器选择（D9 open question：本地 Electron worker vs 后端 HTTP runner）— **默认后端 HTTP runner**（API 测试无需 Playwright，纯 HTTP；本地 worker 留给 UI 自动化）。分布式 API worker 池 deferred。
- **不引入**：HttpRunner 的 Config/Step/RunRequest/RunSqlRequest、extract/validate DSL、HttpRunner 的变量作用域语义、SqlRequest（API 测试不做 SQL 断言，避免引入 DB 执行面）。
- `infra/ci/clean-room-scan.mjs` 已拦 `WHartTest*` 引用；实现期建议扩展扫描 `services/api/src/modules/api-automation/` + `apps/web/pages/projects/[id]/api-automation.vue` 的 upstream 模式（可选增强，非阻塞）。

### 3.7 验收命令
```bash
npx openspec validate fill-spec-gaps-phase3
pnpm --filter @crab/api test                          # api-automation 单测 pass（含 credential round-trip + redaction）
pnpm --filter @crab/web test:e2e                      # api case e2e pass
pnpm -r typecheck
pnpm --filter @crab/api db:migrate                    # 2_phase3_init
node infra/ci/clean-room-scan.mjs
node infra/ci/secret-scan.mjs                         # 无明文 secret 泄漏
# clean-room provenance note 存在于实现 PR 描述
```

---

## 4. requirement-management

**spec ref**: `fill-spec-gaps-phase3/specs/requirement-management/spec.md` R1–R3（owner-only approval + versioned linkage — D10）。

### 4.1 范围
- R1: requirement 为项目级一等实体（title/content/status/version）。
- R2: draft → reviewed → approved，**仅 owner 可 approve**，无新角色，每步 audit。
- R3: 仅 approved requirement 可作 AI 生成输入；生成用例回链所用 requirement version；revised requirement 保留旧 version 链接（traceability）。

### 4.2 数据模型（Prisma 描述）
- `model Requirement`: `id`, `projectId`, `title`, `currentVersionId String?`, `createdBy`, `createdAt`, `updatedAt`。关系 `project`, `creator`, `versions RequirementVersion[]`, `currentVersion RequirementVersion?`。
- `model RequirementVersion`: `id`, `requirementId`, `version Int`, `content String`, `status RequirementStatus`(draft/reviewed/approved), `approvedBy String?`, `createdAt`, `approvedAt?`。关系 `requirement`, `approver User?`, `linkedCases TestCase[]`。`@@unique([requirementId, version])` + `@@index([requirementId, version])`。**版本化靠 version 字段，revised 即新建 version**。
- `enum RequirementStatus`: draft / reviewed / approved。
- **复用现有 `TestCase`**：加 `requirementVersionId String?`（ nullable，向后兼容）。关系 `requirementVersion RequirementVersion?`。这是对 test-asset-management 的**轻量 ADDED 字段**，由 G3 的 `test-asset-management` delta 处理（索引/约束）。
- 迁移：`2_phase3_init`（requirement 段）+ TestCase 加列。

### 4.3 API 路由
- `POST /projects/:id/requirements` — 建 requirement（draft v1）。
- `GET /projects/:id/requirements` — 列表（含 currentVersion status）。
- `GET /projects/:id/requirements/:reqId` — 详情（含 versions）。
- `POST /projects/:id/requirements/:reqId/versions` — 新建 version（revised）。
- `POST /projects/:id/requirements/:reqId/versions/:vId/transition` — draft→reviewed / reviewed→approved（**approved 仅 owner**，每步 audit）。
- `GET /projects/:id/requirements/:reqId/versions` — version 历史。
- 权限：transition 中 approved 路径 `IsProjectOwner`，其余 `IsProjectMember`。

### 4.4 UI 页面
- `requirements.vue` — 列表 + status badge（draft/reviewed/approved）。
- `requirements/[reqId].vue` — 详情：当前 version 内容 + version 历史 + transition 按钮（approved 仅 owner 可见可点）。
- ai-generation 页（已存在）增加 "选 approved requirement 作输入" 入口（ai-test-generation MODIFIED R1 在 G3 处理；实现期接线）。

### 4.5 测试策略
- 后端单测：状态机（draft→reviewed→approved 合法；非法跳转拒；approved 仅 owner）；audit 每步记录（actor/project/req/transition/timestamp）；version 递增 + revised 后旧 version 的 case 链接不变（traceability）。
- 集成：建 req → reviewed → owner approve → 选作 AI 输入 → 生成 case 回链 version → revise req → 旧 case 仍链旧 version。
- e2e：UI approve 流程（owner 能点，member 不能点）。

### 4.6 安全门禁
- **simple-roles 不变量**：approved 仅 owner，无 reviewer/approver/admin 角色（D10）。Gate D 扫 role-creep 语言。
- 不引入在线 DOCX 编辑器（永久非目标）— requirement content 是纯文本/Markdown 字符串，非富文档编辑。
- 不引入复杂 RBAC / 权限矩阵。
- audit 复用现有 `AuditLog` 模型。

### 4.7 验收命令
```bash
npx openspec validate fill-spec-gaps-phase3
pnpm --filter @crab/api test                          # requirement 状态机 + audit + version traceability
pnpm --filter @crab/web test:e2e                      # approve 流程 e2e
pnpm -r typecheck
pnpm --filter @crab/api db:migrate
node infra/ci/clean-room-scan.mjs
# Gate D 检查：grep 新增角色名（reviewer/approver/admin）应为 0
```

---

## 5. llm-chat

**spec ref**: `fill-spec-gaps-phase3/specs/llm-chat/spec.md` R1–R3（session-level + backend-owned — D11）。

### 5.1 范围
- R1: 项目成员经配置的 model provider 持有交互式（单轮或会话）chat；LLM 调用**仅在 NestJS 后端**；客户端不直连 LLM。**会话级 only**：无 tool-calling、无多步状态、无 human-approval gating → 不在 backend-ai-orchestration R2 多步工作流域。
- R2: 持久化 chat session + messages，可重开续聊。
- R3: audit chat 事件（actor/provider/project/timestamp/outcome）；**不持久化/记录 credential 或 raw secret**。

### 5.2 数据模型（Prisma 描述）
- `model ChatSession`: `id`, `projectId`, `userId`, `providerId String`, `title String?`, `createdAt`, `updatedAt`。关系 `project`, `user`, `provider ModelProvider`, `messages ChatMessage[]`。`@@index([projectId, userId])`。
- `model ChatMessage`: `id`, `sessionId`, `role ChatRole`(user/assistant/system), `content String`, `tokenCount Int?`, `createdAt`。关系 `session`。`@@index([sessionId, createdAt])`。**不存 provider credential**（credential 在 ModelProvider 已 envelope 加密，message 只引用 providerId）。
- `enum ChatRole`: user / assistant / system。
- audit 复用 `AuditLog`（action="chat.message", targetType="chat-session", metadata 含 providerId/project，**不含 credential**）。
- 迁移：`2_phase3_init`（chat 段）。

### 5.3 API 路由
- `POST /projects/:id/chat/sessions` — 建 session（绑 provider；**无配置 provider 则拒 + 明确原因**，R1 场景 2）。
- `GET /projects/:id/chat/sessions` — 我的 session 列表。
- `GET /projects/:id/chat/sessions/:sessionId` — 含历史 messages（有序）。
- `POST /projects/:id/chat/sessions/:sessionId/messages` — 发消息；后端调 LLM，经**共享 streaming 契约**（复用 `infra/streaming/`，SSE）流回。audit 事件。
- `GET /projects/:id/chat/sessions/:sessionId/stream` — SSE 流（复用现有 streaming snapshot 模式）。
- 权限：`IsProjectMember`；session 仅创建者可访问（`userId` 匹配）。

### 5.4 UI 页面（web-ui R4 chat 路由 — G3 处理）
- `chat.vue` — session 列表 + 新建（选 provider）。
- `chat/[sessionId].vue` — 对话界面（消息流 + 输入框 + SSE 流式渲染）。无 provider 时显示 "configure a model provider first"。
- 入口：项目侧栏 "Chat"。

### 5.5 测试策略
- 后端单测：无 provider 时拒建 session + 明确原因；message 持久化有序；audit 事件不含 credential（grep assert）；streaming 契约 conformance。
- 集成：建 session → 发消息 → 收 SSE → 重开 session 历史可加载 → 续聊。
- e2e：UI 对话（无真实 provider 时用 deterministic fallback，复用 ai-orchestration 的 fallback 模式）。

### 5.6 安全门禁
- **后端 owns LLM 调用**（不变量）；客户端永不持 credential。
- **不引入** tool-calling / 多步状态 / human-approval gating（D11 — 进入则需 backend-ai-orchestration MODIFIED，明确 deferred 非目标）。
- **不引入** durable LangGraph checkpointer / `interrupt()`（R1 — chat 是会话级，状态在 DB message 表，非 graph checkpointer）。
- audit + message 不含 credential（secret-scan 门禁）。
- chat session scope（D11 open question：per-user vs per-project-default）— **默认 per-user**（session 绑 userId）。

### 5.7 验收命令
```bash
npx openspec validate fill-spec-gaps-phase3
pnpm --filter @crab/api test                          # chat 单测（含 no-credential audit 断言）
pnpm --filter @crab/web test:e2e                      # chat e2e
pnpm -r typecheck
pnpm --filter @crab/api db:migrate
node infra/ci/clean-room-scan.mjs
node infra/ci/secret-scan.mjs
node infra/ci/f8-drift-scan.mjs                       # 确认未引入 durable graph / interrupt()
```

---

## 6. mcp-admin

**spec ref**: `fill-spec-gaps-phase3/specs/mcp-admin/spec.md` R1–R3（project-scoped + owns rejection predicate — D12）。**最后实现**，因 backend-ai-orchestration MODIFIED R3 依赖它。

### 6.1 范围
- R1: surface discovered MCP tools 供 review；owner approve（allowlist）或 revoke project-scoped tool；**仅 owner/member**；无 global tool 类别，无 global approver 角色。
- R2: **approved allowlist 是后端 MCP 调用的 single source of truth**；backend AI orchestration 调用非 allowlist tool 须在 invoke 前拒。mcp-admin owns 拒绝谓词；backend-ai-orchestration 引用不重述。
- R3: audit admin 治理动作（propose/review/approve/revoke）+ per-call tool metadata，可按 project/tool 联合查询。

### 6.2 数据模型（Prisma 描述 — 复用 + 扩展现有 Phase 2 MCP 模型）
- **复用现有 `McpToolAllowlist`**（Phase 2 已有）：`id`, `projectId`, `toolName`, `serverRef`, `approved Boolean`, `approvedBy String?`, `createdAt`, `updatedAt`。**当前是过渡态**（mcp 模块直接强制）；C5 接管 single-source-of-truth。
- **扩展**：加 `reviewState`（proposed/reviewed/approved/revoked）字段或枚举细化治理流程；加 `proposedBy String?`, `reviewedAt?`。**这是对 McpToolAllowlist 的 MODIFIED/ADDED**，由 G3 的 mcp-admin delta 处理（或作为 mcp-admin 实现期的 schema 扩展，取决于 G3 范围界定）。
- **复用现有 `McpToolCall`**（Phase 2 已有）：`id`, `runId?`, `toolName`, `serverRef`, `approved Boolean`, `argsRedacted Json?`, `resultMeta Json?`, `status McpToolCallStatus`, `startedAt`, `finishedAt?`。已满足 R3 per-call metadata 需求。
- 治理 audit 复用 `AuditLog`（action="mcp.approve"/"mcp.revoke" 等）。
- 迁移：`2_phase3_init`（mcp-admin 段，主要为 McpToolAllowlist 加治理字段）。

### 6.3 API 路由
- `GET /projects/:id/mcp/tools` — discovered/registered tools 列表（含 reviewState）。
- `POST /projects/:id/mcp/tools` — propose/register 一个 tool（manual first；auto-discovery deferred）。
- `POST /projects/:id/mcp/tools/:toolId/review` — 标记 reviewed（member 可）。
- `POST /projects/:id/mcp/tools/:toolId/approve` — allowlist（**仅 owner**，audit）。
- `POST /projects/:id/mcp/tools/:toolId/revoke` — 移出 allowlist（**仅 owner**，audit；下次调用即拒）。
- `GET /projects/:id/mcp/tools/:toolId/history` — 联合查询 admin 动作 trail + McpToolCall 记录（redacted args，无 raw secret）。
- **改造现有** `POST /projects/:id/mcp/invoke`：拒绝谓词改为查 mcp-admin allowlist（single source of truth），非 allowlist 即拒 + 记 McpToolCall(status=rejected)。
- 权限：approve/revoke 仅 `IsProjectOwner`；propose/review/view `IsProjectMember`。

### 6.4 UI 页面（web-ui R5 mcp-admin 路由 — G3 处理）
- `mcp-admin.vue` — tool 列表 + reviewState badge + approve/revoke 按钮（owner only）。
- `mcp-admin/[toolId].vue` — tool 详情：治理动作 trail + McpToolCall 历史（redacted）。
- 入口：项目侧栏 "MCP Admin"。

### 6.5 测试策略
- 后端单测：拒绝谓词（非 allowlist tool 调用被拒 + 记 rejected；allowlist 调用执行 + 记 success）；revoke 后下次调用即拒；owner-only approve/revoke（member 拒）；联合查询返回 admin trail + tool calls（redacted）。
- 集成：propose → review → owner approve → invoke 成功 → revoke → invoke 被拒。
- e2e：UI approve/revoke 流程。

### 6.6 安全门禁
- **single-source-of-truth**（D12）：拒绝谓词只在 mcp-admin allowlist；backend-ai-orchestration 引用不重述（防 drift）。
- **project-scoped only**：无 global tool 类别，无 global admin（§11 a5 永久非目标）。
- **simple-roles**：approve/revoke 仅 owner，无新角色。
- per-call args redacted（复用 `redact.spec.ts` 模式）；无 raw secret。
- MCP tool discovery（D12 open question）— **manual registration first**，auto-discovery deferred。
- `infra/ci/skill-adapter-scan.mjs` 风格的安全扫描对 MCP tool 调用同样适用（no eval/vm/dynamic-require）。

### 6.7 验收命令
```bash
npx openspec validate fill-spec-gaps-phase3
pnpm --filter @crab/api test                          # mcp-admin 拒绝谓词 + owner-only + 联合查询
pnpm --filter @crab/web test:e2e                      # approve/revoke e2e
pnpm -r typecheck
pnpm --filter @crab/api db:migrate
node infra/ci/clean-room-scan.mjs
node infra/ci/secret-scan.mjs
# 确认 backend-ai-orchestration 的 mcp 调用路径已切到 mcp-admin allowlist（single source）
```

---

## 7. 全局增强（跨 cap 共享前置）

以下增强随 Phase 3 顺带处理（属 P2 薄度增强，但 Phase 3 多个 cap 需要）：

| 增强项 | 驱动 cap | 说明 |
|---|---|---|
| **shadcn-vue Table/Dialog primitive** | test-suite / api-automation / requirement-management / mcp-admin | 当前仅 button/card/input；列表+详情页普遍需 Table + Dialog。补到 `apps/web/components/ui/`。 |
| **`IsProjectOwner` 守卫** | requirement-management / mcp-admin | 现有 `IsProjectMember` 不够；需 owner 级守卫（复用 ProjectMember.role=owner）。 |
| **shared-types 扩展** | 全部 5 cap | `packages/shared-types/src/` 加 suite/api-case/requirement/chat/mcp-admin 的 DTO + StreamEnvelope 变体。 |
| **AuditLog 统一** | requirement-management / llm-chat / mcp-admin | 复用现有 `AuditLog` 模型 + audit 模块；每 cap 定义自己的 action 命名空间。 |

---

## 8. 迁移与模块落点

- **Prisma 迁移**：单一 `services/api/prisma/migrations/2_phase3_init/migration.sql`，含 5 cap 的表 + 现有表的轻量加列（TestCase.requirementVersionId、McpToolAllowlist 治理字段）。**不加 test-asset-management FK**（D8）。
- **后端模块**（`services/api/src/modules/`，每 cap 一个目录，遵循现有 controller/service/module 三件套）：
  - `test-suites/`
  - `api-automation/`（含 `api-credentials/` 子服务或同模块）
  - `requirements/`
  - `chat/`
  - 现有 `mcp/` 扩展为 mcp-admin（治理路由 + 拒绝谓词接管），不新建 `mcp-admin/` 目录。
- **app.module.ts**：注册 4 个新模块（test-suites / api-automation / requirements / chat），mcp 模块扩展。
- **前端页面**：`apps/web/pages/projects/[id]/` 加 `suites/`、`requirements/`、`chat/`、`mcp-admin/`；升级现有 `api-automation.vue`。

---

## 9. Clean-room 风险与缓解（Phase 3 专项）

| 风险 | 影响 cap | 缓解 |
|---|---|---|
| api-automation 误抄 HttpRunner DSL | C2 | 独立断言模型（kind+op+target+expected）；provenance note 必写；不引入 Config/Step/RunRequest/RunSqlRequest/extract/validate 语义 |
| UI step-config schema 误抄 | C2（若未来 UI 自动化资产 UI） | 基于 Playwright 原生 API 独立建模（本 roadmap 不含 UI step-config，因 UI 自动化资产 UI 是 P1 非门控项，不在 Phase 3 5 cap 内） |
| 提示词误抄 | C3/C4 | requirement content / chat system prompt 独立撰写；不引用 WHartTest 提示词文本 |
| 路由/布局误抄 | 全部 | 用 shadcn-vue（已与 WHartTest Arco Design 分歧）；路由路径可参考但布局独立 |
| durable LangGraph 诱惑 | C4 | chat 是会话级，状态在 DB message 表，非 graph checkpointer；f8-drift-scan 门禁 |
| RBAC creep | C3/C5 | 每 review/approve req 显式 "no new role"；Gate D 扫 role-creep；mcp-admin project-scoped 避免 global admin |
| single-source-of-truth drift | C5 | 拒绝谓词只在 mcp-admin；backend 引用不重述；集成测试断言 drift |
| Phase 3 实现先于 G3 MODIFIED | 全部 | CI/review 拒绝 G3 未落地前的实现 PR；G3 的 5 delta 是硬前置 |

---

## 10. 验收总表（Phase 3 整体完成判定）

| 项 | 命令/检查 | 期望 |
|---|---|---|
| G1 spec valid | `npx openspec validate fill-spec-gaps-phase3` | PASS |
| G2 归档 | `ls openspec/specs/` | 5 cap spec.md 已归档（+ 既有 10 cap） |
| G3 MODIFIED 落地 | `openspec validate fill-spec-gaps-modifieds` | PASS（5 delta） |
| 类型检查 | `pnpm -r typecheck` | 0 error |
| 后端单测 | `pnpm --filter @crab/api test` | 全 pass（含 5 cap 新增） |
| Web e2e | `pnpm --filter @crab/web test:e2e` | 全 pass |
| 迁移 | `pnpm --filter @crab/api db:migrate` | `2_phase3_init` 应用 |
| clean-room | `node infra/ci/clean-room-scan.mjs` | PASS（无 WHartTest 引用） |
| secret | `node infra/ci/secret-scan.mjs` | PASS（无明文泄漏） |
| drift | `node infra/ci/f8-drift-scan.mjs` | PASS（未引入 durable graph/BullMQ/interrupt） |
| provenance | 实现 PR 描述含 api-automation 独立实现路径说明 | 存在 |
| role-creep | `grep -rE "reviewer|approver|admin" services/api/src/modules/{requirements,mcp}` | 0 业务角色名（仅 owner/member） |

---

*本 roadmap 为纯文档，不含业务代码。实现须在 G1→G2→G3 门控全通过后，按 §1 顺序逐 cap 开 impl change。*
