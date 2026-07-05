# Crab High-Fidelity Prototype Plan

Status: Autopilot plan artifact.

## Goal

Create a high-fidelity, shadcn-style coded prototype for Crab / RJ Auto Test product-design review. OpenPencil remains a structure/wireframe artifact; this prototype is the visual fidelity source for review.

## Files

- `docs/prototypes/high-fidelity/crab-high-fidelity-prototype.html`: static clickable prototype.
- `docs/prototypes/high-fidelity/PLAN.md`: scope, coverage, and verification record.

## Information Architecture Boundary

Primary navigation is intentionally limited to:

- Workbench
- Verification Tasks
- Asset Library
- System Context
- Settings

The high-fidelity file also contains secondary review surfaces for API Automation, Execution Evidence / Proof Report, Knowledge, AI Chat / Skills, MCP, and Components. These are included to preserve design coverage and reference-product mapping, but they are not product-level sidebar entries.

## Scope

The prototype must cover:

- Workbench / Overview: Proof Case queue, release risk, failed evidence, pending approvals, coverage, next actions.
- Proof Case detail: lifecycle rail, next-action banner, state transition graph/table, evidence matrix, AI/source/approval inspector.
- API Automation: Hoppscotch-like collection tree, request editor, assertions, extraction, evidence binding, response, runner.
- Execution Evidence: Playwright-like failed step timeline, screenshot/trace/log/network/source/artifacts drill-down.
- Proof Report: Allure-like overview plus drill-down, but decision-first: ship/no-ship, why, remaining risk, confirmer.
- Knowledge: Dify/Open WebUI-like source trust center with sources, documents, indexing, retrieval test, citations, usage.
- AI Chat / Skills: Open WebUI-like asset separation; Skills are governed assets, Chat is contextual drawer.
- MCP Governance: project-scoped servers, tools/resources/prompts, permissions, allowlist/revoke, invocation logs.
- Settings: Project Governance Settings with top-level groups only General, Members, Model Providers, Credentials, Audit, Danger Zone.
- Component/toolchain decision: shadcn-vue/Tailwind coded prototype is high-fidelity source; shadcn Figma kit is visual source; OpenPencil is wireframe.

## Settings Correction

Settings must not become a flat AI/config dumping ground.

Top-level Settings groups:

- General
- Members
- Model Providers
- Credentials
- Audit
- Danger Zone

Placement:

- Environment variables live inside `Credentials` as governed non-secret/secret runtime configuration.
- MCP permissions live in `MCP Governance`; Settings shows related audit and high-risk credential boundaries.
- Knowledge usage scope lives in `Knowledge`; Settings shows project-level governance summary and audit trail.
- Skill enablement scope lives in `AI Chat / Skills`; Settings shows audit and credential/model-provider dependencies.

## Verification

Required checks:

- Static file exists and opens locally.
- Browser smoke test through a local static server.
- Console has no runtime errors.
- Screenshots captured for desktop and mobile.
- Prototype includes every screen in the scope list.
- Settings left navigation contains exactly the six top-level groups above.

Current evidence:

- Static DOM coverage check passed: primary sidebar entries are `workbench`, `proof`, `asset`, `system`, `settings`.
- Static DOM coverage check passed: prototype sections are `workbench`, `proof`, `api`, `execution`, `asset`, `system`, `knowledge`, `ai`, `mcp`, `settings`, `components`; `api`, `execution`, `knowledge`, `ai`, `mcp`, and `components` are secondary review surfaces.
- Settings coverage check passed: groups are exactly `general`, `members`, `providers`, `credentials`, `audit`, `danger`.
- Browser smoke test passed through a local Python static server and Playwright from `@crab/web`, using the locally available Chromium headless shell.
- Screenshots captured:
  - `docs/prototypes/high-fidelity/screenshots/desktop-proof-case-primarynav.png`
  - `docs/prototypes/high-fidelity/screenshots/desktop-settings-general.png`
  - `docs/prototypes/high-fidelity/screenshots/mobile-workbench-primarynav.png`

Note: Playwright 1.61 expected a newer Chromium build; installing that browser timed out in this environment, so the smoke test used the existing local Chromium executable.
