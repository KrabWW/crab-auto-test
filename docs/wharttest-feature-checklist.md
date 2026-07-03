# 功能完整性评判清单（WHartTest ↔ crab-auto-test）

> 用途：供后续开发 agent 在实现/增强某能力域时，逐项核对本清单，**判断 crab-auto-test 功能点是否完整**。
> 来源：`docs/research/wharttest-backend.md`、`docs/research/wharttest-frontend.md`、`docs/research/crab-current-state.md`、`docs/wharttest-parity-audit.md`。
> 性质：clean-room capability-level 参考。WHartTest 能力描述均为改写，仅引用短标识符（路由/模型/工具名）作事实参考，非复制实现。

## 图例

| 标记 | 含义 |
|---|---|
| `[x]` | crab 已实现该功能点（MVP 或 Phase 2 代码已落地） |
| `[~]` | crab 部分实现 / 薄（需增强） |
| `[ ]` | crab 缺失（待实现，多数为 Phase-3 spec-gated） |
| `[-]` | **永久非目标**（clean-room 设计取舍，不追求对等，勿闭合） |

> 评判标准：**核对实现是否覆盖该功能点的核心行为**（不只看有无路由/模型，要看端到端可用）。`[~]` 必须注明缺什么。每实现一项，把 `[ ]` 改 `[x]` 并附 commit/PR 引用。

---

## 1. 认证与访问控制（对应 `platform-foundation`）

- [x] JWT 登录 / 登出 / 当前用户
- [x] worker-token（worker 调后端的独立凭证）
- [x] envelope 加密凭证存储（per-credential DEK + master-key 轮换，永不返回明文）
- [x] model-provider 配置 + validate（不返回 secret）
- [x] 审计日志（audit module）
- [~] **API Key 管理 UI**（crab 仅有 worker-token，无前端签发/吊销 UI）→ 评判：能否在 UI 签发并吊销外部访问 key
- [-] 复杂 RBAC / 权限矩阵 / 自定义角色（永久非目标，仅 owner/member）
- [-] 用户/组/ContentType 的完整 Django 权限表（架构分歧，crab 用简单角色）

**完整性评判**：登录→建项目→配 provider→生成用例全链路可走通即基础完整；缺 API Key UI 是增强缺口。

## 2. 项目与多租户（对应 `platform-foundation`）

- [x] 项目 CRUD
- [x] 项目成员（owner/member）
- [x] 项目级资源隔离（按 project_id 过滤）
- [-] 项目凭证实体（ProjectCredential）→ crab 用 envelope 加密引用，非独立凭证实体（架构差异，非缺口）

**完整性评判**：跨项目数据隔离生效即完整。

## 3. 功能用例管理（对应 `test-asset-management` + `web-ui`）

- [x] 模块树 CRUD
- [x] 用例列表视图
- [x] 用例表单（名称/等级/类型/前置/步骤/预期/备注）
- [x] 有序步骤
- [x] 执行记录 + 制品（截图/日志/trace）
- [~] **列表 + 思维导图双视图**（crab 仅列表，缺 mindmap 视图）→ 评判：是否有 mindmap 可视化与拖拽整理
- [~] **复制/粘贴/拖拽重排**（crab 未确认有拖拽）
- [~] **套件（test-suite）+ 批量执行**（crab 无套件实体）→ **Phase-3 `test-suite` cap 门禁**
- [~] **Excel 导入导出 + 列映射模板**（crab 无）→ 增强
- [~] **用例模板库 + 导入导出**（crab 无）→ 增强
- [~] **截图上传/批量删除**（crab 制品采集有，但按用例关联的截图管理 UI 未确认）
- [~] **AI 编辑/优化/修复/运行用例**（crab 仅 AI 生成 + 审批）→ 评判：能否对已有用例做 AI 修改而非仅生成

**完整性评判**：能建树→建用例→加步骤→执行→看记录即基础完整；mindmap/套件/Excel/AI编辑是渐进增强。

## 4. 接口自动化（对应 **Phase-3 `api-automation`**，`specs/api-automation/` 空目录）

- [ ] 接口模块树
- [ ] 接口定义（HTTP 类型）
- [ ] 请求配置（body/params/headers/cookies）
- [ ] 断言配置
- [ ] 变量提取（jmespath 类）
- [ ] 前后置脚本/钩子
- [ ] SQL 类型接口 + 数据库校验
- [ ] 环境与变量管理 + 全局 Header
- [ ] 自定义函数
- [ ] 数据库配置 + 连接测试
- [ ] 接口用例（步骤/标签/分组）
- [ ] 测试任务（套件批量运行）
- [ ] 执行结果明细 + 报告
- [ ] 接口同步配置 + 历史/回滚
- [ ] AI 生成/编辑/修复接口用例
- [ ] API 仪表盘（per-project 统计）

> **最高 clean-room 风险域**：WHartTest 用 HttpRunner 的 Config/Step/RunRequest/RunSqlRequest DSL。crab **必须独立设计**请求/断言/提取模型，不得镜像其 DSL。当前 crab 仅有 `/api-automation` 占位路由（MUST-3）。
> **门禁**：实现前必须先写 `specs/api-automation/spec.md`（当前空目录）+ archive 现有 change。

**完整性评判**：此域整体为 Phase-3，**任何 `[x]` 前 spec 必须先就位**。

## 5. UI 自动化（对应 `automation-workers` + 增强域）

- [x] Electron 本地 Playwright worker（隔离临时 profile、硬超时、网络出口策略）
- [x] 制品采集（截图 + trace + redaction + 大小限制）
- [x] 执行记录 + snapshot
- [~] **页面对象资产 UI**（pages / elements / page-steps）→ crab worker 能跑，但无资产管理建模 UI
- [~] **公共数据 / 环境配置管理**
- [~] **执行机注册表 UI**
- [~] **批量执行记录**
- [~] **Trace viewer**（crab 采集了 trace，但前端 trace 查看器未确认）
- [~] **WebSocket 实时执行流**（crab 用轮询认领传输，非 WS）→ 评判：执行过程是否实时可见
- [-] 分布式执行 / 远程 worker 池（永久非目标，仅本地 Electron）

**完整性评判**：能下发→本地跑 Playwright→回传制品即基础完整；资产管理 UI + 实时流是增强。

## 6. 知识库与 RAG（对应 `knowledge-rag`，Phase 2）

- [x] KB CRUD
- [x] 文档上传
- [x] 文档解析（pdf/docx 等）+ 分块
- [x] 向量化 + 可检索（pgvector，RetrievalBackend 接口可换）
- [x] RAG 带来源归因
- [x] 诊断端点
- [~] **reranker 精排**（crab 为 stub，未接真实 reranker）→ 评判：是否有真实 reranker 而非占位
- [~] **多模态嵌入（图片）**（crab 未确认支持图片嵌入）
- [~] **全局 embedding/reranker 配置 UI + 连接测试**
- [~] **文档分块查看器（分页 + 内容分段）**
- [~] **KB 统计 + 查询日志**
- [~] **会话式 RAG / 知识即工具**（crab RAG 有，会话式变体未确认）
- [-] Qdrant 向量库（crab 选 pgvector-first，Qdrant 可换但未实现——架构取舍，非缺口）

**完整性评判**：上传→分块→嵌入→检索→带归因返回即基础完整；reranker + 多模态 + UI 是增强。

## 7. 需求管理与智能评审（对应 **Phase-3 `requirement-management`**，无 spec）

- [ ] 受管需求实体（非仅 AI-gen 输入字符串）
- [ ] 需求文档上传 + 解析
- [ ] 模块拆分（token 感知）
- [ ] 上下文限制检查
- [ ] 结构分析
- [ ] 评审工作流（仅 owner/member 审批）
- [ ] 已批准需求 → 生成用例的关联
- [ ] 评审报告（带评分 + 问题项）
- [ ] 可重启评审
- [-] 在线 DOCX 编辑器（永久非目标）

> **门禁**：实现前必须先写 `specs/requirement-management/spec.md`。
> 当前 crab 需求只是 AI-gen 的输入串，非受管实体。

**完整性评判**：此域整体为 Phase-3，spec 先行。

## 8. LLM 对话与 Agent 编排（对应 `backend-ai-orchestration` + **Phase-3 `llm-chat`**）

### 已实现（MVP）
- [x] AI 用例生成流程（生成→RAG→草稿→校验→增强→审批→持久化）
- [x] SSE 流 + snapshot
- [x] 审批软停止（awaiting-approval / accept / reject）
- [x] 幂等持久化（runId+title）
- [x] 有界重试校验

### Phase-3 缺口（`llm-chat` cap，无 spec）
- [ ] 交互对话 UI（会话侧栏 + 消息流 + 输入）
- [ ] 会话持久化（ChatSession / ChatMessage）
- [ ] 对话审计
- [ ] token 用量展示
- [ ] 系统提示词配置
- [ ] RAG 开关（选 KB + 相似度阈值 + top-k）
- [ ] 工具审批 UI（card + dialog + settings）

### 既有 cap 内的薄度（`backend-ai-orchestration`）
- [-] durable LangGraph checkpointer / `interrupt()`（**永久非目标 R1**，crab 选状态机）
- [-] BullMQ worker 传输（**永久非目标 R2**，crab 用轮询认领）
- [-] 服务端事件重放缓冲（**永久非目标 R8**，crab 用 snapshot 重取）
- [~] Agent Loop 复杂度（Blackboard / 步骤摘要化 / 停止恢复）→ crab 状态机较简单，长任务 token 治理薄

> **注意**：`llm-chat` 是会话级 bounded context（无 tool-calling/多步状态），**不在** `backend-ai-orchestration` R2 范围，无需 MODIFIED/豁免。
> **门禁**：对话 UI 实现前必须先写 `specs/llm-chat/spec.md`。

**完整性评判**：AI 生成链路完整；对话能力是 Phase-3 新增，spec 先行。**不得**因对等而引入 durable checkpointer（F8 drift-scan 门禁）。

## 9. MCP 工具（对应 P2 机制 + **Phase-3 `mcp-admin`**）

### 已实现（P2 机制）
- [x] 项目级 allowlist
- [x] McpToolCall 审计
- [x] invoke 端点
- [x] 运行时强制（reject 非白名单在调用前）

### Phase-3 缺口（`mcp-admin` cap，无 spec）
- [ ] 治理 UI（propose / review / approve / allowlist / revoke）
- [ ] 远程 MCP 配置注册 UI
- [ ] ping 连通性测试
- [ ] 持久会话（按 user+project 缓存）→ crab 机制层未确认有持久会话
- [-] **平台全局 MCP 工具 + 全局 admin 角色**（永久非目标，MCP 仅项目级）
- [-] 独立 FastMCP 服务容器（架构分歧，crab MCP 内嵌 NestJS）

> **门禁**：治理 UI 实现前必须先写 `specs/mcp-admin/spec.md`。
> `mcp-admin` 拥有"非白名单工具调用前拒绝"谓词的唯一所有权；`backend-ai-orchestration.3` 仅引用、不重述。

**完整性评判**：运行时 allowlist 完整；治理 UI 是 Phase-3。**保持项目级限定**。

## 10. Skills 技能库（对应 `skills-store`，Phase 2）

- [x] 打包 + 元数据
- [x] 浏览 / 安装
- [x] 权限审查（approve）
- [x] 受控适配器（CI 禁 eval/vm/dynamic-require）
- [x] 更新 + 回滚（previousVersionId）
- [x] checksum 校验（失败保留当前，无半状态）
- [x] SkillInvocation 审计
- [~] **git 导入 / zip-from-url 安装**（crab 未确认支持 git/url 安装路径）
- [~] **技能商店 manifest + 多源配置 + readme 预览**
- [~] **bundled skill 播种**（crab 未确认有 init seeding）
- [~] **作为 Agent 工具暴露 + 持久浏览器 + 制品采集**

**完整性评判**：安装→校验→启用→审计→回滚链路完整即基础；商店多源 + git 导入是增强。

## 11. 任务中心与调度（**真实缺口，无 cap spec**）

- [ ] 定时任务（cron / hourly / daily / weekly / once）
- [ ] 按模块路由分发（UI 自动化 / 测试套件 / 接口）
- [ ] enable / disable / run-now
- [ ] 执行历史 + 日志查看
- [ ] 跨类型统一任务入口

> **建议**：作为新 cap（如 `task-scheduling`）或并入 `test-suite` spec。当前 crab 仅有执行记录，无定时调度。

**完整性评判**：整体缺失，需补 spec。

## 12. 提示词与模板（增强域）

- [~] 用户提示词库
- [~] 默认提示词模板
- [~] Excel 导入导出列映射模板

> 未在任何 cap 中 spec，属增强。

## 13. 微信集成（**永久非目标**）

- [-] 扫码登录 / Bot 账号 / 会话 / 消息轮询 / sidecar 桥接

> crab `design.md §11` 永久非目标，**不闭合**。

## 14. 操作日志（对应 `platform-foundation` 审计）

- [x] 审计日志记录
- [~] 操作日志 UI + 保留期清理配置

**完整性评判**：记录有，UI/清理是增强。

## 15. 部署与可观测（增强域）

- [x] 本地 docker-compose（pgvector）
- [x] CI 全流水线（migrate/seed/typecheck/build/test/5 gates）
- [~] 完整生产部署拓扑（Postgres+Redis+backend+frontend 多服务编排）→ crab 仅有本地 compose
- [~] 统一部署脚本（run_compose 式）
- [~] per-app 日志 + safe rotating handler
- [~] token 用量统计

## 16. Web UI 基础（对应 `web-ui`）

- [x] Nuxt3 + Vue3 + TS
- [x] Tailwind
- [x] 路由守卫（requiresAuth）
- [x] 主题切换（dark/light）
- [~] **shadcn-vue 组件完整度**（crab 仅 button/card/input，缺 **Table / Dialog**）→ MVP-FINISH-PLAN A2 目标
- [~] **i18n（中英双语）**（crab 未确认有完整双语）
- [~] **版本/更新提示**
- [~] **全局项目选择器 + 环境选择器**

**完整性评判**：核心路由 + 守卫 + 主题完整；组件库 + i18n 是增强。

---

## 评判流程（给开发 agent）

1. **先看所属 cap 的 spec 是否就位**：若该域在 Phase-3（域 4/7/8-对话/9-治理/11），spec 未写则**停止实现**，先补 OpenSpec。
2. **逐项核对**：找到你要做的能力点，确认其标记。`[~]` 必须读懂缺什么再动手。
3. **不碰 `[-]`**：永久非目标项是 clean-room 边界，实现它们会违反不变量。
4. **实现后回填**：把 `[ ]`/`[~]` 改 `[x]`，附 commit 引用 + 简短证据（路由/测试名）。
5. **clean-room 复核**：若该能力点标注了 clean-room 风险（如域 4 DSL、域 5 step-config、域 12 提示词），实现后须记录独立设计路径（provenance note）。

## 优先级速查

- **P0 spec-gated**：域 4（api-automation）、7（requirement）、8-对话（llm-chat）、9-治理（mcp-admin）、3-套件（test-suite）
- **P1 真实缺口**：域 11（任务调度）、5-资产UI、12（提示词模板）
- **P2 既有增强**：域 3（mindmap/AI编辑）、6（reranker/多模态）、10（商店多源）、16（Table/Dialog/i18n）、14、15
- **P3 永久非目标**：域 13（微信）、域 1/9 全局角色、域 7 DOCX 编辑器、域 5 分布式执行、域 9 独立 FastMCP

---

*维护：每完成一个功能点请回填本清单。本清单是 crab 功能完整性的活评判标准。*
