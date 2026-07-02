# OMC Prompts For WHartTest-Style Platform Planning

可以。你现在这条 `/ralplan` 方向对，但有一个关键风险：

你写了 **“OpenSpec 是唯一需求源”**，同时又额外列了很多功能域。
如果这些功能域当前没有写进 OpenSpec，OMC 正确做法应该是先报缺口，而不是直接把它们当需求实现。

建议按下面顺序准备 OMC 提示词。

## 1. 先做 OpenSpec 缺口审计

```text
/ralplan "只阅读当前仓库 OpenSpec，不写代码。

目标：
审计 OpenSpec 是否已经覆盖以下能力域：
- 用户登录
- 项目管理
- 测试用例
- 测试套件
- 测试执行记录和报告
- LLM 配置和 LLM 对话
- AI 生成测试用例
- 接口自动化测试
- 需求管理和需求评审
- 知识库/RAG
- MCP 工具管理
- Skills 技能库
- 本地 Playwright 浏览器自动化

硬约束：
- OpenSpec 是唯一需求源
- 如果某能力不在 OpenSpec 中，不允许默认纳入实现计划
- 只输出 OpenSpec 覆盖矩阵、缺口清单、建议新增/修改的 OpenSpec change 草案
- 不写代码，不创建文件

输出：
1. 已覆盖能力
2. 缺失能力
3. 需求冲突点
4. 建议补充的 OpenSpec capabilities
5. 下一步 OpenSpec 修改计划"
```

## 2. 然后补齐 OpenSpec

```text
/ralplan "根据上一轮 OpenSpec 缺口审计，制定补齐 OpenSpec 的方案。

硬约束：
- 只规划 OpenSpec 修改，不写业务代码
- WHartTest 只作为功能对标，不作为代码来源
- 禁止复制 WHartTest 源码、素材、Logo、文案、样式、配置
- 技术栈固定为 Nuxt 3 + Vue 3 + TypeScript + Tailwind + shadcn-vue + Electron + NestJS + Prisma + LangChain + LangGraph + MCP + Playwright

输出：
1. 需要新增的 capabilities
2. 每个 capability 的 Requirement 列表
3. 每个 Requirement 的验收 Scenario
4. 需要修改的 proposal/design/tasks
5. 风险和非目标"
```

## 3. OpenSpec 补齐后，再跑总体实现计划

```text
/ralplan "阅读完整 OpenSpec，制定从零实现 WHartTest 风格 AI 自动化测试平台的分阶段计划。本轮只规划，不写代码。

硬约束：
- OpenSpec 是唯一需求源
- WHartTest 只作为功能对标，不作为代码来源
- 禁止复制 WHartTest 源码、素材、Logo、文案、样式、配置
- 技术栈：Nuxt 3 + Vue 3 + TypeScript + Tailwind + shadcn-vue + Electron + NestJS + Prisma + LangChain + LangGraph + MCP + Playwright

输出：
1. WHartTest 对标功能矩阵
2. MVP 范围
3. 第二阶段范围
4. 第三阶段范围
5. 数据模型草案
6. API 边界
7. Electron + Playwright worker 架构
8. LangGraph 编排方案
9. MCP 和 Skills 安全边界
10. 每个阶段的验收标准
11. 明确哪些内容不允许实现或不在当前阶段实现"
```

## 4. 进入实现前，用 team 做拆解

```text
/oh-my-Codex:team "基于 OpenSpec 和 ralplan 输出，拆分实现任务。

要求：
- explore 先映射仓库结构
- architect 负责模块边界
- planner 负责阶段和依赖顺序
- security-reviewer 负责 MCP、Skills、Electron、Playwright 安全边界
- test-engineer 负责验收测试策略

本轮只输出任务拆解和执行顺序，不写代码。"
```

## 5. 真正开始实现时再用 autopilot

```text
/oh-my-Codex:autopilot "按 OpenSpec 和已确认的实现计划，从零搭建项目骨架。

范围仅限 MVP：
- Nuxt 3 + Vue 3 + TypeScript + Tailwind + shadcn-vue 前端骨架
- Electron 桌面端骨架
- NestJS + Prisma 后端骨架
- 用户登录
- 项目管理
- 测试用例管理
- AI 生成测试用例的接口边界
- Electron 本地 Playwright worker 协议草案
- 执行记录、截图、日志、trace 的数据模型

硬约束：
- 不复制 WHartTest 任何源码、素材、Logo、文案、样式、配置
- 每一步实现后运行验证
- 不实现企业微信
- 不实现复杂 RBAC
- 不越过 OpenSpec 范围"
```

## 备注

当前那条 `/ralplan` 可以保留，但建议先加第 1 条“OpenSpec 缺口审计”。

否则 OMC 可能会把口头补充的功能直接当需求源，和 **“OpenSpec 唯一需求源”** 冲突。
