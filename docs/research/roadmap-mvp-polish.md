# MVP-Polish 阶段路线图（P2 既有 cap 增强）

> 任务 #6 产物。主控：OMC team "crab-implementation-roadmap"，worker-1。
> 基线 commit：`39e759d`（crab-auto-test main，MVP + Phase 2 已落地）。
> 性质：**实现增强路线图**（.md only），不写业务代码。
> 来源：`docs/wharttest-parity-audit.md` §3.3 P2、`docs/wharttest-feature-checklist.md` 的 `[~]` 项、`.omc/research/crab-current-state.md` §3–4。

---

## 0. 概览（Overview）

本路线图覆盖 8 项 MVP-polish 增强，对应 `wharttest-feature-checklist.md` 中所有 `[~]`（部分实现/薄）且**位于已 committed OpenSpec capability 之内**的条目。它们不是 Phase-3 spec-gated 缺口，而是对已落地代码的厚度补强——把"已实现但比参考产品薄"的能力补到端到端可用。

| # | 增强项 | 所属 committed cap | checklist 域 |
|---|---|---|---|
| 1 | 测试用例思维导图视图 | `web-ui` R3 / `test-asset-management` R1 | 域 3 |
| 2 | AI 编辑/优化/修复既有用例 | `ai-test-generation` R1 | 域 3 |
| 3 | 真实 reranker + 多模态图片嵌入 | `knowledge-rag` R3/R4 | 域 6 |
| 4 | API Key 管理 UI | `platform-foundation` R3（worker-token 同源扩展） | 域 1 |
| 5 | shadcn-vue Table + Dialog 补全 | `web-ui` R2 | 域 16（MVP-FINISH-PLAN A2） |
| 6 | i18n 中英双语 | `web-ui` R1/R3 | 域 16 |
| 7 | 操作日志 UI + 保留期清理 | `platform-foundation` R4（audit） | 域 14 |
| 8 | 生产部署拓扑（超越本地 compose） | `clean-room-rebuild` R4（provenance）+ design.md 开放问题 | 域 15 |

### 排序建议（Ordering recommendation）

按依赖与杠杆排序，**不建议按上表序号执行**：

```
第 1 批（基础层，解锁后续 UI）：
  5. shadcn-vue Table + Dialog   ← 1/4/7 的列表/弹窗都依赖它
  6. i18n 中英双语                ← 越早接入越省返工；后续页面直接 $t()

第 2 批（测试资产生成与可视化，复用 5/6）：
  1. 思维导图视图                 ← 复用 Table 之外的树渲染，需 i18n 文案
  2. AI 编辑/优化/修复既有用例     ← 复用既有 AI run pipeline，UI 复用 ai-generation 面板

第 3 批（知识检索深化）：
  3. 真实 reranker + 多模态嵌入   ← 独立域，RetrievalBackend 接口不变

第 4 批（平台治理 UI）：
  4. API Key 管理 UI              ← 复用 Table + Dialog
  7. 操作日志 UI + 保留期清理     ← 复用 Table + 审计模块

第 5 批（基础设施，最后）：
  8. 生产部署拓扑                 ← 独立于应用代码，前置全量验证后部署
```

**建议执行序**：`5 → 6 → 1 → 2 → 3 → 4 → 7 → 8`。

### 门控说明（门控 / Spec gating）

**这 8 项均无需新增 OpenSpec change。** 理由：

- 它们全部落在已 committed 的 6 个 capability 之内（`web-ui`、`test-asset-management`、`ai-test-generation`、`knowledge-rag`、`platform-foundation`、`clean-room-rebuild`），这些 spec 已 `openspec validate` 通过（40 ADDED deltas，10 cap，全 valid）且代码已实现。
- 它们是**对既有 WHEN/THEN 场景的更完整满足**，而非新增绑定需求或改变需求语义。例如 `web-ui.2` SHALL "Tailwind + shadcn-vue 组件集"，补 Table/Dialog 是满足既有 SHALL，不是新需求。
- 它们**不是** Phase-3 spec-gated 项（`test-suite` / `api-automation` / `requirement-management` / `llm-chat` / `mcp-admin`）。那 5 项必须先 archive + 写新 change，与本路线图无关。
- 因此**无需 MODIFIED delta**。当前 `rebuild-ai-test-platform` change 未 archive，MODIFIED delta 在结构上非法（V-c）；本路线图不动 OpenSpec 状态。
- 若后续团队希望为某项补 edge-case 场景（如 reranker 失败回退、API Key 轮换审计），可在 archive 后作为独立 MODIFIED change 提交——**非阻塞**，不影响本路线图开工。

**clean-room 提醒**：参考产品 WHartTest 的实现细节（Arco 组件名、HttpRunner DSL、Django/DRF 模式、提示词文本、布局）**不得复制**。crab 用 shadcn-vue + NestJS + Prisma 独立实现。每项的安全门禁已标注 `clean-room-scan` 的位置。

---

## 1. 测试用例思维导图视图（Mind-map view）

### 范围 (Scope)
在 `web-ui` R3（primary testing workflows）与 `test-asset-management` R1（modules/cases/steps）之内。当前 `test-cases` 仅有列表视图（`apps/web/pages/projects/[id]/test-cases.vue`）。增强为**列表 + 思维导图双视图**：以模块树为骨架、用例为叶节点，支持拖拽整理（用例跨模块移动、模块重排）。视图切换不改变底层数据，仅渲染形态。

### 数据模型 (Data model)
**无新模型，无 schema 变更。** 思维导图是既有 `Module`（树）+ `TestCase`（挂在 moduleId 下）的视图投影。可选（非必需）：在用户/项目偏好上加一个 `defaultTestCaseViewMode`（list | mindmap）偏好字段——若加，作为通用 `UserPreference` 键值对，不专为本特性建表。拖拽重排通过 PATCH 既有 `TestCase.moduleId` / `Module.parentId` 实现，无新字段。

### API (Routes)
复用既有端点，**仅可选新增一个聚合端点**：
- `GET /api/v1/projects/:id/modules`（既有，返回模块树）
- `GET /api/v1/projects/:id/test-cases`（既有，返回用例列表）
- `PATCH /api/v1/projects/:id/test-cases/:caseId`（既有，更新 moduleId 实现拖拽移动）
- `PATCH /api/v1/projects/:id/modules/:moduleId`（既有，更新 parentId 实现模块重排）
- （可选新增）`GET /api/v1/projects/:id/test-cases/mindmap` — `GET`，单次返回嵌套树（模块 + 挂载用例），减少前端多请求；纯聚合，无副作用。

### UI 页面 (Pages)
- Nuxt 页面：`/projects/[id]/test-cases`（既有页面增强）
- 新增组件：
  - `TestCaseViewToggle.vue` — list/mindmap 切换器（持久化偏好到 localStorage）
  - `TestCaseMindmap.vue` — 思维导图渲染器（Vue3），基于既有模块树 + 用例构建嵌套节点；选用与 Vue3 兼容的树/图渲染方案（如自绘 SVG 树、或包装 `vue-flow` / d3-hierarchy 之类无版权风险的库），**不得**引入参考产品的 Arco 树组件
  - 拖拽交互：用例节点拖到另一模块节点 → 调 `PATCH test-cases/:id`（moduleId）；模块节点拖拽改父 → 调 `PATCH modules/:id`（parentId）
- 列表视图复用第 5 项的 Table 组件。

### 测试策略 (Test strategy)
- 后端单元（若新增 mindmap 聚合端点）：纯函数 `buildMindmapTree(flatModules, flatCases)` → 嵌套树；含空树、孤立用例、深嵌套场景
- Web e2e（`apps/web/tests/e2e/`）：切换到思维导图视图 → 断言模块节点 + 用例节点渲染；拖拽用例到另一模块 → 断言 PATCH 调用 + 树更新；切回列表视图数据一致
- 视觉/快照：思维导图基础布局快照

### 安全门禁 (Security gate)
`clean-room-scan`（确保思维导图渲染器为 crab 独立实现，未抄参考产品的树组件/布局；`infra/ci/clean-room-scan.mjs`）。

### 验收命令 (Acceptance command)
```bash
pnpm --filter @crab/web build
pnpm --filter @crab/web test:e2e
node infra/ci/clean-room-scan.mjs
```

---

## 2. AI 编辑/优化/修复既有用例（AI edit/optimize/fix）

### 范围 (Scope)
在 `ai-test-generation` R1（generate structured cases）之内。当前 AI 流程仅"从需求生成新用例 + 审批"。增强为：对**既有** TestCase 发起 AI 修改——三种意图：`edit`（按自然语言指令改）、`optimize`（结构/可读性优化）、`fix`（针对已知缺陷修复）。复用既有生成 pipeline（RAG → 草稿 → 校验 → 增强 → 审批软停止 → accept 持久化），仅改输入种子与提示词框架。

### 数据模型 (Data model)
**无新模型。** 复用既有 AI run 实体 + TestCase。Prose 描述字段补充（不写 .prisma）：
- 在既有 AI run 实体上加一个 `mode` 鉴别字段（枚举：`generate` | `edit` | `optimize` | `fix`），默认 `generate` 保持向后兼容
- 加一个可选 `targetCaseId` 外键，指向被修改的 TestCase（generate 模式为空）
- accept 时：generate 模式新建 TestCase（既有幂等 by runId+title），edit/optimize/fix 模式**更新**既有 TestCase（按 caseId），旧值进入审计日志
- 可选（非必需）：TestCase 软版本历史——若要可回滚，加 `previousVersionId` 指针，但最小实现可直接更新 + 审计捕获前后值

### API (Routes)
复用既有 AI pipeline，**不新增端点，扩展请求体**：
- `POST /api/v1/projects/:id/ai/test-generation`（既有）— body 扩展：`{ requirement?, mode, targetCaseId?, intent? }`；mode=generate 时行为不变
- `GET /api/v1/ai/runs/:id/stream`（既有，SSE）
- `GET /api/v1/ai/runs/:id/snapshot`（既有）
- `POST /api/v1/ai/runs/:id/approve`（既有）— accept 时按 mode 决定新建 vs 更新
- `POST /api/v1/ai/runs/:id/reject`（既有）

### UI 页面 (Pages)
- Nuxt 页面：`/projects/[id]/test-cases/[caseId]`（用例详情，既有或新增）
- 新增/增强组件：
  - 在用例详情页加"AI 编辑 / 优化 / 修复"三个动作按钮
  - 复用既有 `ai-generation` 面板组件，绑定 `targetCaseId` + `mode`，展示 SSE 步骤、草稿 diff、accept/reject
  - `TestCaseDiff.vue` — 展示既有用例 vs AI 草稿的差异（字段级）

### 测试策略 (Test strategy)
- 后端单元（`services/api/test/`）：状态机测试——edit 模式以既有 case 内容为种子产出草稿；approve 更新既有 case（非新建）；幂等 by runId+caseId；reject 不改既有 case
- 校验有界重试（MUST-2）在 edit 模式同样生效
- Web e2e：建用例 → 触发优化 → approve → 断言用例已更新（字段变化 + 审计记录）

### 安全门禁 (Security gate)
`f8-drift-scan`（确保未引入 durable LangGraph checkpointer / `interrupt()`——必须保持状态机，`infra/ci/f8-drift-scan.mjs`）；`secret-scan`（LLM provider 凭证不外泄）。

### 验收命令 (Acceptance command)
```bash
pnpm --filter @crab/api test
node infra/ci/f8-drift-scan.mjs
node infra/ci/secret-scan.mjs
```

---

## 3. 真实 reranker + 多模态图片嵌入（Real reranker + multimodal embeddings）

### 范围 (Scope)
在 `knowledge-rag` R3（embed + retrievable）与 R4（RAG w/ attribution）之内。当前 `infra/retrieval/` 的 `RetrievalBackend` 接口有 stub reranker，嵌入仅文本。增强：接入真实 reranker 模型（经 `model-providers` 配置，复用 envelope 加密凭证）+ 图片嵌入路径（多模态文档/截图入库可检索）。**保持 `RetrievalBackend` 接口可换性不变**（R3 swappability 不变量）。

### 数据模型 (Data model)
扩展现有 KnowledgeDocument / Chunk。Prose 描述（不写 .prisma）：
- 在 Chunk 实体上加可选 `imageEmbedding` 向量列（与文本嵌入向量并列，pgvector raw SQL，因 Prisma 无原生 vector 类型——R9 friction）
- 加 `modality` 鉴别字段（`text` | `image` | `mixed`）
- 在 KB 配置或 model-provider 配置上加：`rerankerProviderRef` + `rerankerModel`、`imageEmbeddingProviderRef` + `imageEmbeddingModel`——均复用既有 model-provider 的 envelope 加密凭证（R5），不新增凭证存储
- 文档解析阶段：含图文档抽取图片 → 生成图片嵌入 → 存 `imageEmbedding`；文本块照旧
- 检索阶段：query 可指定 `modality` 提示；候选召回后过 reranker 精排，分数写入既有 `sourceAttribution`

### API (Routes)
- `POST /api/v1/projects/:id/retrieval/query`（既有）— body 扩展 `modality?`；返回结果按 reranker 分数排序
- `POST /api/v1/projects/:id/knowledge-bases/:kbId/reranker/test`（新增）— 连接测试，镜像 `model-providers/:id/validate` 模式，不返回 secret
- `POST /api/v1/projects/:id/knowledge-bases/:kbId/embeddings/test`（新增）— 嵌入模型连接测试
- 既有 KB CRUD / 文档上传端点不变

### UI 页面 (Pages)
- Nuxt 页面：`/projects/[id]/knowledge/[kbId]/settings`（KB 设置，新增或增强）
- 组件：
  - `RerankerConfig.vue` — 选择 reranker provider/model + 测试按钮
  - `ImageEmbeddingConfig.vue` — 选择图片嵌入 provider/model + 测试按钮
  - KB 文档列表加 `modality` 徽章（文本/图片/混合）
  - 分块查看器（可选）展示 chunk modality

### 测试策略 (Test strategy)
- 后端单元（`services/api/test/retrieval.spec.ts` 扩展）：`RetrievalBackend` 接口一致性——reranker 按分数重排；图片嵌入路径产出向量；stub adapter 仍可换（swappability 不破坏）
- 集成（CI pgvector 服务容器）：`POST /retrieval/query` 返回 reranked 结果；图片文档入库后可被图片 query 召回
- 诊断端点（既有 `POST /retrieval/query`）返回 reranker 分数

### 安全门禁 (Security gate)
`secret-scan`（provider 凭证永不返回，redaction 覆盖）；`f8-drift-scan`（`RetrievalBackend` 接口保留，不得硬换 Qdrant 破坏 swappability——Qdrant 仍为可选 adapter，非强制）；`clean-room-scan`。

### 验收命令 (Acceptance command)
```bash
pnpm --filter @crab/api test
node infra/ci/secret-scan.mjs
node infra/ci/f8-drift-scan.mjs
node infra/ci/clean-room-scan.mjs
```

---

## 4. API Key 管理 UI（API Key management）

### 范围 (Scope)
在 `platform-foundation` R3（worker-token）之内，同源扩展为项目级 API Key。当前仅有 worker-token 后端服务（`auth/worker-token.service.ts`），无前端签发/吊销 UI。增强：项目 owner 可在 UI 签发、列出、吊销、轮换项目 API Key，供外部/程序化访问（带 scope 与过期）。鉴权中间件扩展为接受 `X-Api-Key` 头（与既有 JWT / worker-token 并列）。

### 数据模型 (Data model)
新增实体 `ProjectApiKey`。Prose 描述（不写 .prisma）：
- 字段：`id`、`projectId`（外键）、`name`（人类可读）、`hashedKey`（仅存哈希，创建时返回明文一次，永不持久化明文——镜像 worker-token 模式）、`scopes`（如 `read:test-case`、`write:execution` 的字符串数组）、`expiresAt`、`createdAt`、`createdBy`、`revokedAt`（可空）、`lastUsedAt`（可空）
- 关系：一个 Project 多个 ProjectApiKey（一对多）
- 鉴权：请求带 `X-Api-Key` → 哈希 → 常数时间比对 `hashedKey` → 校验未吊销/未过期 → 注入 project + scope 上下文
- 不存明文，不记日志明文（redaction 覆盖）

### API (Routes)
- `GET /api/v1/projects/:id/api-keys`（新增）— 列出（masked，仅显示 name/lastUsed/expires，不返回 key）
- `POST /api/v1/projects/:id/api-keys`（新增）— 签发，**响应体唯一一次返回明文 key**
- `DELETE /api/v1/projects/:id/api-keys/:keyId`（新增）— 吊销（置 revokedAt）
- `POST /api/v1/projects/:id/api-keys/:keyId/rotate`（新增）— 轮换：作废旧 key + 返回新明文一次
- 鉴权中间件扩展：接受 `X-Api-Key` 头，project-scoped

### UI 页面 (Pages)
- Nuxt 页面：`/projects/[id]/settings/api-keys`（新增）
- 组件：
  - API Key 列表（复用第 5 项 Table）：name、scopes、lastUsedAt、expiresAt、状态
  - 创建 Dialog（复用第 5 项 Dialog）：name + scopes 多选 + expiry 选择
  - "明文仅显示一次"横幅 + 复制按钮（创建/轮换后）
  - 吊销确认 Dialog + 轮换按钮

### 测试策略 (Test strategy)
- 后端单元（`services/api/test/`）：
  - 签发返回明文一次，DB 仅存哈希
  - 常数时间比对（safeEqual）
  - 吊销 key 被拒、过期 key 被拒、scope 不足被拒
  - 轮换后旧 key 失效、新 key 可用
- Web e2e：签发 key → 用 key 调 scoped 端点成功 → 吊销 → 再调被拒

### 安全门禁 (Security gate)
`secret-scan`（无明文 key 入日志/DB，redaction 覆盖 `X-Api-Key` 头与响应体）；`clean-room-scan`。

### 验收命令 (Acceptance command)
```bash
pnpm --filter @crab/api test
node infra/ci/secret-scan.mjs
pnpm --filter @crab/web build
```

---

## 5. shadcn-vue Table + Dialog 组件补全

### 范围 (Scope)
在 `web-ui` R2（Tailwind + shadcn-vue）之内。当前 `apps/web` 仅安装 button/card/input 三件 shadcn-vue 原语（见 `crab-current-state.md` §3）。MVP-FINISH-PLAN A2 目标：补全 **Table + Dialog**。这是基础层增强——解锁第 1/4/7 项的列表与弹窗。注意：`nuxt.config.ts` 当前混装了 `@arco-design/web-vue` 插件（审计遗留），本项应**移除 Arco 依赖、纯走 shadcn-vue（radix-vue 原语）**，闭合 clean-room 分歧。

### 数据模型 (Data model)
**无。** 纯前端原语，消费既有列表端点。

### API (Routes)
**无新增。** 消费既有 `GET /projects/:id/test-cases`、`/executions`、`/audit`、`/api-keys` 等列表端点。

### UI 页面 (Pages)
- 新增 shadcn-vue 组件目录 `apps/web/components/ui/table/`（Table、TableHeader、TableBody、TableRow、TableCell、TableHead、TableCaption）与 `apps/web/components/ui/dialog/`（Dialog、DialogContent、DialogHeader、DialogTitle、DialogDescription、DialogFooter、DialogTrigger）——按 shadcn-vue 官方 radix-vue 模式生成
- 改造既有页面替换临时列表为 Table：`/projects/[id]/test-cases`、`/projects/[id]/executions`、`/projects/[id]/settings/*`
- 改造既有确认/创建流为 Dialog
- 移除 `nuxt.config.ts` 的 Arco 插件 + `@arco-design/web-vue` 依赖

### 测试策略 (Test strategy)
- Web e2e：列表 Table 渲染 API 行；Dialog 打开/关闭/焦点陷阱（a11y）；表单提交
- 视觉快照：Table + Dialog 基础形态
- 构建检查：`pnpm --filter @crab/web build` 无 Arco 残留引用

### 安全门禁 (Security gate)
`clean-room-scan`（确保 Table/Dialog 来自 shadcn-vue radix-vue 原语，非参考产品 Arco 的 table/modal 组件；Arco 依赖彻底移除）。

### 验收命令 (Acceptance command)
```bash
pnpm --filter @crab/web build
pnpm --filter @crab/web test:e2e
node infra/ci/clean-room-scan.mjs
```

---

## 6. i18n 中英双语（Bilingual zh/en）

### 范围 (Scope)
在 `web-ui` R1（Nuxt3+Vue3+TS）与 R3（primary testing workflows）之内。当前 crab 未确认有完整双语（design.md 将"first-class language zh/en/bilingual"列为开放问题）。增强：全站中英双语资源 + 切换器 + 偏好持久化。**仅前端字符串**；后端返回错误码，前端映射为本地化文案（不改后端契约）。

### 数据模型 (Data model)
**无新模型。** 前端 only。可选（非必需）：用户偏好 `locale` 存 cookie/localStorage；若要服务端持久化，作为通用 `UserPreference` 键值，不专建表。

### API (Routes)
**无新增。** 后端返回错误码（既有），前端 i18n 映射。

### UI 页面 (Pages)
- 集成 `@nuxtjs/i18n`（或 `vue-i18n`）到 `apps/web`
- 资源文件：`apps/web/locales/zh.json`、`apps/web/locales/en.json`
- 全局 locale 切换器（header 组件）
- 所有既有页面文案改为 `$t('...')`——login、projects、test-cases、ai-generation、executions、knowledge、settings
- 默认 locale（zh 或 en，按 design.md 开放问题决策——建议默认 zh，可切 en）

### 测试策略 (Test strategy)
- i18n lint：每个 `$t()` key 在 zh/en 两个 bundle 都存在（无 missing key）
- Web e2e：切换 locale → 断言关键字符串变化；偏好持久化（刷新后保持）
- 构建检查：两 locale 均可构建

### 安全门禁 (Security gate)
`clean-room-scan`（locale 文案为 crab 独立撰写，不抄参考产品文案）；`secret-scan`（locale 文件不含密钥）。

### 验收命令 (Acceptance command)
```bash
pnpm --filter @crab/web build
pnpm --filter @crab/web test:e2e
node infra/ci/clean-room-scan.mjs
```

---

## 7. 操作日志 UI + 保留期清理配置（Operation-log UI + retention cleanup）

### 范围 (Scope)
在 `platform-foundation` R4（audit）之内。当前 `audit` 模块记录日志（`GET /audit`）但无前端 UI、无保留期配置、无清理任务。增强：操作日志 UI（可筛选）+ 保留期配置 + 定时/手动清理任务。

### 数据模型 (Data model)
复用既有 `AuditLog` 实体。Prose 描述（不写 .prisma）：
- 既有 AuditLog 字段（actor、action、target、timestamp、metadata 等）不变
- 新增通用 `SystemSetting` 键值实体（若无）——存 `audit.retentionDays`（整数，默认如 90）
- 清理任务：删除 `createdAt < now - retentionDays` 的 AuditLog 行；幂等；记录清理执行本身为审计事件
- 可选（非必需）：AuditLog 加 `projectId` 索引以支持项目级筛选（若既有 schema 已有则免）

### API (Routes)
- `GET /api/v1/audit`（既有）— 扩展 query：`actor`、`action`、`target`、`dateFrom`、`dateTo`、`projectId`、分页
- `GET /api/v1/settings/audit`（新增）— 读保留期配置
- `PUT /api/v1/settings/audit`（新增）— 写保留期配置（owner-only）
- `POST /api/v1/audit/cleanup`（新增）— 手动触发清理（owner-only），返回删除行数
- 内部定时任务（NestJS scheduler 或外部 cron）按配置周期执行清理

### UI 页面 (Pages)
- Nuxt 页面：`/projects/[id]/audit`（新增）或 admin 级 `/audit`
  - 操作日志表格（复用第 5 项 Table）：actor、action、target、时间、metadata；支持筛选 + 分页
- Nuxt 页面：`/projects/[id]/settings/audit`（新增）
  - 保留期天数配置 + 保存
  - "立即清理"按钮 + 确认 Dialog（复用第 5 项 Dialog）+ 清理结果展示

### 测试策略 (Test strategy)
- 后端单元（`services/api/test/`）：清理任务删除超期行、保留近期行、幂等（重复执行无副作用）、retentionDays=0 边界
- 筛选：actor/action/target/date 过滤正确
- Web e2e：执行若干操作 → 审计页筛选可见 → 设保留期 → 触发清理 → 旧行消失
- redaction：审计 UI 不展示被 redact 的密钥（既有 `redact.spec.ts` 覆盖）

### 安全门禁 (Security gate)
`secret-scan`（审计展示前过 redaction）；`r7-import-scan`（无禁用 import 模式）；`clean-room-scan`。

### 验收命令 (Acceptance command)
```bash
pnpm --filter @crab/api test
node infra/ci/secret-scan.mjs
node infra/ci/r7-import-scan.mjs
```

---

## 8. 生产部署拓扑（Production deploy topology）

### 范围 (Scope)
在 `clean-room-rebuild` R4（provenance）与 design.md 开放问题（部署目标：Docker Compose / VPS / K8s / managed cloud）之内。当前 crab 仅有本地 `docker-compose.yml`（pgvector + 单后端 + 单前端 dev）。增强：定义超越本地 compose 的生产拓扑——多服务编排、env 驱动配置、健康检查、日志轮转、可选 Helm/K8s。**不引入 BullMQ / 外部 secret manager / 分布式 worker 池**（永久非目标，R1/R2/R5/R8）。

### 数据模型 (Data model)
**无新业务模型。** infra only。配置经环境变量 / `.env.production` / values 文件。

### API (Routes)
**无新增。** 复用既有 API；生产拓扑仅改打包/部署形态。

### UI 页面 (Pages)
**无前端页面。** 产物为 infra 文件 + ops 文档（README/部署说明）。

### 测试策略 (Test strategy)
- 配置 lint：`docker compose -f docker-compose.prod.yml config --services` 校验多服务编排合法
- 环境变量校验：缺失关键 env（如 `MASTER_KEY`、`DATABASE_URL`、`JWT_SECRET`）时启动失败且报错清晰
- 冒烟（staging）：生产 compose 起来 → migrate → seed → 登录 → 建项目 → 跑一次 AI 生成（或 deterministic fallback）→ 断言端到端
- 健康检查：`GET /api/v1/health`（若无则新增轻量端点）返回依赖状态
- 日志轮转：per-app log + rotating handler（design.md 提及）

### 安全门禁 (Security gate)
`secret-scan`（compose/env/values 文件不含明文密钥，用占位符 + 运行时注入）；`clean-room-scan`；`f8-drift-scan`（不得引入 BullMQ 作为 worker 传输、不得引入外部 secret manager、不得回退 credentialRef→secret-store 模式——保持 R2/R5 不变量）。

### 验收命令 (Acceptance command)
```bash
docker compose -f docker-compose.prod.yml config --services
node infra/ci/secret-scan.mjs
node infra/ci/clean-room-scan.mjs
node infra/ci/f8-drift-scan.mjs
```

---

## 附录：能力 cap 映射

| 增强项 | 主要 committed cap | 满足的既有 requirement |
|---|---|---|
| 1 思维导图 | `web-ui` / `test-asset-management` | web-ui R3（primary workflows）/ test-asset R1（modules/cases） |
| 2 AI 编辑/优化/修复 | `ai-test-generation` | R1（generate structured cases，扩展到既有 case） |
| 3 reranker + 多模态 | `knowledge-rag` | R3（embed+retrievable）/ R4（RAG w/ attribution） |
| 4 API Key UI | `platform-foundation` | R3（worker-token 同源扩展） |
| 5 Table + Dialog | `web-ui` | R2（Tailwind + shadcn-vue 组件集） |
| 6 i18n | `web-ui` | R1（Nuxt3+Vue3+TS）/ R3（workflows 本地化） |
| 7 操作日志 UI + 清理 | `platform-foundation` | R4（audit） |
| 8 生产部署 | `clean-room-rebuild` | R4（provenance）+ design.md 部署目标 |

## 附录：CI 门禁速查

| 门禁脚本 | 路径 | 适用项 |
|---|---|---|
| `clean-room-scan` | `infra/ci/clean-room-scan.mjs` | 1, 3, 4, 5, 6, 7, 8（防抄参考产品） |
| `secret-scan` | `infra/ci/secret-scan.mjs` | 2, 3, 4, 6, 7, 8（密钥/凭证不外泄） |
| `f8-drift-scan` | `infra/ci/f8-drift-scan.mjs` | 2, 3, 8（不引入 durable checkpointer / BullMQ / 外部 secret manager） |
| `r7-import-scan` | `infra/ci/r7-import-scan.mjs` | 7（无禁用 import） |
| `skill-adapter-scan` | `infra/ci/skill-adapter-scan.mjs` | （本路线图 8 项不直接触及 skill 适配器，但若实现中改 skill 包装须跑） |

---

*本路线图为实现增强指引，非绑定需求。所有 8 项均位于已 committed OpenSpec capability 之内，无需新增 spec change。实现时遵循 crab 自身 `AGENTS.md` + `design.md §11` 永久非目标。*
