# 调研资料索引

> 本目录沉淀 WHartTest ↔ crab-auto-test clean-room 审计的调研资料，作为后续开发 agent 的指导材料。
> 这些是 **capability-level** 参考文档，所有 WHartTest 描述均为改写，仅引用短标识符（路由/模型/工具名）作事实参考，**非可复制的实现**。

## 文档清单

| 文档 | 用途 | 何时查阅 |
|---|---|---|
| `wharttest-parity-audit.md`（上级 `docs/`） | **总差距审计报告**：功能矩阵、缺口、优先级、OpenSpec 门禁、clean-room 风险 | 想了解整体对等状态时先读 |
| `wharttest-feature-checklist.md`（上级 `docs/`） | **功能完整性评判清单**：逐功能点 `[x]/[~]/[ ]/[-]` 标记 + 评判标准 | **实现/增强某功能前逐项核对** |
| `wharttest-backend.md` | WHartTest 后端/MCP/Actuator 能力矩阵 + 部署拓扑 | 实现 Django→NestJS 对等能力时查参考能力点 |
| `wharttest-frontend.md` | WHartTest 前端路由/页面/Skills/微信宿主 | 实现前端页面或 Skills 时查路由/能力点 |
| `crab-current-state.md` | crab-auto-test 现状 + OpenSpec 完整性 | 确认 crab 已有什么、OpenSpec 缺什么时查 |

## 使用约定

1. **这些是参考，不是模板**：用它们理解"WHartTest 有什么能力"，但实现须按 crab 自己的 OpenSpec + 技术栈（Nuxt/NestJS/shadcn-vue），**不得复制 WHartTest 源码/素材/文案/样式/提示词/配置**。
2. **clean-room 边界**：见 `wharttest-parity-audit.md` §6 风险说明 + `wharttest-feature-checklist.md` 评判流程第 5 步。高风险域（api-automation DSL、UI step-config schema、提示词、Skills 格式）实现后须记录 provenance note。
3. **OpenSpec 门禁**：Phase-3 域（api-automation / requirement-management / llm-chat / mcp-admin / test-suite）**spec 先行**，见 `crab-current-state.md` §5。`specs/api-automation/` 当前是空目录。
4. **永久非目标**（`[-]` 标记，见 checklist §13 等）：企业微信、复杂 RBAC、DOCX 编辑器、分布式执行、全局 MCP、独立 FastMCP——是 clean-room 设计取舍，**不闭合**。
5. **回填义务**：每实现一个 checklist 功能点，把标记改 `[x]` 并附 commit 引用 + 证据（路由/测试名）。

## 与 OpenSpec 的关系

- 调研资料描述"目标能力空间"（WHartTest 有什么 + crab 缺什么）。
- OpenSpec（`openspec/changes/rebuild-ai-test-platform/`）是"binding 合同"（crab 自己的 WHEN/THEN 场景）。
- **实现以 OpenSpec 为准**；调研资料用于补 OpenSpec 缺口时确定能力边界，以及 checklist 评判完整性。
