# Reference Product Page Mapping

Last updated: 2026-07-05

本文档用于长期避免参考产品被遗忘。它不是实现方案，也不是照搬清单，而是把 Hoppscotch / Playwright / Allure / Dify / Open WebUI / Cline / Supabase 的页面结构和交互优势，映射成 Crab 的可迁移设计结构。

本轮依据的是本地开源参考仓库：

`D:\code\auto-test\crab-auto-test\.claude\reference-products\oss`

## 使用原则

1. 复制模式，不复制产品边界。
2. Crab 的核心仍是 Proof Case：Requirement -> State Transition -> Cases -> Automation -> Execution -> Evidence -> Report。
3. 参考产品页面只在它们能强化 Proof Case 证据链时迁移。
4. 主工作流采用密集工作台：左对象树，中间编辑/检查，右上下文/证据，底部运行结果/日志。
5. AI、MCP、Knowledge、Skills 都是支撑 Proof Case 的上下文与能力，不要反客为主。

## 总映射

| 参考产品 | 参考强项 | Crab 目标页面 | 迁移重点 | 明确不复制 |
| --- | --- | --- | --- | --- |
| Hoppscotch | API 请求工作台、集合、环境、响应、测试结果 | Automation / API Scenario Workbench | 左集合树 + 中请求编辑 + 右响应/断言/证据 + 底部 runner | 不做完整 API 客户端平台 |
| Playwright | UI Mode / Trace Viewer 的失败定位和证据检查 | Execution Evidence Detail | action timeline、截图/trace、log/network/source/attachments | 不重做 Trace Viewer 或 IDE |
| Allure | 报告导航、趋势、附件、测试详情 | Proof Report / Evidence Matrix | overview、suite/category/timeline、attachment preview、history | 不用通过率作为 Crab 第一心智 |
| Dify | Knowledge dataset、documents、hit testing、workflow/plugin 概念 | Knowledge Source Trust Center | sources、documents、index status、retrieval test、citation preview | 不暴露复杂 embedding 参数 |
| Open WebUI | workspace 下 Knowledge / Skills / Tools / Models 分离 | Skills / Knowledge / AI Chat drawer | AI 资产分离、技能列表、知识文件、工具选择、访问控制 | 不让 Chat 成一级产品中心 |
| Cline | tool approval、MCP server、chat tool-call 可见性 | MCP Governance / Right AI Assistant | approval、auto-approve 范围、server row、tool/resource/prompt、调用结果 | 不复制 YOLO 或黑箱代理 |
| Supabase | project settings、API keys、secrets、audit/security boundaries | Project Governance Settings | 左设置分组、中心配置、右风险/使用说明、危险操作隔离 | 不复制全量后台产品线 |

## 1. Hoppscotch -> Crab API Automation

### 本地证据

关键路径：

- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/pages/index.vue`
- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/components/http/Request.vue`
- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/components/http/Response.vue`
- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/components/http/Tests.vue`
- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/components/http/TestResult.vue`
- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/components/http/test/Runner.vue`
- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/components/http/Sidebar.vue`
- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/components/collections/index.vue`
- `reference-products/oss/hoppscotch/packages/hoppscotch-common/src/components/environments/Selector.vue`

Hoppscotch 的 `index.vue` 是一个典型 API workbench：`AppPaneLayout` 里 primary 是多 tab 请求窗口，sidebar 是 HTTP 侧边栏，顶部 action 里挂 environment selector。`Request.vue` 把 method、URL、send/cancel、save、import cURL、codegen、request name 等高频操作放在顶层。HTTP 子组件拆成 parameters、headers、auth、body、pre-request script、tests、response、runner result。

### 它为什么适合 Crab

API 自动化不是“表单录入接口”，而是重复编辑、运行、检查、保存、复用的工作台。Hoppscotch 的优势是让请求编辑、环境变量、集合归档、运行结果都在同一个稳定壳里完成。Crab 的 API 模块如果只做 CRUD 表格，会失去最重要的高频操作效率。

### Crab 页面结构

目标页面：`Automation / API Scenario Workbench`

推荐结构：

- 顶部：项目/环境选择器、当前 Proof Case、当前 State Transition、Run、Save、Import cURL、Generate Assertions。
- 左侧：API Collection tree。层级为 Business Flow / Scenario / Request，而不是纯文件夹。
- 中间：请求或步骤编辑器。
  - Request line: method、endpoint、name、linked evidence point。
  - Tabs: Params、Headers、Auth、Body、Pre-request、Assertions、Extraction、Evidence Binding。
- 右侧：运行响应和证明上下文。
  - Response preview: status、time、size、headers、body。
  - Assertion result。
  - Extracted variables。
  - Evidence point mapping: 这个响应证明哪个状态变化。
  - AI assertion suggestion。
- 底部：Runner result、console、raw logs、history、environment diff。

### 可迁移交互

- 多 tab 请求编辑：保留 dirty 状态，关闭未保存 tab 时确认。
- Environment selector 固定在工作台顶层，而不是藏在设置页。
- Send 按钮旁放二级菜单：import cURL、show code、clear、run selected scenario。
- Save 不只是保存 request，也要支持 Save as Evidence Step / Save to Asset Package。
- Test Runner 结果要能按 scenario/request/folder 展开。
- Assertions 与 extraction 是一等对象，不要藏在脚本里。

### 不要照搬

- 不要把 Crab 做成通用 API 客户端。
- 不要早期塞 GraphQL、WebSocket、MQTT、SSE 等协议大集合。
- 不要把 collection documentation / public sharing 做成 P0 主功能。
- 不要把脚本编辑器作为默认视图。脚本只在失败、调试、复用时渐进披露。

## 2. Playwright -> Crab Execution Evidence Detail

### 本地证据

关键路径：

- `reference-products/oss/playwright/packages/trace-viewer/src/ui/workbench.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/actionList.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/timeline.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/snapshotTab.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/callTab.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/logTab.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/errorsTab.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/consoleTab.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/networkTab.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/sourceTab.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/attachmentsTab.tsx`
- `reference-products/oss/playwright/packages/trace-viewer/src/ui/uiModeTestListView.tsx`

Playwright Trace Viewer 的 `workbench.tsx` 有很清晰的组合：顶部 timeline，中间 split view，左侧 actions/metadata，中心 snapshot，底部或右侧 properties tabs。properties tabs 包含 Locator、Call、Log、Errors、Console、Network、Source、Attachments、Annotations。失败 action 会被优先选中，错误可以 reveal source，附件可以从 action 反查。

### 它为什么适合 Crab

UI 自动化的核心价值不是“跑过了几个测试”，而是失败后能迅速知道哪一步、哪个状态、哪个证据坏了。Playwright 的结构证明了一个原则：执行详情应该围绕 action timeline 和证据 panes 组织，而不是围绕脚本源码组织。

### Crab 页面结构

目标页面：`Execution Evidence Detail`

推荐结构：

- 顶部：Execution status、Proof Case、State Transition、environment、duration、owner、rerun。
- 左侧：Proof step/action list。
  - 按 State Transition 分组。
  - 每步显示状态、耗时、证据类型、是否影响报告。
  - 默认选中 failed proof step。
- 中间：视觉证据区。
  - Screenshot。
  - Video frame。
  - Trace preview。
  - DOM snapshot 或 page state。
- 右侧：失败和证明上下文。
  - Failed proof step。
  - Affected state transition。
  - Expected state vs observed state。
  - Evidence quality。
  - AI failure analysis。
  - Suggested next owner/action。
- 底部：可切换 tabs。
  - Call / Step detail。
  - Log。
  - Errors。
  - Console。
  - Network。
  - Source。
  - Attachments。
  - Raw artifacts。

### 可迁移交互

- 默认选中失败步骤，而不是让用户自己找。
- Timeline 支持按时间 scrub，和 screenshot / network / console 联动。
- Action list 支持 filter。
- Errors tab 能一键定位到 step/source/evidence。
- Attachments 与 action 绑定，不是孤立文件列表。
- Source 是 drill-down，不是主工作区。

### 不要照搬

- 不要重做完整 Trace Viewer。
- 不要把 Locator / Inspector / Source editor 变成普通 QA 的默认入口。
- 不要把 UI 自动化页面做成 IDE。
- 不要让 trace zip 成为用户必须理解的对象。

## 3. Allure -> Crab Proof Report

### 本地证据

关键路径：

- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/overview/index.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/overview/OverviewLayout.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/overview/GraphLayout.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/tree/views/TreeView.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/tree/views/TimelineView.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/tree/views/TestResultTreeView.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/suites/index.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/categories/index.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/behaviors/index.mts`
- `reference-products/oss/allure2/allure-generator/src/main/javascript/features/attachments/views/*`

Allure 的页面结构是报告系统的标准参考：Overview、Graph、Suites、Categories、Behaviors、Timeline、test result detail、attachments。Overview 里有 summary、status、severity、duration、history trend、retry trend、categories trend、environment、executors 等 widget。附件系统支持 image、video、HTML、text、table、HTTP exchange、screen diff、Playwright trace 等 preview。

### 它为什么适合 Crab

Allure 证明了报告要支持两层消费：管理者看 overview 和趋势，工程人员钻到 suite/test/step/attachment。Crab 要迁移这个两层结构，但第一层问题必须换成 Proof Case 的发布决策，而不是测试通过率。

### Crab 页面结构

目标页面：`Proof Report`

第一屏必须回答：

- 这次需求能不能过。
- 为什么。
- 哪些状态转移已经被证明。
- 还剩哪些风险。
- 谁确认了结论。

推荐结构：

- 顶部 decision band：Go / No-Go / Needs Review、risk level、release target、confirmed by、last execution。
- 左侧：Report navigation。
  - Summary。
  - Evidence Matrix。
  - State Transitions。
  - Cases。
  - Executions。
  - Artifacts。
  - History。
  - Environment。
- 中间：当前报告内容。
  - Summary: decision、blockers、weak evidence、coverage。
  - Evidence Matrix: rows = state transitions, columns = evidence type / trust / risk / reviewer。
  - Timeline: executions and proof events。
- 右侧：selected row inspector。
  - Linked requirement。
  - Linked case/scenario。
  - Evidence attachments。
  - Reviewer decision。
  - Failure reason。
- 底部或 drawer：artifact preview。
  - screenshot、video、trace、HTTP exchange、log、API response、screen diff。

### 可迁移交互

- Overview + drill-down 的两层报告结构。
- Test result detail 的 step 展开模式迁移为 Proof Step detail。
- Attachment preview 多类型渲染迁移为 Evidence Artifact preview。
- History trend 迁移为 Proof stability trend / recurring failure trend。
- Categories 迁移为 failure category / risk category。
- Environment / executor 迁移为 test environment / runner / model provider / data source。

### 不要照搬

- 不要把 Allure 的 Suites/Categories/Behaviors 当作 Crab 第一导航。
- 不要让通过率成为报告第一心智。
- 不要让报告只服务 QA。发布负责人必须能在第一屏做判断。
- 不要把附件堆成文件列表，附件必须绑定到状态转移、步骤、断言或报告结论。

## 4. Dify -> Crab Knowledge Source Trust Center

### 本地证据

关键路径：

- `reference-products/oss/dify/web/app/(commonLayout)/datasets/page.tsx`
- `reference-products/oss/dify/web/app/(commonLayout)/datasets/(datasetDetailLayout)/[datasetId]/layout-main.tsx`
- `reference-products/oss/dify/web/app/(commonLayout)/datasets/(datasetDetailLayout)/[datasetId]/documents/page.tsx`
- `reference-products/oss/dify/web/app/(commonLayout)/datasets/(datasetDetailLayout)/[datasetId]/settings/page.tsx`
- `reference-products/oss/dify/web/app/(commonLayout)/datasets/(datasetDetailLayout)/[datasetId]/pipeline/page.tsx`
- `reference-products/oss/dify/web/app/(commonLayout)/@detailSidebar/datasets/[datasetId]/hitTesting/page.tsx`
- `reference-products/oss/dify/web/app/(commonLayout)/plugins/page.tsx`
- `reference-products/oss/dify/web/app/components/workflow-app/components/workflow-main.tsx`
- `reference-products/oss/dify/web/service/knowledge/use-hit-testing.ts`
- `reference-products/oss/dify/web/service/knowledge/use-document.ts`

Dify 的 dataset 详情会根据 provider、runtime_mode、ACL capability 跳到 documents、hitTesting、settings、pipeline 等不同页面。这里最值得迁移的是：知识库不是上传文件列表，而是带权限、处理状态、召回测试、pipeline 和设置的可信上下文资产。

### 它为什么适合 Crab

Crab 的 AI 如果不能说明“依据哪个需求文档、业务规则、历史用例或接口文档生成”，用户不会信。Dify 的 dataset detail 和 hit testing 说明知识库必须有验证入口，不能做成黑箱 RAG。

### Crab 页面结构

目标页面：`Knowledge Source Trust Center`

推荐一级结构：

- Sources。
- Documents。
- Retrieval Test。
- Citations。
- Usage。
- Settings。

Sources 列表：

- source name。
- source type: PRD、API docs、business rule、historical cases、error log、glossary。
- indexing status: not indexed、indexing、ready、failed、stale。
- freshness。
- owner。
- linked Proof Cases。
- last used by AI。

Source detail：

- 顶部：source status、indexing progress、freshness、owner、linked modules。
- 左侧：document/source tree。
- 中间：document list / chunk preview / retrieval result。
- 右侧：citation preview、AI usage、source quality、permission。
- 底部：index logs、failed chunks、retrieval test history。

Retrieval Test：

- 输入 query。
- 选择 target source / Proof Case context。
- 结果展示 retrieved documents / chunks / citation / score / reason。
- 一键保存为 AI source validation evidence。

### 可迁移交互

- Dataset detail 自动根据状态和权限进入最合适子页。
- Retrieval hit testing 是产品页面，不是调试工具。
- Documents 和 settings 分离。
- Pipeline/processing 作为高级入口，不打扰普通使用者。
- Source usage 需要能反查到 AI 输出和 Proof Case。

### 不要照搬

- 不要一开始做完整 Dify app/workflow 平台。
- 不要把 embedding、chunk size、rerank 等参数放成主界面。
- 不要把 Knowledge 做成上传后不可解释的黑箱。
- 不要让数据源权限复杂度超过 P0 需要。

## 5. Open WebUI -> Crab Skills / Knowledge / AI Chat

### 本地证据

关键路径：

- `reference-products/oss/open-webui/src/routes/(app)/workspace/+layout.svelte`
- `reference-products/oss/open-webui/src/routes/(app)/workspace/knowledge/+page.svelte`
- `reference-products/oss/open-webui/src/routes/(app)/workspace/knowledge/[id]/+page.svelte`
- `reference-products/oss/open-webui/src/routes/(app)/workspace/skills/+page.svelte`
- `reference-products/oss/open-webui/src/routes/(app)/workspace/tools/+page.svelte`
- `reference-products/oss/open-webui/src/routes/(app)/workspace/models/+page.svelte`
- `reference-products/oss/open-webui/src/lib/components/workspace/Knowledge.svelte`
- `reference-products/oss/open-webui/src/lib/components/workspace/Knowledge/KnowledgeBase.svelte`
- `reference-products/oss/open-webui/src/lib/components/workspace/Skills.svelte`
- `reference-products/oss/open-webui/src/lib/components/workspace/Skills/SkillEditor.svelte`
- `reference-products/oss/open-webui/src/lib/components/workspace/Tools.svelte`
- `reference-products/oss/open-webui/src/lib/components/workspace/Tools/ToolkitEditor.svelte`
- `reference-products/oss/open-webui/src/lib/components/workspace/Models/SkillsSelector.svelte`
- `reference-products/oss/open-webui/src/lib/components/workspace/Models/ToolsSelector.svelte`

Open WebUI 的重要参考不是聊天页面本身，而是 workspace IA：Knowledge、Prompts、Skills、Tools、Models 分离。Knowledge 支持 list/create/detail/file/directory/add content/access control。Skills 支持 search、view、create、clone、export、delete、toggle。Models 可以绑定 tools、skills、knowledge。

### 它为什么适合 Crab

Crab 需要让 AI 能力可治理。Open WebUI 证明 Skills、Tools、Knowledge、Models 不能混在一个“AI 菜单”里。Skill 是能力资产，Tool 是执行能力，Knowledge 是可引用上下文，Model 是运行供应商。Chat 只是使用入口。

### Crab 页面结构

目标页面：`Context & Configuration / Skills`

推荐结构：

- 左侧：Skill categories。
  - Requirement Analysis。
  - Case Generation。
  - API Assertion Suggestion。
  - Failure Analysis。
  - Evidence Review。
  - Report Drafting。
- 中间：Skill table。
  - name。
  - purpose。
  - version。
  - status。
  - owner。
  - compatible contexts。
  - required sources。
  - allowed MCP tools。
  - last used。
- 右侧：Skill inspector。
  - instruction preview。
  - bindings。
  - permissions。
  - source/tool dependencies。
  - invocation history。
  - generated artifacts。
  - rollback/deprecate。
- 底部：invocation logs / failed runs / review notes。

AI Chat drawer：

- 不做一级菜单。
- 跟随当前页面 context。
- 顶部显示 active context：Proof Case、stage、selected object。
- 中间显示 messages、AI drafts、tool calls、citations。
- 底部输入框支持选择 Skill、Knowledge source、MCP tool。
- 每个输出必须能 accept / edit / reject / regenerate / mark error reason。

### 可迁移交互

- Skills 列表有 search、filter、pagination、enable/disable。
- Skill create/edit 与 Skill list 分开。
- Knowledge 支持目录、文件、add text content、access control。
- Model/AI capability 可以绑定 Skills / Tools / Knowledge，但 Crab 应绑定到产品上下文。
- Import/export 可以迁移到后期资产流转，不是 P0 第一优先级。

### 不要照搬

- 不要让 Chat 成为产品主页。
- 不要把 Prompt、Skill、Tool、Knowledge、Model 混成一个“AI 能力”列表。
- 不要让 Skill 看起来只是随手 prompt snippet。
- 不要隐藏 Skill 使用了哪些 source 和 tool。

## 6. Cline -> Crab MCP Governance And AI Tool Approval

### 本地证据

关键路径：

- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/chat/ChatView.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/chat/ChatRow.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/chat/DiffEditRow.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/chat/CommandOutputRow.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/chat/BrowserSessionRow.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/chat/auto-approve-menu/AutoApproveBar.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/mcp/configuration/McpConfigurationView.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/mcp/configuration/tabs/installed/ConfigureServersView.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/mcp/configuration/tabs/installed/server-row/ServerRow.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/mcp/configuration/tabs/installed/server-row/McpToolRow.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/mcp/configuration/tabs/installed/server-row/McpResourceRow.tsx`
- `reference-products/oss/cline/apps/vscode/webview-ui/src/components/mcp/configuration/tabs/installed/server-row/McpPromptRow.tsx`
- `reference-products/oss/cline/sdk/packages/core/src/runtime/tools/tool-approval.ts`
- `reference-products/oss/cline/sdk/packages/core/src/extensions/mcp/policies.ts`

Cline 的 `McpConfigurationView` 是固定全屏配置面板，顶部 header，下面 tabs：Remote Servers 和 Configure。`ServerRow` 支持 expand、restart、delete、enable/disable、timeout、tool auto-approve，并展开 tools/resources/prompts。Chat 侧有 command output、diff edit、browser session、auto-approve bar 等，工具行为不是黑箱。

### 它为什么适合 Crab

Crab 的 AI 未来会调用 MCP、读取知识库、生成用例、跑自动化。如果这些工具调用被隐藏，用户无法审查 AI。Cline 给出的核心模式是：AI 行动必须带请求、权限、结果、可回放记录。

### Crab MCP 页面结构

目标页面：`MCP Governance Center`

推荐结构：

- 顶部：project、environment、global MCP status、add server、policy summary。
- 左侧：server list。
  - status。
  - transport。
  - owner。
  - trust state。
  - tool/resource/prompt counts。
  - risk class。
- 中间：selected server detail。
  - Overview。
  - Tools。
  - Resources。
  - Prompts。
  - Permissions。
  - Invocation Logs。
- 右侧：permission inspector。
  - scope。
  - allowed contexts。
  - approval rule。
  - last invocation。
  - linked Proof Cases。
- 底部：connection logs / invocation payload preview / redacted output。

Tool row 字段：

- name。
- description。
- input schema summary。
- output summary。
- risk class。
- permission rule。
- auto-approve state。
- last used。
- linked Proof Case / Execution。

### Crab AI Assistant 结构

目标页面：全局右侧 AI Assistant drawer。

每次 tool call 显示：

- AI 想做什么。
- 为什么需要这个工具。
- 会读/写什么。
- 影响哪个 Proof Case / stage / evidence。
- 输入摘要。
- 审批控件。
- 执行状态。
- 结果摘要。
- 生成或更新了哪些 artifact。

### 可迁移交互

- Server row expand/collapse。
- Server enable/disable。
- Tool-level auto approval，但必须按风险分级。
- Timeout/status/error 可见。
- Tools / Resources / Prompts 分开展示。
- Chat 中显示命令输出、diff、browser/session/tool output。

### 不要照搬

- 不要使用 YOLO 作为产品语言。
- 不要让 AI 默认有广泛写权限。
- 不要把 MCP 配置变成用户直接编辑 JSON。
- 不要把工具调用只留在聊天历史里；必须进入 invocation logs 和 Proof Case 证据链。
- 不要复制开发者 IDE 的所有行为。Crab 的目标是证明业务状态，不是代码代理。

## 7. Supabase -> Crab Project Governance Settings

### 本地证据

关键路径：

- `reference-products/oss/supabase/apps/studio/pages/project/[ref]/settings/general.tsx`
- `reference-products/oss/supabase/apps/studio/pages/project/[ref]/settings/api.tsx`
- `reference-products/oss/supabase/apps/studio/pages/project/[ref]/settings/api-keys/index.tsx`
- `reference-products/oss/supabase/apps/studio/pages/project/[ref]/settings/jwt/index.tsx`
- `reference-products/oss/supabase/apps/studio/pages/project/[ref]/settings/integrations.tsx`
- `reference-products/oss/supabase/apps/studio/pages/project/[ref]/settings/log-drains.tsx`
- `reference-products/oss/supabase/apps/studio/pages/org/[slug]/team.tsx`
- `reference-products/oss/supabase/apps/studio/pages/org/[slug]/audit.tsx`
- `reference-products/oss/supabase/apps/studio/components/layouts/ProjectSettingsLayout/SettingsLayout`
- `reference-products/oss/supabase/apps/studio/components/interfaces/APIKeys/PublishableAPIKeys`
- `reference-products/oss/supabase/apps/studio/components/interfaces/APIKeys/SecretAPIKeys`
- `reference-products/oss/supabase/apps/studio/components/interfaces/Settings`
- `reference-products/oss/supabase/apps/studio/components/interfaces/AuditLogs`

Supabase Studio 的 settings 不是一个巨型表单，而是 Project Settings layout 下的多个二级页：general、api、api-keys、jwt、integrations、log-drains 等。API keys 页面区分 publishable keys 和 secret keys，并通过 layout、callout、disable interaction、docs button 等方式强调暴露边界和安全状态。

### 它为什么适合 Crab

Crab 也会有模型供应商、MCP 凭据、环境变量、成员、审计、危险操作。如果全部平铺，会很快不可治理。Supabase 的设置结构证明了一个模式：低频治理能力要分组，秘密和危险动作要有边界，配置页要说明 scope 和风险。

### Crab 页面结构

目标页面：`Project Governance Settings`

推荐结构：

- 左侧 settings groups。
  - General。
  - Members。
  - Model Providers。
  - Credentials。
  - Audit。
  - Danger Zone。
- 中间：选中页面的配置表单或表格。
- 右侧：governance inspector。
  - scope。
  - risk。
  - last changed。
  - changed by。
  - used by。
  - warnings。
- 底部：audit events / validation errors / usage trail。

Credentials 页面：

- 按 environment 分组：local、test、staging、production。
- 字段：name、type、scope、owner、last rotated、used by、exposure class、masked value、status。
- exposure class：
  - publishable。
  - server-only secret。
  - service-role/admin。
  - external API token。
  - MCP credential。
  - model provider credential。
- 高权限 credential 绑定到 AI / MCP / frontend context 时必须 warning。

Model Providers 页面：

- provider。
- model family。
- capability。
- environment scope。
- credential reference。
- health。
- fallback。
- used by: Requirements、Cases、API、Execution、Report、Chat。

Danger Zone 页面：

- archive project。
- delete project。
- reset evidence。
- revoke all credentials。
- disable all MCP tools。
- transfer ownership。
- 每项都要有 consequence、required role、confirmation phrase、affected objects、audit result。

### 可迁移交互

- SettingsLayout + group pages。
- API keys 分 publishable / secret，不混放。
- 不可用状态用 disabled interaction，而不是隐藏。
- 安全说明和 docs/help 在上下文中出现。
- 审计和成员治理独立，不塞进 General。

### 不要照搬

- 不复制 Supabase 的全量 product sidebar。
- 不把数据库/auth/storage/settings 的产品线结构搬到 Crab。
- 不从 P0 开始做复杂组织级权限和计费。
- 不让 secret value 在创建后默认可见。

## Crab P0 页面骨架汇总

### A. API Automation Workbench

参考主源：Hoppscotch。

结构：

- Left: Collection / Scenario tree。
- Center: Request / Step editor。
- Right: Response / Assertion / Evidence inspector。
- Bottom: Runner / Logs / Extraction / History。

核心迁移理由：它是最适合高频 API 编排的密集工作台。

### B. Execution Evidence Detail

参考主源：Playwright，辅源 Allure。

结构：

- Top: execution status。
- Left: proof step/action list。
- Center: screenshot / video / trace preview。
- Right: failure explanation / evidence quality / report impact。
- Bottom: call / log / errors / console / network / source / attachments。

核心迁移理由：失败定位和证据检查必须在同一屏完成。

### C. Proof Report

参考主源：Allure。

结构：

- First screen: decision / risk / why / confirmer。
- Drill-down: Evidence Matrix / State Transitions / Cases / Executions / Artifacts / History / Environment。
- Detail inspector: selected evidence row, attachments, reviewer decision。

核心迁移理由：保留 Allure 的两层报告消费，但把第一心智从测试报告换成发布证明。

### D. Knowledge Source Detail

参考主源：Dify，辅源 Open WebUI。

结构：

- Sources list。
- Source detail: Documents / Indexing / Retrieval Test / Citations / Usage / Settings。
- Retrieval test: query -> retrieved chunks -> citation preview -> attach to Proof Case。

核心迁移理由：可信 AI 需要可验证来源，而不是黑箱 RAG。

### E. Skill Asset Detail

参考主源：Open WebUI，辅源 Dify。

结构：

- Left: categories/context filters。
- Center: skill assets。
- Right: instruction preview / bindings / permissions / dependencies。
- Bottom: invocation history / artifacts / review notes。

核心迁移理由：Skill 是可治理资产，Chat 只是调用入口。

### F. MCP Governance Center

参考主源：Cline。

结构：

- Left: server cards/list。
- Center: server detail tabs: Overview / Tools / Resources / Prompts / Permissions / Invocation Logs。
- Right: permission inspector。
- Bottom: logs and redacted payload preview。

核心迁移理由：AI 工具调用必须可见、可审、可追溯。

### G. Project Governance Settings

参考主源：Supabase。

结构：

- Left: General / Members / Model Providers / Credentials / Audit / Danger Zone。
- Center: selected setting form/table。
- Right: scope/risk/usage inspector。
- Bottom: audit/validation/usage trail。

核心迁移理由：低频治理要收敛，凭据和危险动作要隔离。

## 设计结论

这 7 个参考产品给 Crab 的不是“模块菜单”，而是 7 类成熟页面结构：

1. Hoppscotch 证明 API 自动化应该是 workbench，不是表单。
2. Playwright 证明执行详情应该先定位失败 step，再展示 trace/log/source。
3. Allure 证明报告需要 overview + drill-down + artifact preview。
4. Dify 证明知识库必须有 document status 和 retrieval test。
5. Open WebUI 证明 Knowledge / Skills / Tools / Models 要分离治理。
6. Cline 证明 AI tool call 和 MCP permission 必须显性化。
7. Supabase 证明 settings 要按治理对象分组，credentials 和 danger zone 要有边界。

Crab 的统一落点是 Proof Case：

- API response 是 evidence。
- UI trace 是 evidence。
- Allure-style report 是 proof report。
- Knowledge 是 AI source trust。
- Skill 是 governed AI capability。
- MCP tool 是 audited external capability。
- Settings 是 project governance。

后续所有页面设计评审都应检查：这个页面是否加强了 Proof Case 的证据链。如果没有，就不应该成为 P0 的核心页面。
