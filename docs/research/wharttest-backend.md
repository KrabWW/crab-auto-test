# WHartTest Backend / MCP / Actuator — Clean-Room Capability Audit

> Scope: read-only audit of `WHartTest/WHartTest_Django/`, `WHartTest/WHartTest_MCP/`,
> `WHartTest/WHartTest_Actuator/`, plus deploy topology from the root compose files.
> All capability descriptions below are paraphrased from source. Short identifiers
> (route paths, model/tool names) are quoted as factual references only; no
> implementation, prompts, configs, or assets are copied. WHartTest-upstream was not
> separately audited (it is a reference duplicate).

---

## 1. Overview & Architecture (in my own words)

WHartTest is an AI-driven test management platform built on **Django 5.2 + DRF** with a
**Vue** frontend, packaged as a monorepo of six sub-projects: Django backend, Vue
frontend, a standalone **UI automation actuator**, an **MCP tool service**, a **Skill
library**, and an **online document editor** integration.

The platform's central idea: take a requirement (uploaded doc or free text), use an
LLM-plus-tools "Agent" to (a) review/split the requirement, (b) generate functional /
API / UI test cases, (c) optionally execute them, and (d) capture artifacts
(screenshots, traces, reports). Knowledge bases provide RAG context; MCP tools and a
Skill store extend the agent's reach; a task center schedules recurring runs.

Key architectural patterns observed:

- **Project-scoped multi-tenancy.** Almost every resource is nested under
  `projects/<id>/...`. A `BaseModelViewSet` + `IsProjectMember` permission gate enforces
  per-project isolation. Project credentials, members, and skill ownership hang off the
  `Project` model.
- **Async via Celery + Redis.** Document processing, requirement review, test-suite
  execution, knowledge ingestion, API test execution, and scheduled tasks are Celery
  tasks. A dedicated `task_center` queue is routed separately to avoid cross-consumer
  theft. `django_celery_beat` `DatabaseScheduler` backs cron-style scheduling.
- **Real-time UI execution over WebSocket.** Django Channels (`asgi.py`, `InMemoryChannelLayer`)
  exposes `/ws/ui/actuator/`. The actuator is a Python client that connects, receives
  task messages, drives Playwright, and streams `step_result` / `case_result` back.
- **Two AI execution models coexist:**
  1. **LangGraph chat** (`langgraph_integration`) — single-session LLM chat with tool
     approval, token accounting, RAG, checkpointer-backed history.
  2. **Agent Loop** (`orchestrator_integration`) — a multi-step orchestrator built on
     LangChain v1 `create_agent` + middleware (retry, summarization, HITL) to defeat
     token bloat by summarizing tool outputs into a "Blackboard" between steps.
- **Dual auth:** JWT (SimpleJWT, 12h access / 7d refresh) primary, project-scoped
  **API Key** fallback (so the actuator and MCP service can call the backend).
- **Unified JSON response envelope** via a custom renderer
  (`UnifiedResponseRenderer`) — `{status, code, message, data, errors}`.

---

## 2. Deploy Topology

Defined in `docker-compose.yml` (prebuilt ghcr images) and
`docker-compose.local.yml` (local source build). `run_compose.sh` is a unified launcher
that selects remote-pull vs local-build, runs db-check / db-upgrade / db-init actions,
and manages a `data/` volume tree.

Container / port map (host:container):

| Service | Container | Host port | Image / build | Notes |
|---|---|---|---|---|
| postgres | wharttest-postgres | 8919:5432 | postgres:16-alpine | max_connections=500; named volume `postgres-data` |
| redis | wharttest-redis | 8911:6379 | redis:7-alpine | appendonly; Celery broker+backend; named volume |
| backend | wharttest-backend | 8912:8000 | ghcr.io/mgdaaslab/wharttest-backend | uvicorn ASGI; supervisord runs django+celery worker+celery beat |
| weixin-plugin-host | wharttest-weixin-plugin-host | 8922:3001 | built from `WHartTest_WeixinPluginHost` (node:22) | WeChat bot bridge; calls backend via `WHARTTEST_BACKEND_URL` |
| frontend | wharttest-frontend | 8913:80 | ghcr.io/mgdaaslab/wharttest-frontend | nginx-served Vue dist; SPA fallback also handled by Django |
| mcp | wharttest-mcp | 8914:8006, 8915:8007 | ghcr.io/mgdaaslab/wharttest-mcp | supervisord runs `WHartTest_tools.py` (8006) + `ms_mcp_api.py` (8007) |
| playwright-mcp | wharttest-playwright-mcp | 8916:8931 | mcr.microsoft.com/playwright/mcp | official Playwright MCP; chromium headless, viewport 1920x1080 |
| qdrant | wharttest-qdrant | 8918:6333 | qdrant/qdrant:latest | vector DB; 2G mem limit; named volume |
| xinference | (commented out) | 8917:9997 | xprobe/xinference | optional local embedding+reranker (bge-m3, bge-reranker-v2-m3); deploy-scripts/bootstrap provided |

Backend env wiring of note: `DATABASE_TYPE` switches postgres/sqlite;
`LANGGRAPH_CHECKPOINT_SQLITE_PATH` keeps agent chat history in a separate sqlite file;
`QDRANT_URL`, `CELERY_BROKER_URL`, `DJANGO_BASE_URL` (internal self-call for Celery),
`WEIXIN_PLUGIN_HOST_URL`, `SKILL_STORE_DEFAULT_SOURCE` (a GitHub raw URL serving the
skill store manifest+zips). `WHartTest_Skills/` is bind-mounted read-only into the
backend at `/app/bundled_skills` for seeded skills.

Backend process supervisor (`WHartTest_Django/supervisord.conf`): `django` (uvicorn),
`celery_worker` (`-Q celery,task_center --concurrency=4`), `celery_beat`. MCP
supervisor runs both MCP scripts. Windows Celery falls back to `solo` pool.

---

## 3. Backend (Django) Capability Matrix

Settings: ~30 installed apps; BigAutoField PKs; zh-Hans default, en supported; Asia/Shanghai TZ;
i18n middleware; `OperationLogMiddleware` records user actions; CORS allowlist; DRF with
JWT+APIKey auth, django-filters, search/ordering, drf-spectacular OpenAPI at
`/api/schema/{,swagger-ui/,redoc/}`. SPA catch-all serves Vue `dist/index.html` when present.

### 3.1 Auth & Access Control — `accounts/`, `api_keys/`

| Capability | Key endpoints / models | Notes |
|---|---|---|
| Login (JWT) | `POST /api/token/`, `/api/token/refresh/` | `MyTokenObtainPairView`; access 12h, refresh 7d, rotate-on-refresh |
| Register / current user | `POST /api/accounts/register/`, `GET /api/accounts/me/` | `UserCreateAPIView`, `CurrentUserAPIView` |
| Users / Groups / Permissions | `GroupViewSet`, `UserViewSet`, `PermissionViewSet`, `ContentTypeViewSet` | Django model perms + custom `HasModelPermission`; bulk user/group perm assignment serializers |
| API Keys | `/api/...` (api_keys.urls) | `APIKey` model + `APIKeyAuthentication` fallback; default seeded key `wharttest-default-mcp-key-2025` (prod must rotate) |

`accounts/models.py` is essentially empty (uses Django's User/Group); all logic in
views/serializers. Admin bootstrap via `init_admin` management command.

### 3.2 Project & Multi-tenancy — `projects/`

`Project`, `ProjectCredential`, `ProjectMember`. `ProjectViewSet` with actions for
members list/add/remove/update and credentials. `IsProjectMember` permission reused
across nested resources. Most other apps register under `projects_router` (NestedSimpleRouter),
giving routes like `/api/projects/<id>/testcases/...`, `/api/projects/<id>/api-testcases/...`.

### 3.3 Functional Test Cases — `testcases/`

Models: `TestCase`, `TestCaseStep`, `TestCaseModule`, `TestCaseScreenshot`,
`TestSuite`, `TestExecution`, `TestCaseResult`. ~474-line models file.

| Capability | Endpoint pattern | Notes |
|---|---|---|
| CRUD + tree | `projects/<id>/testcases/`, `testcase-modules/` | list + mind-map views; copy/paste/drag; import/export Excel via `testcase_templates` |
| Screenshots | `upload-screenshots`, `screenshots`, `screenshots/batch-delete` | attach execution evidence |
| Suites & execution | `test-suites/`, `test-executions/` | `execute_test_suite` Celery task runs cases concurrently (semaphore-bounded); `cancel_test_execution`; `results` / `report` actions |
| AI execution bridge | tasks.py `_execute_testcase_via_chat_api` | functional cases are executed by calling the LangGraph chat API with the case as a prompt; optional `generate_playwright_script` flag |

### 3.4 API Automation — `api_interfaces/`, `api_testcases/`, `api_testtasks/`, `api_environments/`, `api_modules/`, `api_functions/`, `api_database_configs/`, `api_sync/`

A full HTTPRunner-based API testing asset layer, all project-nested.

| Domain | Models / actions | Notes |
|---|---|---|
| Interface definitions | `ApiInterface` (http or sql type), `ApiInterfaceResult`; debug-run action | supports HTTP methods + SQL methods (fetchone/many/all, insert/update/delete) |
| Test cases | `ApiTestCase`, `ApiTestCaseStep`, `ApiTestCaseTag`, `ApiTestCaseGroup`, `ApiTestReport`, `ApiTestReportDetail` | `run` action; `TestCaseRunner` extends HttpRunner; `BatchTestCaseRunner`; variable extraction, pre/post scripts, assertions |
| Tasks | `ApiTestTaskSuite`, `ApiTestTaskCase`, `ApiTestTaskExecution`, `ApiTestTaskCaseResult` | `add-testcases`, `case-results`, `cancel` actions |
| Environments | `ApiEnvironment`, `ApiEnvironmentVariable`, `ApiGlobalRequestHeader` | env switch, global headers, variable sets |
| Modules / functions | `ApiModule` (tree), `ApiCustomFunction` | user-defined helper functions |
| DB configs | `ApiDatabaseConfig` with `test-connection` action | used by SQL-type interfaces & assertions |
| Sync | `ApiSyncConfig`, `ApiSyncHistory`, `ApiGlobalSyncConfig` | pull interface definitions from external sources (sync_from / sync_to actions); manual/auto/batch modes |

HttpRunner integration is the execution engine (`api_testcases/runner.py`,
`httprunner/` package, `prepare_request_body_for_runner`).

### 3.5 UI Automation — `ui_automation/`

~498-line models file. Models: `UiModule`, `UiPage`, `UiElement`, `UiPageSteps`,
`UiPageStepsDetailed`, `UiTestCase`, `UiCaseStepsDetailed`, `UiBatchExecutionRecord`,
`UiExecutionRecord`, `UiPublicData`, `UiEnvironmentConfig`. Routes under
`/api/ui-automation/` (`modules`, `pages`, `elements`, `page-steps`,
`page-steps-detailed`, `testcases`, `case-steps`, `execution-records`, `public-data`,
`env-configs`, `actuators`, `batch-records`) plus `screenshots/upload/`,
`traces/upload/`, `trigger-batch/`.

| Capability | Notes |
|---|---|
| Page Object model | pages → elements → page-steps (reusable step sequences) → test cases |
| Actuator registry | `ActuatorViewSet` tracks connected UI executors |
| Execution dispatch | backend pushes task over WebSocket `/ws/ui/actuator/`; `UiAutomationConsumer` + `SocketUserManager` track connected actuators and route messages |
| Artifacts | screenshot + Playwright trace upload endpoints; `trace` action on records; `trigger_batch` for batch runs |
| Real-time | Django Channels consumer (`consumers.py`), `socket_models.py`, `routing.py` |

### 3.6 Knowledge Base & RAG — `knowledge/`

Models: `KnowledgeGlobalConfig`, `KnowledgeBase` (UUID PK, project-scoped, chunk_size/overlap),
`Document` (pdf/docx/xlsx/pptx/txt/md), `DocumentChunk` (vector_id ref to Qdrant),
`QueryLog`. Routes under `/api/knowledge/`.

| Capability | Notes |
|---|---|
| Embedding/Reranker config | global config model; `embedding-services`, `test-embedding-connection`, `test-reranker-connection` actions; default bge-m3 + bge-reranker-v2-m3 via Xinference |
| Document ingestion | `process_document` Celery task: parse → chunk (RecursiveCharacterTextSplitter) → embed → store in Qdrant |
| Vector store warmup | `apps.ready` spawns a thread to warm vector stores on boot |
| RAG service | `langgraph_integration.py` builds a LangGraph `StateGraph` with retrieve + generate nodes; `ConversationalRAGService` adds query analysis; `create_knowledge_tool` exposes a `knowledge_search` LangChain tool |
| Cross-tenant | global knowledge base config; project KBs unique by (project, name) |

### 3.7 Requirements & Intelligent Review — `requirements/`

~449-line models file. Models: `RequirementDocument`, `DocumentImage`,
`RequirementModule`, `ReviewReport`, `ReviewIssue`, `ModuleReviewResult`.
Routes under `/api/requirements/`.

| Capability | Action / endpoint | Notes |
|---|---|---|
| Upload & parse | `documents` CRUD; docx/txt extraction via `DocumentProcessor` | extracts text + images; image placeholders for vision LLMs |
| Online editor | `docx-editor/session`, `launch-online-editor`, `upload-edited-file`, `download-file`, `images-list`, `images/{id}` | integrates external DOCX editor service (`DOCX_EDITOR_BASE_URL` + service key) |
| Module splitting | `split-modules`, `check-context-limit`, `adjust-modules`, `confirm-modules` | LLM splits doc into reviewable modules with token-aware chunk sizing (`ContextLimitChecker`, `calculate_optimal_chunk_size`) |
| Review | `start-review`, `restart-review`, `module-operations` | `execute_requirement_review` Celery task; specialized analyses; produces `ReviewReport` with scores + `ReviewIssue`s |
| Context management | `context_limits.py` (`MODEL_CONTEXT_LIMITS` table, vision-support detection, reserved-token calc) | reused by orchestrator for summarization thresholds |

### 3.8 LLM Chat & Agent Orchestration — `langgraph_integration/` + `orchestrator_integration/`

`langgraph_integration/models.py`: `LLMConfig` (provider openai_compatible/deepseek/qwen,
api_url, api_key, system_prompt, supports_vision, context_limit, timeout, retries,
enable_summarization/enable_hitl/enable_streaming, single-active), `ChatSession`,
`ChatMessage`, `TokenUsageRecord`, `UserToolApproval`. Routes under `/api/lg/`:
`llm-configs`, `tool-approvals`, `chat/`, `chat/resume/`, `chat/history/`,
`chat/sessions/`, `chat/batch-delete/`, `token-usage/`, `knowledge/rag/`, `providers/`.

`orchestrator_integration/models.py`: `OrchestratorTask` (interactive execution plan,
history, current_step, waiting_for, requirement_analysis, knowledge_docs, testcases),
`AgentTask`, `AgentStep`, `AgentBlackboard`. Routes under `/api/orchestrator/`:
`tasks` (read-only history) + `agent-loop/`, `agent-loop/stop/`, `agent-loop/resume/`.

| Capability | Notes |
|---|---|
| LLM abstraction | `create_llm_instance` builds `ChatOpenAI` (OpenAI-compatible) from `LLMConfig`; DeepSeek via custom chat model wrapper (`deepseek_chat_model.py`) |
| Agent Loop (v2) | `agent_loop_view.py` uses LangChain v1 `create_agent` + middleware: `ModelRetryMiddleware`, `ToolRetryMiddleware`, `SummarizationMiddleware` (auto context compress), `HumanInTheLoopMiddleware` (tool approval). SSE streaming with `step_start`/`step_complete` events |
| Stop / resume | in-memory `StopSignalManager` (thread-safe, TTL 300s) for interrupt; resume after HITL approval |
| Blackboard pattern | `AGENT_LOOP_DESIGN.md` describes splitting one long conversation into many short ones; per-step context built from blackboard history_summary (last 10), full tool outputs stored as refs |
| Checkpointer | `checkpointer.py` persists LangGraph state to a dedicated sqlite file (`LANGGRAPH_CHECKPOINT_SQLITE_PATH`) |
| Friendly errors | `middleware_config.py` maps provider error codes (content audit, rate limit, model cooldown, 429) to user-facing messages with retry-after |
| Token accounting | `TokenUsageRecord` + `token-usage/` stats |

### 3.9 MCP Tools (backend side) — `mcp_tools/`

Models: `RemoteMCPConfig` (registers external MCP servers), `MCPTool` (cached tool list
per config). Routes under `/api/mcp_tools/`: `remote-configs` CRUD, `remote-configs/ping/`
(connectivity test), `call/` (`MCPToolRunnerView` — invoke any registered MCP tool).

| Capability | Notes |
|---|---|
| Multi-server client | uses `langchain_mcp_adapters.client.MultiServerMCPClient`; auto-appends `/mcp` for HTTP transport |
| Tool sync | `services.sync_mcp_tools` lists tools from a remote config and persists them |
| Persistent sessions | `persistent_client.py` `PersistentMCPClient` + `GlobalMCPSessionManager` keep MCP connections alive across agent steps, cache tools per (user, project, session), handle reconnect on connection errors |
| Cross-conversation browser | documented in `README_CROSS_CONVERSATION_BROWSER.md` — shared browser session across chats |

### 3.10 Skills Library — `skills/`

~553-line models file. `Skill` model (project-scoped, name, description, source type,
entry point, args schema, enabled, manifest). Routes under `projects/<id>/skills/`:
CRUD + `upload` (zip), `import-git`, `import-zip-url`, `content`, `store-config`,
`store-manifest`, `store-readme`.

| Capability | Notes |
|---|---|
| Skill store | default source points at a GitHub raw dir serving `manifest.json` + per-skill zips; configurable custom sources; 10MB zip cap, 60s download timeout |
| Install paths | zip upload, git clone (subprocess with timeout), zip-from-url |
| Bundled skills | `init_skills` management command syncs `/app/bundled_skills` (bind-mounted from `WHartTest_Skills/`) on deploy |
| Execution | skills are exposed to the agent as LangChain tools via `orchestrator_integration/builtin_tools/skill_tools.py`; persistent Playwright session per skill dir; artifacts/screenshots collected to media |
| Security | high system privilege; README warns intranet-only, never public-expose |

### 3.11 Task Center & Scheduling — `task_center/`

Models: `ScheduledTask` (ScheduleType DAILY/WEEKLY/HOURLY/ONCE; TaskModule
UI_AUTOMATION / TEST_SUITE / etc.), `TaskExecution`. Routes under
`projects/<id>/scheduled-tasks/`, `task-executions/`. Actions: `enable`, `disable`,
`run-now`, `executions`, `log`, `remove`.

| Capability | Notes |
|---|---|
| Scheduler | `scheduler.py` builds `django_celery_beat` `CrontabSchedule` / `ClockedSchedule` + `PeriodicTask`; ONCE uses clocked one-off |
| Dispatch | `execute_scheduled_task` Celery task (on `task_center` queue) routes by module to UI automation or test-suite execution |
| Standby guard | disabled tasks skip scheduled triggers; manual `run-now` still allowed |

### 3.12 Prompts & Templates — `prompts/`, `testcase_templates/`

`UserPrompt` model (per-user prompt library) + `default_templates/` seeded.
`ImportExportTemplate` for Excel case import/export column mapping.
`export_service.py` / `import_service.py` handle the spreadsheet round-trip.

### 3.13 WeChat Integration — `weixin_integration/`

Models: `WeixinLoginSession` (qrcode, bot_token), `WeixinBotAccount`,
`WeixinConversation`, `WeixinConversationMessage`. Routes under `/api/weixin/`.
`WeixinLoginStartAPIView`, `WeixinLoginStatusAPIView`, bot account list/toggle.
`services.py` talks to an `ilink/bot/*` HTTP API (getupdates, sendmessage) via the
separate `weixin-plugin-host` Node container; a Celery task polls for updates.

### 3.14 Operation Logs — `operation_logs/`

`OperationLog` + `OperationLogSetting`. `OperationLogMiddleware` records key mutations.
`cleanup_operation_logs` Celery task enforces retention.

### 3.15 Cross-cutting infra

- `renderers.py` `UnifiedResponseRenderer` — wraps all DRF responses in the envelope.
- `permissions.py` — `DjangoModelPermissions` extension + `HasModelPermission`.
- `viewsets.py` `BaseModelViewSet` — shared base with project scoping + permission wiring.
- `safe_log_handler.py` `SafeTimedRotatingFileHandler` — rotation that won't crash on locked files.
- `checkpointer.py` — async LangGraph checkpointer factory.
- `data_variant.py` — postgres db-name / sqlite path resolution (supports a `POSTGRES_DB_VARIANT=auto` mode).
- `i18n.py` — locale activation; `locale/` translation resources.

---

## 4. MCP Capability Matrix (WHartTest_MCP/)

Standalone FastMCP-based service, two apps run under supervisord. Bridges to the Django
backend over REST + API Key.

| App (port) | Tool category | What it does | Notes |
|---|---|---|---|
| `WHartTest_tools.py` (8006) | Project/module lookup | list projects by name+id; list modules under a project | calls backend `/api/...` with `WHARTTEST_API_KEY` |
| | Case metadata | fetch case levels (P0–P3) and test types (smoke/functional/boundary/exception/permission/security/compatibility) | enums mirror backend |
| | Case CRUD | list cases by project+module; get case detail; **save** functional case; **edit** functional case | fields: name, precondition, level, module, steps, review_status, test_type |
| | Screenshots | save operation screenshot to a case | file_path, title, description, step_number, page_url |
| | Diagrams (drawio) | `display_diagram` (create/replace), `edit_diagram` (operation list) | validates `mxGraphModel` XML; returns XML for frontend render |
| `ms_mcp_api.py` (8007) | MS platform bridge | project/module/level lookup, generate step data, save functional case to an external "MS" test platform | AES-encrypted auth (`MS_ACCESS_KEY`/`MS_SECRET_KEY`); env-driven `MS_API_HOST` |

A separate **Playwright MCP** (official Microsoft image) runs as its own container on
8916→8931, configured via `playwright-mcp-config.json` (chromium, headless, 1920×1080,
isolated context, ignoreHTTPSErrors). It is consumed by the agent as a remote MCP server
through the backend's `RemoteMCPConfig` + `MultiServerMCPClient`.

Connection model: MCP clients register via `mcpServers` JSON (`command`/`args`/`env`);
FastMCP exposes tools over stdio/HTTP. The backend's `GlobalMCPSessionManager` keeps
long-lived sessions per (user, project) so a browser opened in one chat step persists
into the next.

---

## 5. Actuator Capability Matrix (WHartTest_Actuator/)

A Python service that drives real browser automation. Connects to Django over
WebSocket (`/ws/ui/actuator/`) and fetches case/step detail over REST. Packable to a
standalone EXE via PyInstaller (`build_exe.py`, `actuator.spec`) for distribution;
supports distributed deployment (multiple actuators → one backend; backend picks an
available actuator).

| Component | Role |
|---|---|
| `main.py` | entry; arg parsing (`--server`, `--api`, `--id`, `--log-level`); optional GUI launcher (`gui/login_window.py`) |
| `websocket_client.py` | connects, builds origin/connect URL, sends `t_set_actuator_info`, `send_result` |
| `consumer.py` | `TaskConsumer` with asyncio queue; routes `func_name` → handler |
| `executor.py` | `PlaywrightExecutor` — the Playwright engine (~54KB) |
| `data_processor.py` | loads project public variables, resolves runtime data |
| `models.py` | shared message models (`QueueModel`, `SocketDataModel`, `StepResultModel`, `CaseResultModel`, `UiSocketEnum`) |
| `browser_installer.py` | ensures Chromium is installed (auto-download on first run) |

Message protocol (`SocketDataModel`): `{code, msg, user, is_notice, data:{func_name, func_args}}`.
Task types routed: `u_page_steps`, `u_test_case`, `u_test_case_batch`, `u_stop_execution`;
results sent back as `u_step_result` / `u_case_result`.

Executor capabilities (from `PlaywrightExecutor`):

- **Locators:** xpath, css, id, name, text, role, placeholder, label, testid (up to 3
  chained locator levels + iframe support + index).
- **Operations:** goto, wait (timeout), click, fill, check, select_option, hover, press,
  upload (set_input_files), plus assert/evaluate-style steps.
- **Step config:** `StepConfig` (operation_type, locator_type/value, input_value, iframe
  locator, multi-level locators); `PageStepConfig`, `TestCaseConfig`.
- **Trace capture:** `browser_session_with_trace` starts/stops Playwright tracing
  (screenshots + snapshots + optional sources), writes a timestamped `.zip` to
  `trace_dir`, exposes `get_current_trace_path`.
- **Screenshots:** per-step screenshot dir; uploaded via backend `/traces/upload/`.
- **Environment:** resolves `base_url` from `UiEnvironmentConfig`; initializes
  `DataProcessor` with project public data for variable substitution.

Workflow: connect → wait for task → fetch step/case detail via REST → convert step
config to Playwright calls → execute → stream `step_result`/`case_result` back → upload
trace+screenshots.

---

## 6. Notable Technical Choices

1. **Dual AI runtime.** A "classic" LangGraph chat (single conversation, checkpointer)
   for interactive Q&A and a separate "Agent Loop" (LangChain v1 `create_agent` +
   middleware) for long multi-tool tasks. The Blackboard design explicitly solves
   token explosion from Playwright DOM snapshots by summarizing tool outputs between
   steps rather than accumulating raw `ToolMessage`s.
2. **Middleware-driven resilience.** `ModelRetryMiddleware` + `ToolRetryMiddleware`
   replace hand-rolled retry loops; `SummarizationMiddleware` replaces a custom
   `ConversationCompressor`; `HumanInTheLoopMiddleware` adds tool-level approval
   gated by `LLMConfig.enable_hitl`. Friendly error mapping for provider rate limits
   / content audits / cooldowns with `retry_after` propagation.
3. **HttpRunner as the API engine.** API test cases lean on HttpRunner's
   `Config`/`Step`/`RunRequest`/`RunSqlRequest`, including SQL steps, variable
   extraction, pre/post scripts, and a "safe mode" request-record rebuild path.
4. **Project-nested everything.** `NestedSimpleRouter` under `projects/<id>/` for
   nearly all resources; `BaseModelViewSet` + `IsProjectMemberForResource` enforce
   isolation. API Key auth is project-scoped.
5. **Celery topology.** Single Redis broker/backend; `task_center` tasks routed to a
   dedicated queue and consumed alongside `celery` queue by one worker
   (`-Q celery,task_center`); `django_celery_beat` DatabaseScheduler for cron.
6. **Vector DB split.** Qdrant holds vectors (referenced by `DocumentChunk.vector_id`);
   Postgres holds metadata. Optional self-hosted Xinference for embeddings+reranker,
   with HuggingFace mirror env support.
7. **Two Playwright surfaces.** (a) The official Playwright MCP container for
   agent-driven ad-hoc browser actions; (b) the custom Actuator for deterministic,
   step-config-driven UI test execution with trace capture. Plus a persistent
   per-skill Node Playwright subprocess (`playwright_persistent_server.js`) for
   skills that need a stable browser across tool calls.
8. **Unified response envelope + i18n.** Every DRF response funnels through
   `UnifiedResponseRenderer`; zh-Hans/en locale negotiation in middleware; per-app
   loggers with safe rotating handlers.
9. **DOCX editor integration.** Requirement documents can be edited online via an
   external DOCX editor service (session creation, file upload/download, image
   extraction) using a service-key handshake.
10. **WeChat bridge.** A separate Node `weixin-plugin-host` container brokers WeChat
    bot login (qrcode scan) and message polling; the Django side stores sessions,
    polls updates via Celery, and exposes login-status + bot-account endpoints.

---

## 7. Relevance to a Clean-Room Rebuild

Capabilities to reimplement (describe, don't copy):

- **Multi-tenant project model** with members, credentials, and per-resource permission
  gating, plus a unified JSON response envelope.
- **JWT + project-scoped API Key** dual auth; default-key seeding with prod rotation.
- **Functional test case management** (tree modules, list + mind-map, suites,
  executions, screenshots, Excel import/export with column-mapping templates).
- **API automation asset layer** (interfaces incl. SQL type, environments, variables,
  global headers, modules, custom functions, DB configs, tags/groups, sync from
  external sources) with an HttpRunner-class engine for run/assert/extract.
- **UI automation asset layer** (pages, elements, page-steps, cases, public data, env
  configs) + a WebSocket-driven actuator protocol with step/case result streaming and
  Playwright trace/screenshot capture.
- **Knowledge base + RAG**: document upload/parse/chunk/embed/vector-store (Qdrant),
  global embedding+reranker config, LangGraph retrieve→generate RAG, conversational
  variant, knowledge-as-tool.
- **Requirement review pipeline**: upload/parse, online DOCX editing, token-aware
  module splitting, specialized review producing scored reports + issues, restartable.
- **Agent orchestration**: multi-step loop with context summarization, tool approval
  (HITL), stop/resume, blackboard state, SSE step events, friendly LLM error mapping.
- **MCP integration**: register remote MCP servers, ping/test, persistent sessions
  cached per (user,project), call-any-tool endpoint, official Playwright MCP as a
  remote server.
- **Skill library**: install from zip/git/url, store manifest+download, bundled-skill
  seeding, expose skills as agent tools with persistent browser + artifact capture.
- **Task center**: cron/hourly/daily/weekly/once scheduling via DatabaseScheduler,
  module-routed dispatch, enable/disable/run-now, execution history + logs.
- **Operation logging** with retention cleanup.
- **WeChat login + bot bridge** via a sidecar container.
- **Observability**: per-app loggers, safe rotating handlers, token-usage stats.

Deploy shape to reproduce: Postgres + Redis + Qdrant + (optional Xinference) +
backend (uvicorn + celery worker + beat) + frontend (nginx SPA) + MCP service +
Playwright MCP + WeChat plugin host, with a unified `run_compose.sh` supporting
remote-pull vs local-build and db-init/upgrade actions.

Audit complete; no WHartTest files were modified.
