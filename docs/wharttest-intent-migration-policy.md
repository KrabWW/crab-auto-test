# WHartTest Intent Migration Policy

This is the active migration rule for WHartTest parity work.

## Allowed

- Read WHartTest source to understand product intent.
- Extract business objects, fields, workflows, states, edge cases, and acceptance behavior.
- Rebuild those behaviors in crab-auto-test using the current stack: NestJS, Prisma, Nuxt, shadcn-vue, Electron, and Playwright workers.
- Rewrite UI, copy, and interactions so they fit crab-auto-test as a mature testing product.

## Not The Path

- Do not mechanically copy WHartTest source files into crab-auto-test.
- Do not copy concrete UI expression, prompts, text, screenshots, or assets when doing intent migration.
- Do not treat "clean-room" as a blocker to reading WHartTest. The useful rule is intent extraction followed by native implementation.

## Working Method

For each module:

1. Read the corresponding WHartTest module.
2. Summarize intent: objects, workflows, states, and acceptance checks.
3. Implement the behavior in crab-auto-test's architecture.
4. Verify through API tests, typecheck, and UI smoke where applicable.
