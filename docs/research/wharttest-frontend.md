# WHartTest — Frontend / Skills / WeChat Plugin Host (Clean-Room Audit)

> Audit scope: `WHartTest_Vue/`, `WHartTest_Skills/`, `WHartTest_WeixinPluginHost/`.
> This is a capability-level clean-room audit. No source code, styles, prompts, or
> asset text was copied. Route paths, page names, and skill IDs are quoted as
> factual references only. No WHartTest file was modified.

Source root: `D:\code\normal\RJ-CLI\crab-auto-test\WHartTest`

---

## 1. Frontend (Vue) Overview & Tech Stack

The Vue frontend (`WHartTest_Vue`, package version 2.5.0) is a single-page
application that serves as the entire operator console for the WHartTest
platform — covering test management, AI generation, API/UI automation, skills,
knowledge base, requirements review, and WeChat bot integration.

Tech stack (paraphrased from `package.json`):

- **Framework**: Vue 3 (Composition API, `<script setup>`), TypeScript (~5.8),
  Vite 6 build tooling, `vue-tsc` for type-aware builds.
- **Routing**: `vue-router` 4 in HTML5 history mode, with a global `beforeEach`
  guard enforcing auth and a public-route whitelist (login/register).
- **UI library**: `@arco-design/web-vue` (Arco Design Vue) as the primary
  component system, supplemented by `wired-elements` and TailwindCSS 4
  (`@tailwindcss/postcss`) for styling. Less + sass-embedded for authoring.
- **State management**: Pinia (v3). Stores are split into small, focused
  modules under `src/store/` (auth, locale, project, systemConfig, theme) plus
  feature-scoped stores under each feature (e.g. `api-testing/stores/`).
- **HTTP client**: Axios, wrapped by a shared `src/utils/request.ts` helper
  that talks to a configurable base URL (`/api` by default, overridable via
  `VITE_API_BASE_URL`). A central endpoint registry lives in `src/config/api.ts`.
- **Editor & rich content**: `monaco-editor` + `@guolao/vue-monaco-editor` for
  code/JSON editing; `marked` + `dompurify` for rendering markdown safely;
  `pdf-lib` likely used for document/PDF work in the requirements editor.
- **Visualization & interaction**: `simple-mind-map` for the test-case
  mind-map view; `vuedraggable` for drag-and-drop ordering; `qrcode` for
  rendering WeChat login QR codes; `jmespath` for JSON path queries (API
  testing extraction).
- **Internationalization**: custom i18n layer under `src/i18n/` and a
  `useAppI18n` composable; components ship bilingual (zh/en) text maps inline.
- **Dev tooling**: `playwright` is a dev dependency (used by tests, not
  runtime). `@types/node`, `autoprefixer`, `postcss` for the build pipeline.

Project layout (from `WHartTest_Vue/README.md` and observed tree):

```
src/
  api/            (empty at audit time — services live in features/ + services/)
  components/     shared components (testcase, organization, permission, operation-log)
  composables/    useAppI18n, useStarryBackground, useLlmConfigRefresh, useLegacyDomTranslation
  config/         api.ts endpoint registry
  features/       feature modules (each with views/components/services/types)
  i18n/           locale adapter + apiTesting legacy map
  layouts/        MainLayout.vue (app shell)
  router/         index.ts (route table + auth guard)
  services/       shared domain services (auth, project, user, org, permission, ...)
  store/          global Pinia stores
  utils/          request, formatters, assetUrl, authErrorHandler
  views/          top-level pages not owned by a feature
```

Architecture pattern: **feature-sliced**. Each feature folder is largely
self-contained with its own `views/`, `components/`, `services/`, `types/`,
and sometimes `stores/` and `utils/`. Cross-cutting concerns (auth, project
context, theme, locale) live in the global `store/` and `services/`.

---

## 2. Route / Page Inventory

Route table from `WHartTest_Vue/src/router/index.ts`. The root `/` uses
`MainLayout` with `meta.requiresAuth: true` and redirects to `/dashboard`.
Public routes: `/login`, `/register`. Catch-all redirects to `/dashboard`.

| Route path | Name | Page (component) | Purpose (capability-level) |
|---|---|---|---|
| `/login` | Login | `LoginView` | Username/password sign-in; issues JWT access+refresh tokens. |
| `/register` | Register | `RegisterView` | New account registration. |
| `/dashboard` | Dashboard | `DashboardView` | Per-project KPI overview: test-case counts by review status, UI automation case/execution totals, API testing case/interface/execution stats, execution statistics. |
| `/projects` | ProjectManagement | `ProjectManagementView` | Project CRUD; the selected project scopes almost every other page. |
| `/users` | UserManagement | `UserManagementView` | User account CRUD. |
| `/organizations` | OrganizationManagement | `OrganizationManagementView` | Organization/team management. |
| `/permissions` | PermissionManagement | `PermissionManagementView` | RBAC permission assignment. |
| `/testcases` | TestCaseManagement | `TestCaseManagementView` | Functional test-case management with list + mind-map views; module tree; AI generate/edit/run entry points. |
| `/testsuites` | TestSuiteManagement | `TestSuiteManagementView` | Test suite grouping and batch organization. |
| `/test-executions` | TestExecutionHistory | `TestExecutionHistoryView` | Historical execution records for functional cases. |
| `/llm-configs` | LlmConfigManagement | `LlmConfigManagementView` (langgraph feature) | LLM provider/model configuration (multi-model). |
| `/langgraph-chat` | LangGraphChat | `LangGraphChatView` (langgraph feature) | Agent chat: LangGraph orchestration, tool approval, knowledge-base RAG toggle, system prompt, WeChat connect, token usage, diagram/HTML preview. |
| `/knowledge-management` | KnowledgeManagement | `KnowledgeManagementView` (knowledge feature) | Knowledge base CRUD, document upload/chunking, vectorization, retrieval, stats, global config (embedding/reranker), system status. |
| `/api-keys` | ApiKeyManagement | `ApiKeyManagementView` | API Key issuance/revocation for external/scripted access. |
| `/remote-mcp-configs` | RemoteMcpConfigManagement | `RemoteMcpConfigManagementView` | Remote MCP server endpoints config + ping/connectivity test. |
| `/requirements` | RequirementManagement | `RequirementManagementView` (requirements feature) | Requirement document upload, list, review kickoff. |
| `/requirements/:id` | DocumentDetail | `DocumentDetailView` | Requirement document detail; module splitting, context-limit check, structure analysis, review start/restart, progress. |
| `/requirements/:id/docx-editor` | DocxEditor | `DocxEditorView` | Online docx editor for the requirement document. |
| `/requirements/:id/report` | ReportDetail | `SpecializedReportView` | Specialized analysis / review report with version selector. |
| `/skills` | SkillsManagement | `SkillsManagementView` (skills feature) | Per-project Agent skills management: list, upload zip, git import, enable/disable, view content, skill store install/uninstall. |
| `/testcase-templates` | TemplateManagement | `TemplateManagementView` (testcase-templates feature) | Test-case templates with import/export. |
| `/api-testing` | ApiTesting | `ApiTestingView` (api-testing feature) | Tabbed API testing workspace (interfaces, testcases, tasks, reports, environments, functions, sync). |
| `/api-testing/testcases/create` | ApiTestCaseCreate | `TestCaseCreateView` | API test-case creation form. |
| `/api-testing/testcases/:id/edit` | ApiTestCaseEdit | `TestCaseEditView` | API test-case edit form. |
| `/api-testing/testcases/:id/reports` | ApiTestCaseReports | `TestCaseReportsView` | Per-case execution reports. |
| `/api-testing/tasks/create` | ApiTestTaskCreate | `TestTaskFormView` | API test task (suite run) creation. |
| `/api-testing/tasks/:id/edit` | ApiTestTaskEdit | `TestTaskFormView` | API test task edit. |
| `/api-testing/tasks/:id` | ApiTestTaskDetail | `TestTaskDetailView` | API test task detail + execution history. |
| `/api-testing/tasks/executions/:id` | ApiTestTaskExecutionDetail | `TestTaskExecutionDetailView` | Single task execution detail. |
| `/api-testing/tasks/executions/:id/case-results` | ApiTestTaskExecutionCaseResults | `TestTaskExecutionCaseResultsView` | Per-case results within a task execution. |
| `/api-testing/reports/:id` | ApiTestReportDetail | `TestReportDetailView` | Full API test report (header, status cards, execution steps, logs). |
| `/ui-automation` | UiAutomation | `UiAutomationView` (ui-automation feature) | Tabbed UI automation workspace (pages, page-steps, testcases, execution records, batch records, public data, env config, actuators). |
| `/ui-automation/trace/:id` | TraceDetail | `TraceDetail` | Playwright-style trace viewer for a UI execution. |
| `/task-center` | TaskCenter | `TaskCenterView` (task-center feature) | Unified task creation/execution/tracking across functional/API/UI; log viewer; UI case selection. |
| `/operation-logs` | OperationLogs | `OperationLogView` | Audit log of platform operations + cleanup settings. |
| `/:pathMatch(.*)*` | NotFound | (redirect) | Redirects unknown paths to `/dashboard`. |

Auth guard behavior: reads `authStore.isAuthenticated`; on first load it
rehydrates from `localStorage`. Unauthenticated users hitting a protected
route are redirected to `/login` with a `redirect` query param; authenticated
users hitting `/login` or `/register` are sent to `/dashboard`.

---

## 3. Frontend Capability Matrix

| UI area | Capability | Notes |
|---|---|---|
| **Dashboard** | Per-project KPI cards | Test cases (by review status: approved / pending / needs-optimization / optimization-pending), UI automation (cases, executions, success/failed), API testing (cases, interfaces, execution statuses), execution statistics. |
| **App shell (MainLayout)** | Global project selector + environment selector | Header-bound; switching project re-scopes downstream pages; environment selector appears for API testing. |
| | Theme toggle (dark/light) | `themeStore`; persisted. |
| | Locale toggle (zh/en) | `localeStore` + `AppLocaleToggle`; inline bilingual text in components. |
| | Version badge + update check | Polls release info; popover shows latest version + release notes preview; links to GitHub releases. |
| | List/mind-map view switch | Visible on the test-case management page. |
| **Auth** | Login (JWT access+refresh), register, token refresh, logout | `authService` + `authStore`; tokens + user + permissions persisted in `localStorage`. |
| | Permission loading | `userPermissions` array cached client-side for RBAC gating. |
| **Project management** | Project CRUD, selection, scoping | `projectStore.currentProjectId` drives most feature pages; many views render an empty state when no project is selected. |
| **User / Org / Permission** | User CRUD, organization members, RBAC permission tables/trees | `PermissionTable`, `PermissionTreeSelector`, `OrganizationMembersTable`. |
| **Test case management** | Module tree CRUD, case list + mind-map, case form (name/level/type/precondition/steps/expected/notes), copy/paste, drag-drop reorder, import/export | `simple-mind-map` powers mind-map; `vuedraggable` for ordering. |
| | AI generate cases | `GenerateCasesModal` — kicks off AI case generation from requirements/context. |
| | AI edit/optimize/fix cases | `OptimizationSuggestionModal` — AI-driven case repair. |
| | Execute cases + record | `ExecuteTestCaseModal`, `TestExecutionConfirmModal`, `TestExecutionListModal`, `TestExecutionReportModal`. |
| | Suites | `TestSuiteFormModal`, `TestSuiteDetailModal`, `TestSuiteListModal`. |
| **Test-case templates** | Template CRUD, import, export | `TemplateFormModal`, `ImportModal`, `ExportModal`. |
| **Requirements** | Document upload + list | `RequirementManagementView`. |
| | Document detail | Module splitting (`SplitOptionsModal`), context-limit check (`ContextCheckAlert`), structure analysis, confirm modules, start/restart review, review progress. |
| | Online docx editor | `DocxEditorView` (pdf-lib + monaco). |
| | Review report | `SpecializedReportView` with `ReportVersionSelector`. |
| | Requirement prompts | `requirementPromptService` (prompt per requirement type). |
| **API testing** | Module tree + interface CRUD | `InterfacesPanel`, `ModuleTree`, `ApiInterfaceList/Pagination`, `ApiDetail`. |
| | Request configuration | Body/params/headers/cookies via `ApiBodyConfig`, `ApiParamsConfig`, `ApiHeadersConfig`, `ApiRequestHeader`. |
| | Assertions & extraction | `ApiAssertConfig`, `ApiExtractConfig` (jmespath-based). |
| | Hooks (pre/post) | `ApiSetupHooksConfig`, `ApiTeardownHooksConfig`, `ApiHooksConfigEnhanced`, `ApiSqlHookEditor` (DB assertions). |
| | Response viewer | `ApiResponse`, `ResponseJsonViewer`, shared `JsonViewer`. |
| | Environments & variables | `EnvironmentsPanel`, `EnvironmentForm/List/Detail`, `EnvironmentVariableForm/List`, `GlobalHeadersPanel`, `DatabaseConfigPanel`. |
| | Custom functions | `FunctionsPanel`, `FunctionForm/List/Detail`. |
| | Test cases (API) | `TestCaseForm`, step config, variable manager, tag/group managers, referenced-interfaces dialog. |
| | Test tasks (suite runs) | `TestTaskForm`, `TestTaskDetail`, execution history, case-results, add-case modal. |
| | Reports | `TestReportsPanel`, `TestReportDetail` (header, basic info, status cards, execution steps, execution log, config info). |
| | Sync config | `SyncConfigPanel`, `ApiConfig`/`ApiConfigForm`/`ApiConfigDetail`/`ApiConfigTable`, `SyncHistory` (interface→step sync with rollback). |
| | Dashboard | `ApiDashboard` per-project API stats. |
| **UI automation** | Module tree | `ModulePanel`, `ModuleTree`. |
| | Pages | `PageList`. |
| | Elements | `ElementList` (locators). |
| | Page steps | `PageStepList`, `StepDetailList`. |
| | Test cases (UI) | `TestCaseList`. |
| | Execution records + batch | `ExecutionRecordList`, `BatchRecordList`. |
| | Trace viewer | `TraceDetail` (Playwright trace). |
| | Public data | `PublicDataList` (shared dataset). |
| | Env config | `EnvConfigList`. |
| | Actuators (execution machines) | `ActuatorList`. |
| | WebSocket streaming | `services/websocket.ts` — live execution updates. |
| **LangGraph chat** | Chat sessions | `ChatSidebar` (create/switch/delete/rename/batch-delete), `ChatMessages`, `MessageItem`, `ChatInput`. |
| | RAG toggle | `KnowledgeBaseSelector` — pick KB, set similarity threshold and top-k. |
| | System prompt | `SystemPromptModal`. |
| | Tool approval | `ToolApprovalCard`, `ToolApprovalDialog`, `ToolApprovalSettingsModal`, `toolApprovalService`. |
| | Token usage | `TokenUsageIndicator`. |
| | LLM config | `LlmConfigFormModal`, `LlmConfigTable`, `llmConfigService`. |
| | WeChat connect | `WeixinConnectModal`, `weixinService` — bind a WeChat bot account to the chat/project. |
| | Diagram / HTML preview | `diagramToolParser`, `htmlPreviewParser`, `toolResultParser` — render tool outputs inline. |
| | Orchestrator | `orchestratorService` — drives the multi-step LangGraph flow. |
| **Knowledge base** | KB CRUD | `KnowledgeBaseFormModal`, `KnowledgeBaseDetail`. |
| | Document upload | `DocumentUploadModal`. |
| | Document detail + chunks | `DocumentDetailModal` — chunk list with pagination, content segmentation, page ranges. |
| | Stats | `KnowledgeBaseStatsModal`. |
| | Global config | `KnowledgeGlobalConfigModal` — embedding model, reranker, global KB. |
| | System status | `SystemStatusModal` — connection health for embedding/vector store. |
| | Query logs | retrieval query log viewing. |
| **Skills** | List / detail / enable-disable | `SkillManager`. |
| | Upload zip | `skillService.uploadSkill`. |
| | Git import | `skillService` (git import response type). |
| | View skill content | `SkillContentResponse` (name/description/content). |
| | Skill store | `SkillStoreModal`, `SkillStoreSourceManager` — fetch manifest from configured store sources, install/uninstall (single + batch), preview readme, configure default source / custom source / max zip size. |
| **Task center** | Task form | `TaskFormModal` — create execution tasks across case types. |
| | UI case selection | `UiTestCaseSelectModal` — pick UI cases into a task. |
| | Log viewer | `LogViewModal`. |
| **API keys** | Issue / revoke / list | `ApiKeyManagementView`, `apiKeyService`. |
| **Remote MCP configs** | Endpoint CRUD + ping | `RemoteMcpConfigManagementView`, `remoteMcpConfigService`. |
| **Operation logs** | Audit log list + cleanup settings | `OperationLogView`, `OperationLogCleanupSettingsModal`. |
| **i18n** | Bilingual zh/en | `useAppI18n`, `AppLocaleToggle`, legacy translation adapter for API testing. |

---

## 4. Skills Catalog

`WHartTest_Skills/` is the curated skill store. A top-level `manifest.json`
(version "1") lists each skill with `id`, `name`, `description`, `version`,
`author`, `tags`, and `zip_path`. Each skill ships as both an unpacked folder
and a `.zip` (the zip is what the frontend skill store installs). Each skill
folder contains a `SKILL.md` (frontmatter: `name`, `description`, optional
`allowed-tools`) plus any executable helper scripts.

Skill categories and capabilities (paraphrased from each `SKILL.md`):

| Category | Skill ID | Capability | Notes |
|---|---|---|---|
| **Platform / test management** | `whart-test` | CRUD for projects, functional test-case modules, and test cases; screenshot upload (single + batch). | Backed by `whart_tools.py`; enforces "query-before-create"; review-status enum (pending_review / approved / needs_optimization / optimization_pending_review / unavailable) and test-type enum (smoke/functional/boundary/exception/permission/security/compatibility); `--is_optimization` flag auto-sets optimization-pending state. |
| **API automation** | `api-automation` | Full API testing lifecycle: modules, DB configs, environments/variables, custom functions, interface debug/run, test cases (steps/tags/groups), single + batch execution, reports, sync config + history/rollback. | Backed by `api_automation_tools.py`; supports `@file.json` payloads; returns JSON uniformly. Lifecycle: base resources → interface debug → case orchestration → execution & reports → suite batch → sync/rollback. |
| **UI automation** | `ui-automation` | CRUD for UI modules, pages, elements (locators), page steps, test cases, public data, env configs, actuators, execution records, batch records; execute cases; fetch execution data; AI error analysis. | Backed by `ui_automation_tools.py`; element-collection strategy prioritizes `agent-browser-skill`, falls back to `playwright-skill`; four-phase lifecycle (design → build → execute → analyze/fix); locator-quality standards and anti-patterns documented. |
| **Browser automation** | `agent-browser-skill` | Page snapshot acquisition, element interaction by ref, screenshots. | Wraps Vercel Labs `agent-browser` CLI (v0.27.0); SKILL.md is a stub that dynamically loads the latest guide via `agent-browser skills get core`. `allowed-tools: Bash(agent-browser:*)`. |
| | `playwright-skill` | Browser launch/navigation, element location + interaction, selectors, screenshots, waits, persistent-session mode, page-structure/text helpers. | Node-based (`run.js`, `lib/`, `package.json`); rule: "snapshot before interact"; screenshot-path convention via env var; full API reference doc included. |
| | `playwright-cli` | Interactive CLI browser automation via Microsoft `@playwright/cli`; open/goto/click/type/press/screenshot/close; ref-based interaction. | `allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)`; designed to avoid hang/timeouts. |
| **Knowledge base** | `weknora-kb` | List knowledge bases; search knowledge-base document fragments by query (with KB IDs and optional doc IDs). | Backed by `weknora_kb.py`; configured via `WEKNORA_BASE_URL` + `WEKNORA_API_KEY` env vars; integrates with the WeKnora KB platform. |
| **Diagramming** | `drawio` | Generate native `.drawio` (mxGraphModel XML) files; optional export to PNG/SVG/PDF with embedded XML (still editable in draw.io). | No MCP server; uses draw.io desktop CLI; XML-only because mermaid/CSV need server-side conversion. Ships `drawio/SKILL.md` + `README.md`. |

Skill packaging / registration / invocation model (inferred from frontend
types and the manifest):

- **Manifest-driven store**: the platform fetches a `SkillStoreManifest`
  (`version`, `updated_at`, `skills[]`) from each configured store source.
  Each `ManifestSkill` carries `id`, `name`, `name_en?`, `description`,
  `description_en?`, `version?`, `author?`, `tags?`, `zip_path`,
  `readme_path?`, `sha256?`.
- **Per-project installation**: a skill is installed into a project by
  uploading its zip (or git-importing). The backend stores `Skill` records
  with `name`, `description`, `skill_content`, `skill_path`, `script_path`,
  `is_active`, `project`, `creator`, timestamps.
- **Activation gating**: `is_active` toggles whether the skill is exposed to
  the project's Agent.
- **Store source management**: `SkillStoreConfig` controls `default_source`,
  `allow_custom_source`, `max_zip_size`; `SkillStoreSource` (`id`, `name`,
  `baseUrl`, `isDefault?`) lets operators point at multiple manifest URLs.
- **Invocation**: skills are invoked by the LangGraph agent (chat) via tool
  calls; browser skills declare `allowed-tools` (Bash globs) so the agent
  shells out to the skill's CLI/script. Platform skills (`whart-test`,
  `api-automation`, `ui-automation`) call back into the WHartTest REST API
  using project-scoped credentials.

---

## 5. WeChat Plugin Host

`WHartTest_WeixinPluginHost/` is a small TypeScript host (single `server.ts`,
run via `tsx`) that bridges the official Tencent WeChat (Weixin) plugin into
the WHartTest backend. It is **not** the chat UI — the chat UI is the
LangGraph chat view; this host is the sidecar process that owns the WeChat
account connection.

Purpose:

- Register and run the official `@tencent-weixin/openclaw-weixin` plugin
  (via the `openclaw` plugin SDK) so that a WeChat bot account can send and
  receive messages on behalf of a WHartTest project.
- Forward inbound WeChat messages to the WHartTest Django backend's
  `/api/weixin/plugin/inbound/` endpoint (authenticated with `X-API-Key`),
  and dispatch the backend's reply back out through WeChat.

Capabilities (paraphrased from `server.ts`):

- **HTTP control plane** on a configurable port (default 3001):
  - `GET /health` — liveness + backend base URL + openclaw state dir.
  - `POST /api/login/start` — start QR-code login; returns `sessionKey` +
    `qrDataUrl`.
  - `POST /api/login/status` — poll login completion via
    `waitForWeixinLogin`; on success persists the bot token, registers the
    account, clears stale accounts for the user, and reloads the channel.
  - `GET /api/accounts/status` — list all configured/running accounts with
    runtime snapshots (running, lastError, lastStartAt/StopAt, lastInbound/
    Outbound/EventAt).
  - `POST /api/accounts/start` — start the account monitor (bootstraps
    account from token/baseUrl/userId if not yet configured); runs the
    channel gateway with an `AbortController` for graceful shutdown.
  - `POST /api/accounts/stop` — abort the account monitor.
- **Inbound dispatch**: `callWhartTestInbound` POSTs the normalized message
  (account_id, peer_user_id, text, context_token, media_path, media_type,
  external_message_id, session_key) to the backend and returns the reply
  text.
- **Media handling**: `saveSharedMediaBuffer` persists inbound media
  (images/gif/webp/jpeg/mp4) to a shared media dir, capped at 20 MB, with
  content-type-derived extensions.
- **Session transcripts**: `recordInboundSession` appends JSONL transcripts
  per session key into the openclaw session store.
- **Reply runtime**: uses `openclaw/plugin-sdk` (`createReplyDispatcherWithTyping`,
  `finalizeInboundContext`, command-auth helpers) to queue and dispatch
  final replies with typing simulation.
- **Routing**: `resolveAgentRoute` maps `(accountId, peerId)` to a
  `wharttest-weixin` channel session key, routing inbound conversations to
  the `wharttest` agent.
- **State**: openclaw state dir + session store + media store live under a
  shared data dir (default `../data`), so the backend and plugin host share
  media/transcripts.

Integration with the rest of the platform:

- The **Vue frontend** (`features/langgraph/components/WeixinConnectModal.vue`
  + `features/langgraph/services/weixinService.ts`) calls backend endpoints
  `/weixin/login/start/`, `/weixin/login/:sessionKey/status/`, and account
  list/bind endpoints to drive QR login and bind a WeChat bot account to a
  project + prompt. The modal polls login status and shows the QR code
  (`qrcode` lib renders `qr_data_url`).
- The **Django backend** owns the canonical WeChat bot-account records
  (`WeixinBotAccount`: project, prompt, scanned_user_id, is_active,
  worker_running, status, last_error, last_inbound/outbound_at) and exposes
  the inbound endpoint the plugin host calls.
- The plugin host is the **only** component that holds the live WeChat
  socket; everything else talks to it over HTTP or to the backend over REST.

Env config (`.env.example`): `PORT`, `HOST`, `WHARTTEST_BACKEND_URL`,
`WHARTTEST_API_KEY`, `WHARTTEST_SHARED_DATA_DIR`. There is a `Dockerfile`
for containerized deployment.

---

## 6. Notes Relevant to a Clean-Room Rebuild

Capabilities to reimplement (not to copy). These are the surface areas a
parity rebuild must cover:

**Frontend**

- App shell with global project selector + environment selector, theme
  toggle (dark/light), locale toggle (zh/en), version/update badge, and a
  list/mind-map view switch on the test-case page.
- Auth: JWT login/register/refresh/logout, client-side permission cache,
  route guard with public whitelist + redirect-back.
- Dashboard: per-project KPI cards across functional / UI / API testing.
- Functional test-case management: module tree, list + mind-map views,
  full case form, copy/paste, drag-drop, import/export, suites, execution
  history + reports, AI generate/edit/optimize/fix entry points.
- Test-case templates with import/export.
- Requirements: upload, detail with module splitting + context-limit check
  + structure analysis, online docx editor, specialized review report with
  version selector.
- API testing: tabbed workspace (interfaces, cases, tasks, reports,
  environments, functions, sync); request config (body/params/headers);
  assertions + jmespath extraction; pre/post hooks incl. SQL hooks;
  response JSON viewer; environments/variables/global headers/DB configs;
  custom functions; sync config + history/rollback; per-project API
  dashboard.
- UI automation: tabbed workspace (pages, page steps, test cases, execution
  records, batch records, public data, env config, actuators); Playwright
  trace viewer; WebSocket-driven live execution updates.
- LangGraph chat: sessions sidebar, RAG toggle (KB + similarity + top-k),
  system prompt, tool approval (card + dialog + settings), token usage,
  LLM config table, WeChat connect modal, diagram + HTML preview parsers,
  orchestrator service.
- Knowledge base: KB CRUD, document upload, chunk viewer with pagination,
  stats, global config (embedding/reranker), system status, query logs.
- Skills: list/detail/enable-disable, zip upload, git import, content
  viewer, skill store (manifest fetch, install/uninstall single + batch,
  readme preview, multi-source config).
- Task center: cross-type task creation, UI case selection modal, log
  viewer.
- Admin: users, organizations, RBAC permissions, API keys, remote MCP
  configs (with ping), operation logs + cleanup settings.

**API surface (frontend → backend)** — the endpoint registry in
`src/config/api.ts` is the contract spec for the rebuild: auth (`/token/`,
`/accounts/register/`, `/token/refresh/`), projects, testcases, testcase-
modules, users, organizations, permissions, content-types, api-keys,
langgraph (`/lg/chat/`, `/lg/chat/history/`, `/lg/chat/sessions/`,
`/lg/llm-configs/`), knowledge (`/knowledge/knowledge-bases/`,
`system_status/`, `documents/`, `chunks/`, `query-logs/`, `/lg/knowledge/rag/`),
MCP tools (`/mcp_tools/remote-configs/`, `ping/`), prompts (user-prompts,
default, by-type, requirement prompts), requirements (documents, split-
modules, check-context-limit, analyze-structure, confirm-modules, module-
operations, start-review, restart-review, review-progress, issues), plus
feature-scoped endpoints under `/projects/{id}/...` (skills, api-testing,
ui-automation, task-center, weixin).

**Skills catalog**

- A manifest-driven skill store with per-project installation (zip upload +
  git import), activation gating, multi-source configuration, and
  readme/sha256 metadata.
- Skill categories to cover: platform test management, API automation, UI
  automation, browser automation (snapshot + ref interaction, plus a
  Playwright Node skill plus a Playwright CLI skill), knowledge-base
  query, and diagram generation.
- Each skill is a `SKILL.md` (frontmatter + prose guide) plus executable
  helpers; browser skills declare `allowed-tools` Bash globs for the agent.

**WeChat plugin host**

- A sidecar process owning the live WeChat socket, with an HTTP control
  plane (health, login start/status, accounts start/stop/status), inbound
  message forwarding to the backend's `/api/weixin/plugin/inbound/`
  endpoint (X-API-Key auth), media persistence (size-capped, content-typed),
  JSONL session transcripts, reply dispatch with typing simulation, and
  agent routing keyed by `(accountId, peerId)`.
- Shared data dir for media + openclaw state so the backend and host can
  both read transcripts/media.
- Frontend WeChat connect modal that drives QR login and binds a bot
  account to a project + prompt.

**Cross-cutting**

- Feature-sliced frontend architecture with shared `request.ts`, central
  endpoint registry, and global Pinia stores for auth/project/locale/
  theme/systemConfig.
- Bilingual (zh/en) inline text maps per component; no external locale
  message bundle — a rebuild may choose a standard i18n library instead.
- Heavy reliance on Arco Design Vue; a rebuild could substitute another
  component library but must match the interaction density (trees, tabs,
  tables with selection, modals, mind-map, monaco editor, drag-drop).
