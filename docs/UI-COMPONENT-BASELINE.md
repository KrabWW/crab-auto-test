# UI Component Baseline

Status: Accepted on 2026-07-05.

This document records the confirmed component baseline for Crab product design. It is a design and planning baseline, not an implementation task list.

## Foundation

Crab uses the existing Nuxt/Vue/Tailwind path:

- Primary component foundation: [shadcn-vue Components](https://www.shadcn-vue.com/docs/components)
- Visual references: [shadcn/ui Blocks](https://ui.shadcn.com/blocks), [Atlassian Design](https://atlassian.design/), [Radix Themes](https://www.radix-ui.com/themes/docs/theme/overview)
- Motion references: [Material Motion](https://m3.material.io/styles/motion/overview/how-it-works), [Apple HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- Real-product browsing reference: [Mobbin](https://mobbin.com/explore/web)

Do not introduce a second full UI system unless this baseline is explicitly revised.

## Primitive Set

- Page shell: [Sidebar](https://www.shadcn-vue.com/docs/components/sidebar), [Breadcrumb](https://www.shadcn-vue.com/docs/components/breadcrumb), [Resizable](https://www.shadcn-vue.com/docs/components/resizable)
- Tables: [Table](https://www.shadcn-vue.com/docs/components/table), [Data Table](https://www.shadcn-vue.com/docs/components/data-table)
- Dialogs and panels: [Dialog](https://www.shadcn-vue.com/docs/components/dialog), [Alert Dialog](https://www.shadcn-vue.com/docs/components/alert-dialog), [Sheet](https://www.shadcn-vue.com/docs/components/sheet), [Drawer](https://www.shadcn-vue.com/docs/components/drawer)
- Forms: [Input](https://www.shadcn-vue.com/docs/components/input), [Textarea](https://www.shadcn-vue.com/docs/components/textarea), [Select](https://www.shadcn-vue.com/docs/components/select), [Checkbox](https://www.shadcn-vue.com/docs/components/checkbox), [Switch](https://www.shadcn-vue.com/docs/components/switch), [Form](https://www.shadcn-vue.com/docs/components/form)
- Actions: [Dropdown Menu](https://www.shadcn-vue.com/docs/components/dropdown-menu), [Popover](https://www.shadcn-vue.com/docs/components/popover), [Command](https://www.shadcn-vue.com/docs/components/command), [Tooltip](https://www.shadcn-vue.com/docs/components/tooltip)
- Feedback: [Badge](https://www.shadcn-vue.com/docs/components/badge), [Progress](https://www.shadcn-vue.com/docs/components/progress), [Skeleton](https://www.shadcn-vue.com/docs/components/skeleton), [Sonner](https://www.shadcn-vue.com/docs/components/sonner)
- Grouping: [Tabs](https://www.shadcn-vue.com/docs/components/tabs), [Accordion](https://www.shadcn-vue.com/docs/components/accordion), [Collapsible](https://www.shadcn-vue.com/docs/components/collapsible), [Stepper](https://www.shadcn-vue.com/docs/components/stepper)

## Dialog Rules

- `Dialog`: create, edit, small details, citation preview, run-parameter confirmation.
- `Alert Dialog`: delete, revoke, disable, clear, and Danger Zone operations.
- `Sheet`: right-side context, AI assistant, evidence detail, property panel, retrieval test.
- `Drawer`: mobile or narrow-screen replacement for Sheet.
- Full pages or resizable workbenches: API request editing, trace inspection, Proof Case detail, and other complex editors.

## Module Matrix

| Module | Page structure | Core components | Dialog and panel rules |
| --- | --- | --- | --- |
| Overview | Status header, risk queue, recent executions, pending approvals | Card, Badge, Progress, Table, Button | Sheet for failure evidence; Dialog for approval confirmation |
| Requirements | Left documents/versions, center parsed requirement, right AI suggestion/diff | Data Table, Tabs, Textarea, Badge, Accordion | Dialog for import/create; Sheet for AI parsing and diff |
| Cases | Left module tree, center case table, right properties/review | Data Table, Checkbox, Dropdown Menu, Badge, Collapsible | Dialog for create/edit; Alert Dialog for delete; Sheet for AI batch suggestions |
| API Automation | Hoppscotch-like left collection tree, center request/step editor, right response/assertions, bottom run results | Resizable, Tabs, Select, Input, Textarea, Table, Badge, Scroll Area | Dialog for Save as Case/Scenario; Sheet for run result details |
| UI Automation | Left execution tree, center step timeline, right screenshot/log/trace evidence | Resizable, Stepper, Tabs, Table, Badge, Scroll Area, Skeleton | Sheet for evidence detail; Dialog for screenshot/video preview; Alert Dialog for rerun confirmation |
| Execution and Reports | Execution list, report detail, evidence matrix | Data Table, Tabs, Badge, Progress, Accordion | Sheet for single evidence drill-down; Dialog for export/share |
| Knowledge | Left Sources, center Documents, right Retrieval Test/citation preview | Sidebar, Table, Progress, Tabs, Textarea, Badge | Dialog for upload/source creation; Sheet for retrieval test; Alert Dialog for source deletion |
| MCP | Server list/cards, Tools/Resources/Prompts, permissions, logs | Card, Table, Tabs, Switch, Badge, Tooltip, Scroll Area | Sheet for tool detail/invocation log; Alert Dialog for disabling risky tools |
| Skills and AI Chat | Skills management plus global contextual chat drawer | Table, Tabs, Badge, Switch, Textarea, Scroll Area, Command | Sheet for Chat; Dialog for install/edit Skill; Alert Dialog for disable/uninstall |
| Settings | Left settings groups, right governed forms/secrets/members/audit | Sidebar, Form, Input, Select, Switch, Table, Badge, Separator | Dialog for member/key creation; Alert Dialog for Danger Zone; Sheet for audit detail |

## Boundary

Cards are for overview and repeated summary items only. Main workflows should be dense workbenches with left object navigation, center work area, and right context/evidence panels.
