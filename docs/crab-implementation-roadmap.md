# crab-auto-test 实现路线图（Implementation Roadmap）

> 顶层路线图，统一 MVP-polish / Phase 3 / Phase 4 三阶段。
> 主控：OMC team "crab-implementation-roadmap"。基线 commit：`39e759d`（main）。
> 性质：**纯规划文档，不含业务代码**。OpenSpec 是唯一绑定需求源。
> 子文档（研究底稿，位于 `.omc/research/`，未提交）：
> - `roadmap-mvp-polish.md` — 8 项 P2 增强逐项 7 维度
> - `roadmap-phase3.md` — 5 cap 逐项 7 维度 + 门控
> - `roadmap-phase4.md` — 8 候选项 + 永久非目标闭合
>
> 关联文档（已提交于 `docs/`）：
> - `wharttest-parity-audit.md` — 差距审计
> - `wharttest-feature-checklist.md` — 功能完整性评判清单
> - `research/` — WHartTest/crab 能力调研

---

## 0. 全局视图

| 阶段 | 状态 | OpenSpec 门控 | 含新 cap | 性质 |
|---|---|---|---|---|
| **MVP-polish** | 可立即开工 | 无需新 spec（全在 committed 10 cap 内） | 否 | 既有代码厚度补强 |
| **Phase 3** | spec 已写（`fill-spec-gaps-phase3`），实现被门控阻塞 | G1✅ / G2⏳ / G3⏳ | 5 新 cap | spec-first gated |
| **Phase 4** | 无 committed spec，纯前瞻框架 | 每项须独立起 change | 候选 | 不可执行 |

### 不变量基线（三阶段共享，违反即拒）
- **simple-roles**：仅 owner/member，无 reviewer/approver/admin/global-admin
- **backend-owns-orchestration**：LLM/MCP 调用仅在 NestJS 后端
- **clean-room**：不复制 WHartTest 源码/素材/文案/样式/提示词/精确布局/API 实现细节
- **R1** 不引入 durable LangGraph checkpointer / `interrupt()`
- **R2** 不引入 BullMQ 作为 worker 传输
- **R5** 不引入外部 secret manager（用平台 envelope 加密）
- **R8** 不引入服务端事件重放缓冲（用 snapshot 重取）

---

## 1. MVP-polish（P2 增强，可立即开工）

**8 项**，全部在已 committed cap 内，**无需新 OpenSpec**。建议执行序：`5 → 6 → 1 → 2 → 3 → 4 → 7 → 8`（Table/Dialog + i18n 先做基础层，解锁后续列表/弹窗）。

| 序 | 增强项 | committed cap | 执行批次 |
|---|---|---|---|
| 5 | shadcn-vue Table + Dialog 补全（移除 Arco 残留） | web-ui R2 | 基础层 1 |
| 6 | i18n 中英双语 | web-ui R1/R3 | 基础层 1 |
| 1 | 测试用例思维导图视图 | web-ui R3 / test-asset R1 | 批次 2 |
| 2 | AI 编辑/优化/修复既有用例 | ai-test-generation R1 | 批次 2 |
| 3 | 真实 reranker + 多模态图片嵌入 | knowledge-rag R3/R4 | 批次 3 |
| 4 | API Key 管理 UI（项目级，envelope 哈希） | platform-foundation R3 | 批次 4 |
| 7 | 操作日志 UI + 保留期清理 | platform-foundation R4 | 批次 4 |
| 8 | 生产部署拓扑（超越本地 compose） | clean-room-rebuild R4 | 批次 5 |

每项的 7 维度（范围/数据模型/API/UI/测试策略/安全门禁/验收命令）见 `.omc/research/roadmap-mvp-polish.md`。

**关键 clean-room 点**：第 5 项须移除 `nuxt.config.ts` 的 `@arco-design/web-vue` 插件（审计遗留），纯走 shadcn-vue radix-vue 原语，闭合分歧。

---

## 2. Phase 3（5 新 cap，spec-first gated）

OpenSpec 已完成：`openspec/changes/fill-spec-gaps-phase3/`（5 cap × 3 reqs = 15 ADDED，`openspec validate` PASS）。

### 2.1 三道硬门控（实现前必须全通）

| 门控 | 内容 | 当前状态 |
|---|---|---|
| **G1** | `fill-spec-gaps-phase3` 通过 validate | ✅ 已完成 |
| **G2** | `openspec archive rebuild-ai-test-platform`（填充 `openspec/specs/`） | ⏳ 未归档 |
| **G3** | `fill-spec-gaps-modifieds` 落地 5 个 MODIFIED/ADDED delta | ⏳ 未创建（依赖 G2） |

**G3 的 5 个 delta**（须 prior change 归档后才能写 MODIFIED）：
1. `web-ui` ADDED R4/R5/R6 — chat / mcp-admin / api-automation 三路由
2. `backend-ai-orchestration` MODIFIED R3 — 引用 mcp-admin allowlist（不重述拒绝谓词）
3. `ai-test-generation` MODIFIED R1 — approved requirement 作可选输入 + 回链 version
4. `clean-room-rebuild` ADDED R5 — 非目标提升显式化（R3 原文不动）
5. `test-asset-management` — 仅索引/约束（test-suite 自包含 SuiteRun，无 FK 变更）

> **G3 未落地前，任何 Phase 3 实现 PR 都应被 CI/review 拒绝。**

### 2.2 实现顺序（tasks.md 11.8）

```
test-suite → api-automation → requirement-management → llm-chat → mcp-admin
```

mcp-admin 最后，因其 owns 拒绝谓词，backend-ai-orchestration MODIFIED R3 依赖它。

| cap | spec ref | 数据模型要点 | clean-room 风险 |
|---|---|---|---|
| **test-suite** | R1–R3 | 自包含 SuiteRun（持 execution-record ID 列表，**不加 test-asset FK** — D8） | 低（独立设计） |
| **api-automation** | R1–R3 | ApiCase + 扁平断言 `{kind,op,target,expected}` + ApiCredential(envelope) | **最高**（防镜像 HttpRunner DSL） |
| **requirement-management** | R1–R3 | Requirement + RequirementVersion + TestCase 回链 | 中（防抄提示词/DOCX 编辑器） |
| **llm-chat** | R1–R3 | ChatSession/ChatMessage + audit（会话级，无 tool-calling） | 中（防 durable graph 诱惑） |
| **mcp-admin** | R1–R3 | 复用 McpToolAllowlist + McpToolCall，加治理字段 | 中（守 single-source-of-truth） |

每 cap 的 7 维度 + 迁移 `2_phase3_init` + 模块落点见 `.omc/research/roadmap-phase3.md`。

### 2.3 最高 clean-room 风险：api-automation

- **不引入** HttpRunner 的 Config/Step/RunRequest/RunSqlRequest/extract/validate DSL 语义
- 断言用扁平 `kind+op+target+expected`，独立设计
- credential 全部 envelope-encrypted reference，API 响应永不返回明文
- 实现 PR **必含 provenance note**（R3 场景）说明独立实现路径

### 2.4 Phase 3 整体验收（判定完成）

| 项 | 命令 | 期望 |
|---|---|---|
| G1 spec valid | `npx openspec validate fill-spec-gaps-phase3` | PASS |
| G3 MODIFIED valid | `npx openspec validate fill-spec-gaps-modifieds` | PASS |
| 类型检查 | `pnpm -r typecheck` | 0 error |
| 后端单测 | `pnpm --filter @crab/api test` | 全 pass |
| Web e2e | `pnpm --filter @crab/web test:e2e` | 全 pass |
| 迁移 | `pnpm --filter @crab/api db:migrate` | `2_phase3_init` 应用 |
| clean-room | `node infra/ci/clean-room-scan.mjs` | PASS |
| secret | `node infra/ci/secret-scan.mjs` | PASS |
| drift | `node infra/ci/f8-drift-scan.mjs` | PASS |
| role-creep | `grep -rE "reviewer\|approver\|admin" services/api/src/modules/{requirements,mcp}` | 0 业务角色名 |

---

## 3. Phase 4（前瞻框架，不可执行）

**无 committed spec**。每项候选若推进，**必须先独立撰写并批准一个 OpenSpec change**。Phase 3 落地前不启动。

8 候选项（每项 5 维度见 `.omc/research/roadmap-phase4.md`）：
1. 分布式 API 执行 worker 池（非 BullMQ 传输；**非**远程 Playwright）
2. 自动 MCP 工具发现（discovery ≠ authorization；allowlist 谓词不变）
3. 跨项目需求复用（owner/member only，无跨项目 admin）
4. 多 provider chat fan-out（状态机 only，无 durable graph）
5. Chat tool-calling / 多步（**须先 MODIFIED backend-ai-orchestration R2**，最高风险）
6. Suite 执行拓扑（本地 Electron only，无分布式 UI）
7. API 执行器（backend-side HTTP runner 选项，最高 DSL 镜像风险）
8. Chat session scope（per-user vs per-project-default）

### 永久非目标（不闭合，clean-room 设计取舍）

| 非目标 | 为何不闭合 |
|---|---|
| 企业微信集成 | 产品方向分歧，clean-room 永久非目标 |
| 复杂 RBAC / 权限矩阵 / 自定义角色 | simple-roles 不变量，仅 owner/member |
| 全在线 DOCX 编辑器 | 全文档编辑器非目标 |
| 分布式 UI 执行 / 远程 Playwright worker 池 | 仅本地 Electron worker |
| 平台全局 MCP 工具 + 全局 admin 审批角色 | MCP 仅项目级 |
| 独立 FastMCP 服务 / MS 平台桥接 | 架构分歧，MCP 内嵌 NestJS |

---

## 4. 推进顺序总览

```
现在 ──► MVP-polish（8 项，可立即开工，无需新 spec）
            │
            ▼
       openspec archive rebuild-ai-test-platform  ◄── G2（你决定时机）
            │
            ▼
       fill-spec-gaps-modifieds（5 MODIFIED/ADDED）  ◄── G3
            │
            ▼
       Phase 3 实现（test-suite → api-automation → requirement-management → llm-chat → mcp-admin）
            │
            ▼
       Phase 4（每项独立起 OpenSpec change 后才可执行）
```

**当前最阻塞的单一动作**：决定是否 `openspec archive rebuild-ai-test-platform`（G2，不可逆）以解锁 G3 → Phase 3 实现。MVP-polish 不受此阻塞，可并行推进。

---

## 5. 验证证据（本路线图生成时）

| 项 | 命令 | 结果 |
|---|---|---|
| Phase 3 spec valid | `openspec validate fill-spec-gaps-phase3` | ✅ `Change 'fill-spec-gaps-phase3' is valid` |
| Phase 3 spec 规模 | 5 cap × 3 reqs | ✅ 15 ADDED, 24 scenarios, 0 MODIFIED |
| clean-room scan | `node infra/ci/clean-room-scan.mjs` | ✅ `CLEAN-ROOM PASS` |
| 现有模块（实现参考） | `ls services/api/src/modules` | 11 模块 |
| 现有 Prisma 模型 | `grep ^model schema.prisma` | 21 模型 |
| 现有迁移 | `ls prisma/migrations` | `0_init` + `1_phase2_init`（Phase 3 加 `2_phase3_init`）|

**未验证项（诚实声明）**：
- G2 归档未执行（不可逆，留给你决定）
- G3 第三 change 未创建（依赖 G2）
- Phase 3 实现代码未写（被门控阻塞，本轮只规划）

---

*本路线图为实现指引，非绑定需求。OpenSpec 是唯一绑定需求源。实现时遵循 crab 自身 `AGENTS.md` + `design.md §11` 永久非目标。*
