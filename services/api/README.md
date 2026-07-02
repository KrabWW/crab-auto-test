# Crab API

NestJS + Fastify + Prisma backend for the crab-auto-test platform.

## Clean-room

This is a clean-room rebuild. `WHartTest/` and `WHartTest-upstream/` at the repo
root are **product-research references only** — never import from them.

## Setup

```bash
pnpm install
cp .env.example .env   # fill DATABASE_URL + ENVELOPE_MASTER_KEY_B64
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Generate an envelope master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Architecture (MVP)

| Module | Capability | Notes |
|---|---|---|
| `auth` | platform-foundation.1/2 + R3 | login, sessions, per-user worker token |
| `projects` | platform-foundation.2 | owner/member simple roles (no RBAC) |
| `model-providers` | platform-foundation.3 + Architect-R5 | envelope-encrypted credentials |
| `audit` | platform-foundation.4 | append-only audit log |
| `test-assets` | test-asset-management.1 | modules, cases, ordered steps |
| `executions` | test-asset-management.2–3 | records + artifacts + R8 streaming |
| `worker-gateway` | automation-workers.1–4 + R2/R3 | authenticated session stream + redelivery |
| `ai-orchestration` | backend-ai-orchestration.1,2,4 + ai-test-generation.1–3 | LangGraph, R1/R7/MUST-2 |

All AI/LangGraph/LLM orchestration runs **here** — clients are thin.
