## Why

Recent product-design alignment changed the target from a generic automated-testing toolbox to a Proof Case workbench. The decisions must be durable in OpenSpec so later implementation work keeps the same product spine and reference-product baseline.

## What Changes

- Add binding product-design governance for Proof Case, Overview entry, lifecycle workspace, state-transition confirmation, evidence-first execution, and lightweight release gating.
- Codify the selected reference-product baseline:
  - API automation code reference: Hoppscotch.
  - UI automation / trace reference: Playwright.
  - Execution report reference: Allure.
  - Knowledge / Skills / Chat reference: Open WebUI and Dify.
  - MCP reference: official MCP servers and Cline.
  - Settings / credentials reference: Supabase.
- Keep non-open-source products such as Apifox, Postman, GitHub, Vercel, VS Code, and Cursor as product-interaction references only, not code references.

## Non-Goals

- Do not implement product code in this change.
- Do not clone reference product UI expression, copy, assets, branding, or protected layout.
- Do not reintroduce Bruno as the API automation code reference unless explicitly re-approved.
- Do not make CI pipeline integration a first-phase design driver.

## Impact

Future specs and implementation plans must use this change as the product-design baseline before changing navigation, API automation, execution reports, Knowledge, MCP, Skills, AI Chat, or Settings.
