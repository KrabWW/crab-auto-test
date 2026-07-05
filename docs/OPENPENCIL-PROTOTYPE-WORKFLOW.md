# OpenPencil Prototype Workflow

Status: validated on Windows with OpenPencil 0.13.2 installed at `D:\install\OpenPencil\OpenPencil.exe`.

Use OpenPencil as an editable prototype handoff target, not as the first design reasoning surface. First define the page structure from `DESIGN.md`, `docs/PRODUCT-DESIGN-CHECKLISTS.md`, and `docs/PRODUCT-DESIGN-HORIZONTAL-STANDARDS.zh-CN.md`; then generate an OpenPencil file.

## Tool Boundary

OpenPencil is a structure prototype and editable canvas tool. Do not treat it as the shadcn-vue component library or as the final high-fidelity UI source.

Practical route:

1. Use OpenPencil for layout, page regions, information hierarchy, and reviewable wireframes.
2. Use shadcn/ui or shadcn-vue Figma kits as visual component references when high-fidelity polish is needed.
3. Use the project's shadcn-vue + Tailwind components for final coded prototypes and implementation truth.

Figma can bridge visual components into OpenPencil through `.fig` files, but that only carries design appearance and component structure. It does not carry Vue runtime behavior, reliable interaction states, full variants, or token fidelity.

## Recommended Path

1. Write a focused page structure for one Crab surface, such as Proof Case detail or API workbench.
2. Generate a `.pen` JSON file as the agent-editable source.
3. Convert `.pen` to `.fig` with the OpenPencil CLI.
4. Open the `.fig` in the Windows OpenPencil app for visual review.
5. Iterate on `.pen`, regenerate `.fig`, and only then polish.

## Why `.pen`

`.fig` is a binary Kiwi/ZIP document. `.pen` is readable JSON and OpenPencil can read it, so it is the simplest format for agent-generated wireframes.

Keep generated `.pen` files simple:

- `frame` for page regions, panels, tables, and rows.
- `text` for labels and content.
- `path` only for simple icons.
- Variables only for repeated colors, spacing, radius, and fonts.
- Avoid complex images, masks, gradients, and advanced effects in the first pass.

## CLI Setup

The installed Windows app does not include a PATH CLI. The npm package works when its JS entry is executed through Bun directly.

```powershell
$work = Join-Path $env:TEMP 'openpencil-cli-work'
New-Item -ItemType Directory -Force -Path $work | Out-Null
Push-Location $work
if (-not (Test-Path package.json)) {
  Set-Content package.json '{"type":"module"}' -Encoding UTF8
}
bun add @open-pencil/cli@0.13.2
Pop-Location

$cli = Join-Path $work 'node_modules/@open-pencil/cli/bin/openpencil.js'
bun $cli convert prototype.pen -o prototype.fig
bun $cli info prototype.fig
```

Do not use plain `npx @open-pencil/cli@0.13.2` for file operations on this machine. It starts under Node and fails with `Bun is not defined`.

## Current Validation

Validated:

- OpenPencil Windows app: `0.13.2`.
- CLI package: `@open-pencil/cli@0.13.2`.
- `.pen -> .fig` conversion works through `bun <cli> convert`.
- `bun <cli> info prototype.fig` reads the generated file.

Known limitation:

- `export ... -f png` currently fails on this machine because CanvasKit resolves `canvaskit.wasm` with a malformed Windows path. Use the OpenPencil app for visual review until that export path is fixed.

## Crab Prototype Rules

- Prototype the actual workbench screen first, not a marketing page.
- Use dense professional layout: left object tree, center work surface, right context/evidence panel.
- Use cards only for summary metrics or repeated compact items.
- Make AI suggestions, human confirmation, evidence state, execution state, and risk visually distinct.
- Every prototype page must show the next action and the evidence chain.
