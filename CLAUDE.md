# CLAUDE.md — crab-auto-test 项目规则

> Claude Code 在本仓库工作时的强制规则。后续所有会话和模块自动遵循。

---

## R-INTENT-01：全量补齐 WHartTest 产品意图

WHartTest（`D:\code\auto-test\WHartTest`）是产品意图源头，crab-auto-test 是新架构实现。每个模块必须真正达到 WHartTest 的产品意图，**不接受降级简化**。

- 每个模块在 `team-plan` 阶段必须做 WHartTest 业务意图对比表（业务对象 / 状态机 / 信息架构 / 用户真实使用路径），发现偏差要么补齐要么显式记录范围外原因。
- 当「不新增依赖」硬规则与「全量补齐 WHartTest 意图」冲突时，**产品意图优先**。可新增合理依赖，leader 必须在 commit message 或 plan 中记录原因。
- **不复制** WHartTest 的源码、DSL、提示词、素材、具体文案、具体样式表达。
- **只迁移** 业务流程、状态机、信息架构、模块边界、用户路径意图。
- AI 能力必须复用 crab-auto-test 自有 LLM 通道（`LlmDraftService` / `ChatOpenAI` + zod structured output），提示词自写。
- 提示词和评审维度文案必须内化重写（例如不直接搬 WHartTest「规范性/清晰度/完整性/一致性」原话，改用自命名维度）。

---

## R-INTENT-02：模块通用工作流

每个模块按统一节奏推进：

1. **team-plan**：读 WHartTest 对应业务模块的 docs / 产品描述，提取业务意图。做对比表，发现偏差立即停下返工。
2. **team-exec**：按 plan 实现，复用现有代码（LlmDraftService / shadcn-vue / Tailwind / 现有 service 模式）。
3. **team-verify**：5 条验证命令必须全绿才能 commit：
   - `pnpm --filter @crab/api test`
   - `pnpm -r typecheck`
   - `pnpm --filter @crab/web test:e2e -- tests/e2e/<module>.spec.ts`
   - `git diff --check`
   - `node infra/ci/secret-scan.mjs`
4. **commit**：每个模块一个 commit，commit message 用动词原形（Add / Polish / Refactor）。

**关键原则**：
- 一旦发现产品意图偏差（例如 requirement-management 缺文档上传），**立即停下返工**，不接受「下轮再做」式妥协，除非用户显式选择分阶段。
- 单模块发现需要拆成多个 commit（如 requirement-management 拆 3 commit）时，每个 commit 都要独立验证通过。

---

## R-INTENT-03：迁移模块队列（按 WHartTest 意图优先级）

模块队列与当前进度（updated 2026-07-05 after deep-parity recheck）：

| # | 模块 | 状态 | 关键能力 |
|---|---|---|---|
| 0 | project workspace | ✅ 完成 | 需求优先入口、demo workspace 置顶 |
| 1 | requirement-management | ✅ 完成 | 文档上传(pdf/docx/txt/md/html) + AI 模块拆分 + AI 4维评审 + 状态机 + 审批 |
| 2 | test-suite | ✅ 完成 | CRUD + 有序成员 + suite run + 汇总 + Dialog 确认 |
| 3 | api-automation | ✅ 完成 | HTTP cases + 多步 scenario + tags + global headers + JSON path viewer + custom helpers |
| 4 | llm-chat | ✅ 完成 | 会话 + RAG + token tracking + 自定义 system prompt + Anthropic compat |
| 5 | mcp-admin | ✅ 完成 | 工具审批 + server registry + tool sync + timeout 加固 |
| 6 | skills-management | ✅ 完成 | 安装/启停/权限/调用记录（crab 严格优于 WHartTest） |
| 7 | knowledge | ✅ 完成 | KB/doc/chunk + RAG + 检索诊断 + query log + stub-vector 警告 |
| 8 | execution/report | ✅ 完成 | 队列/详情/artifact/snapshot（crab 严格优于 WHartTest） |
| 9 | test-case mindmap | ✅ 完成 | tree view + 优先级徽章 + JSON/SVG 导出 |
| 10 | operation logs | ✅ 完成 | audit.vue + Table + 筛选 + 详情 Dialog |
| 11 | ui automation assets | ✅ 完成 | page objects + locators + page steps CRUD + 前端工作台 |
| 12 | api keys | ✅ 完成 | 项目级 SHA-256 hashed API key 管理 + 设置页 UI |

**范围外（需 LLM 配置或大型独立功能）**：
- AI edit/repair for API cases（需 OpenAI/Anthropic API key）
- Chat title LLM summary（需 LLM）
- SQL hooks + DB configs（独立 5+ commit 子项目）
- Skills store/catalog browsing（独立 3+ commit 子项目）
- i18n 全量翻译（独立 3+ commit 子项目）

**单模块并行规则**：一次只允许一个"实现模块"处于写代码状态。其他 agent 可并行做后续模块的只读盘点和计划，但不得提前改代码。

---

## R-INTENT-04：UI / 动效标准

参考：shadcn/ui Blocks、Radix Themes、Atlassian Design、Material Motion、Apple HIG Motion、Mobbin。

- Nuxt/Vue 项目，优先使用已有 Tailwind + shadcn-vue 组件，**不直接引入 React 版 shadcn/ui**。
- 不新增 UI 或动画依赖，除非当前模块没有合理替代且 leader 明确记录原因。
- UI 必须像成熟测试管理工作台：克制、清晰、密集但不拥挤、状态明确、操作路径明确。
- 不做营销页风格，不做大 hero，不做装饰性渐变堆叠。
- 每个页面必须有：主操作按钮、搜索/筛选、空态下一步、加载态、错误态、保存/执行反馈。
- 页面首屏必须告诉测试人员"下一步该做什么"。
- 动效只服务反馈、层级、状态变化，不做炫技动画。弹窗、抽屉、下拉、状态切换使用轻量动效（150-250ms，轻微 ease 或 spring 感）。
- destructive action 必须有确认弹窗（用 shadcn-vue Dialog + radix-vue 原语，已实现）。
- 支持 `prefers-reduced-motion`（radix-vue 默认尊重）。
- UI 不得出现明显布局重叠、按钮文字溢出、空白大面积无意义区域。

---

## R-INTENT-05：技术栈与硬规则

- **后端**：NestJS + Fastify + Prisma + Postgres。LLM 通过 `@langchain/openai` ChatOpenAI + zod structured output。
- **前端**：Nuxt 3 + Tailwind + shadcn-vue（基于 radix-vue）。
- **共享类型**：`packages/shared-types/src/*.ts`，types-only 契约。
- **不引入消息队列**（Kafka/RabbitMQ）。耗时 LLM 调用同步执行 + 前端 loading skeleton。
- **优先复用**：LlmDraftService、shadcn-vue Dialog、ExecutionArtifact.storageRef 约定、KnowledgeBase.ingestDocument 模式、TestSuitesService.updateCases 覆盖式事务模式。
- **小步 commit**：每个模块一个 commit。一旦模块需要返工，可拆成多个 commit（每个独立验证）。
- **OpenSpec gate**：模块没有 spec 时，先补 spec 并验证，不写业务代码。

---

## 参考

- 启动指南：`AGENTS.md`
- 当前会话 plan：`.claude/plans/pure-foraging-fog.md`（requirement-management 全量补齐）
- Handoffs：`.omc/handoffs/`
- 团队状态：`.omc/state/team-state.json`
