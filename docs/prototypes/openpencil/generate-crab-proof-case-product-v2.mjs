import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const outFile = fileURLToPath(new URL("./crab-proof-case-product-v2.pen", import.meta.url));
let seq = 0;

function nextId(prefix) {
  seq += 1;
  return `${prefix}_${seq}`;
}

function stroke(fill = "$--line", thickness = 1) {
  return { align: "inside", thickness, fill };
}

function frame(name, x, y, width, height, opts = {}, children = []) {
  const node = {
    type: "frame",
    id: nextId("frame"),
    name,
    x,
    y,
    width,
    height,
    fill: opts.fill ?? "$--surface",
    layout: opts.layout ?? "none",
    children,
  };
  if (opts.cornerRadius !== undefined) node.cornerRadius = opts.cornerRadius;
  if (opts.stroke !== false) node.stroke = opts.stroke ?? stroke(opts.strokeFill ?? "$--line", opts.strokeWidth ?? 1);
  if (opts.gap !== undefined) node.gap = opts.gap;
  if (opts.padding !== undefined) node.padding = opts.padding;
  return node;
}

function text(name, x, y, width, content, opts = {}) {
  const node = {
    type: "text",
    id: nextId("text"),
    name,
    x,
    y,
    width,
    content,
    fontFamily: opts.fontFamily ?? "$--font-primary",
    fontSize: opts.fontSize ?? 13,
    fill: opts.fill ?? "$--text",
    textGrowth: "fixed-width",
  };
  if (opts.fontWeight) node.fontWeight = opts.fontWeight;
  if (opts.lineHeight) node.lineHeight = opts.lineHeight;
  return node;
}

function badge(label, x, y, width, tone = "gray") {
  const tones = {
    gray: ["#F1F5F9", "#334155", "#CBD5E1"],
    blue: ["#EFF6FF", "#1D4ED8", "#BFDBFE"],
    purple: ["#F5F3FF", "#6D28D9", "#DDD6FE"],
    green: ["#ECFDF5", "#047857", "#A7F3D0"],
    amber: ["#FFFBEB", "#B45309", "#FDE68A"],
    red: ["#FEF2F2", "#B91C1C", "#FECACA"],
    slate: ["#0F172A", "#FFFFFF", "#0F172A"],
  };
  const [fill, color, border] = tones[tone] ?? tones.gray;
  return frame(
    `Badge: ${label}`,
    x,
    y,
    width,
    24,
    { fill, cornerRadius: 12, strokeFill: border },
    [text(`Badge Label: ${label}`, 10, 5, width - 20, label, { fontSize: 11, fontWeight: "700", fill: color })],
  );
}

function button(label, x, y, width, tone = "primary") {
  const fill = tone === "primary" ? "$--blue" : tone === "danger" ? "$--red" : "#FFFFFF";
  const color = tone === "secondary" ? "$--text" : "#FFFFFF";
  const border = tone === "secondary" ? "$--line" : fill;
  return frame(
    `Button: ${label}`,
    x,
    y,
    width,
    34,
    { fill, cornerRadius: 7, strokeFill: border },
    [text(`Button Label: ${label}`, 12, 9, width - 24, label, { fontSize: 12, fontWeight: "700", fill: color })],
  );
}

function topBar(title, subtitle = "支付中台 / Staging / Release 2026.07.06") {
  return frame("Top Bar", 0, 0, 1440, 54, { fill: "$--surface", strokeFill: "$--line", cornerRadius: 0 }, [
    text("Logo", 22, 17, 154, "Crab Auto Test", { fontSize: 15, fontWeight: "800" }),
    text("Page Title", 196, 13, 260, title, { fontSize: 16, fontWeight: "800" }),
    text("Project Context", 196, 32, 420, subtitle, { fontSize: 11, fill: "$--muted" }),
    frame("Command Search", 640, 11, 330, 32, { fill: "#F8FAFC", cornerRadius: 7, strokeFill: "$--line" }, [
      text("Command Placeholder", 14, 8, 300, "搜索 Proof Case / 需求 / 执行 / 证据    ⌘K", { fontSize: 12, fill: "$--muted" }),
    ]),
    badge("4 个待确认", 1000, 15, 92, "amber"),
    badge("2 个阻塞", 1102, 15, 78, "red"),
    button("运行验证", 1196, 10, 86, "primary"),
    text("User", 1320, 18, 96, "QA Lead", { fontSize: 12, fill: "$--muted" }),
  ]);
}

function primaryNav(active) {
  const items = ["Workbench", "Verification Tasks", "Asset Library", "System Context", "Settings"];
  const children = [
    text("Nav Label", 18, 18, 150, "项目导航", { fontSize: 12, fontWeight: "800", fill: "#94A3B8" }),
  ];
  items.forEach((item, index) => {
    const y = 50 + index * 42;
    if (item === active) {
      children.push(frame(`Nav Active ${item}`, 12, y, 176, 34, { fill: "#1E293B", cornerRadius: 7, stroke: false }, [
        text(`Nav ${item}`, 12, 9, 150, item, { fontSize: 12, fontWeight: "800", fill: "#FFFFFF" }),
      ]));
    } else {
      children.push(text(`Nav ${item}`, 24, y + 9, 150, item, { fontSize: 12, fill: "#CBD5E1" }));
    }
  });
  children.push(frame("Nav Divider", 16, 290, 168, 1, { fill: "#334155", stroke: false }));
  children.push(text("Nav Principle", 18, 314, 162, "一级菜单只放高频工作入口。\nAI Chat 是右侧助手，不是一层菜单。", { fontSize: 11, lineHeight: 18, fill: "#CBD5E1" }));
  return frame("Primary Navigation", 0, 54, 200, 806, { fill: "#0F172A", strokeFill: "#0F172A" }, children);
}

function screen(name, x, y, children) {
  return frame(name, x, y, 1440, 860, { fill: "$--screen", cornerRadius: 14, strokeFill: "#CBD5E1" }, children);
}

function miniRow(name, y, cols, widths, opts = {}) {
  const children = [];
  let x = 0;
  cols.forEach((col, i) => {
    children.push(text(`${name} col ${i}`, x + 10, 9, widths[i] - 20, col, {
      fontSize: opts.fontSize ?? 12,
      fontWeight: opts.bold ? "700" : undefined,
      fill: opts.fill ?? "$--text",
    }));
    x += widths[i];
  });
  return frame(name, 0, y, widths.reduce((a, b) => a + b, 0), opts.height ?? 34, {
    fill: opts.fillBg ?? "$--surface",
    strokeFill: opts.strokeFill ?? "$--line",
    cornerRadius: opts.cornerRadius ?? 0,
  }, children);
}

function workbenchScreen() {
  const main = frame("Workbench Main", 200, 54, 910, 806, { fill: "$--bg", stroke: false }, [
    text("Workbench H1", 26, 24, 480, "Proof Operations Workbench", { fontSize: 24, fontWeight: "800" }),
    text("Workbench Sub", 26, 58, 690, "第一屏只回答：今天哪些 Proof Case 需要我确认？哪些发布风险不能放过？", { fontSize: 13, fill: "$--muted" }),
    frame("Metric Ready", 26, 96, 202, 86, { fill: "$--surface", cornerRadius: 10 }, [
      text("Metric Ready K", 16, 14, 160, "可进入报告", { fontSize: 12, fill: "$--muted" }),
      text("Metric Ready V", 16, 38, 140, "12", { fontSize: 30, fontWeight: "800", fill: "$--green" }),
      text("Metric Ready S", 68, 48, 110, "个 Proof Case", { fontSize: 11, fill: "$--muted" }),
    ]),
    frame("Metric Blocked", 244, 96, 202, 86, { fill: "$--surface", cornerRadius: 10 }, [
      text("Metric Blocked K", 16, 14, 160, "发布阻塞", { fontSize: 12, fill: "$--muted" }),
      text("Metric Blocked V", 16, 38, 80, "2", { fontSize: 30, fontWeight: "800", fill: "$--red" }),
      text("Metric Blocked S", 54, 48, 124, "个必须处理", { fontSize: 11, fill: "$--muted" }),
    ]),
    frame("Metric Evidence", 462, 96, 202, 86, { fill: "$--surface", cornerRadius: 10 }, [
      text("Metric Evidence K", 16, 14, 160, "证据完整率", { fontSize: 12, fill: "$--muted" }),
      text("Metric Evidence V", 16, 38, 90, "78%", { fontSize: 28, fontWeight: "800", fill: "$--blue" }),
      text("Metric Evidence S", 86, 49, 90, "需补 DB 证据", { fontSize: 11, fill: "$--muted" }),
    ]),
    frame("Metric Ai", 680, 96, 202, 86, { fill: "$--surface", cornerRadius: 10 }, [
      text("Metric Ai K", 16, 14, 160, "AI 草稿待审", { fontSize: 12, fill: "$--muted" }),
      text("Metric Ai V", 16, 38, 80, "4", { fontSize: 30, fontWeight: "800", fill: "$--purple" }),
      text("Metric Ai S", 54, 48, 124, "个需要人工确认", { fontSize: 11, fill: "$--muted" }),
    ]),
    frame("Todo Panel", 26, 206, 420, 328, { fill: "$--surface", cornerRadius: 10 }, [
      text("Todo Title", 18, 16, 260, "My To-dos", { fontSize: 16, fontWeight: "800" }),
      badge("人工确认优先", 300, 14, 96, "green"),
      miniRow("Todo Row 1", 54, ["会员状态启用", "确认状态流转", "高风险"], [180, 130, 88], { fillBg: "#FFFBEB" }),
      miniRow("Todo Row 2", 96, ["退款审批链路", "补证据点", "阻塞"], [180, 130, 88], { fillBg: "#FEF2F2" }),
      miniRow("Todo Row 3", 138, ["发票开具规则", "审 AI 草稿", "中"], [180, 130, 88], { fillBg: "#FFFFFF" }),
      miniRow("Todo Row 4", 180, ["营销券冻结", "报告确认", "低"], [180, 130, 88], { fillBg: "#FFFFFF" }),
      text("Todo Note", 18, 246, 360, "设计依据：Workbench 不是指标看板，而是把用户带到下一步确认或风险处理。", { fontSize: 12, lineHeight: 19, fill: "$--muted" }),
    ]),
    frame("Risk Panel", 462, 206, 420, 328, { fill: "$--surface", cornerRadius: 10 }, [
      text("Risk Title", 18, 16, 260, "Risks and Blockers", { fontSize: 16, fontWeight: "800" }),
      badge("发布门禁", 312, 14, 74, "red"),
      miniRow("Risk Row 1", 54, ["DB 状态证据缺失", "影响会员启用", "阻塞"], [180, 142, 76], { fillBg: "#FEF2F2" }),
      miniRow("Risk Row 2", 96, ["接口断言冲突", "退款状态不一致", "阻塞"], [180, 142, 76], { fillBg: "#FEF2F2" }),
      miniRow("Risk Row 3", 138, ["AI 识别范围过大", "需确认排除项", "待审"], [180, 142, 76], { fillBg: "#FFFBEB" }),
      miniRow("Risk Row 4", 180, ["日志源未连接", "只影响 drill-down", "提醒"], [180, 142, 76], { fillBg: "#FFFFFF" }),
      text("Risk Note", 18, 246, 360, "风险项必须能反查：需求、状态流转、用例、执行、原始证据、确认人。", { fontSize: 12, lineHeight: 19, fill: "$--muted" }),
    ]),
    frame("Release Gate", 26, 560, 856, 186, { fill: "$--surface", cornerRadius: 10 }, [
      text("Gate Title", 18, 16, 260, "Release Gate Queue", { fontSize: 16, fontWeight: "800" }),
      badge("A: 可过", 300, 14, 62, "green"),
      badge("B: 需复核", 372, 14, 78, "amber"),
      badge("C: 不可过", 462, 14, 78, "red"),
      miniRow("Gate Header", 18, ["Proof Case", "当前结论", "证据缺口", "下一步动作", "负责人"], [210, 130, 160, 210, 110], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("Gate Row 1", 58, ["会员状态启用", "Needs Review", "DB snapshot", "补数据层验证", "QA Lead"], [210, 130, 160, 210, 110], { fillBg: "#FFFBEB" }),
      miniRow("Gate Row 2", 98, ["退款审批链路", "No Ship", "API response conflict", "开发修复后重跑", "Dev"], [210, 130, 160, 210, 110], { fillBg: "#FEF2F2" }),
      miniRow("Gate Row 3", 138, ["发票开具规则", "Go", "无", "生成报告", "Release"], [210, 130, 160, 210, 110], { fillBg: "#FFFFFF" }),
    ]),
  ]);

  const right = frame("Context AI Drawer", 1110, 54, 330, 806, { fill: "$--surface", strokeFill: "$--line" }, [
    text("AI Title", 20, 22, 240, "Context AI Assistant", { fontSize: 16, fontWeight: "800" }),
    badge("随页面上下文", 200, 20, 100, "purple"),
    text("AI Copy", 20, 62, 286, "当前上下文：Workbench / 发布门禁\n不会作为一级菜单出现，只解释、生成、修复、追溯。", { fontSize: 12, lineHeight: 20, fill: "$--muted" }),
    frame("AI Suggestion", 20, 124, 286, 128, { fill: "#F5F3FF", cornerRadius: 10, strokeFill: "#DDD6FE" }, [
      text("AI S Title", 14, 14, 250, "AI 建议", { fontSize: 13, fontWeight: "800", fill: "$--purple" }),
      text("AI S Body", 14, 42, 248, "会员状态启用缺少 DB 状态证据。建议添加 read-only database evidence step，并绑定到 Disabled -> Enabled。", { fontSize: 12, lineHeight: 19, fill: "#4C1D95" }),
    ]),
    frame("AI Source", 20, 270, 286, 150, { fill: "$--surface", cornerRadius: 10 }, [
      text("Source Title", 14, 14, 250, "来源与可审查性", { fontSize: 13, fontWeight: "800" }),
      text("Source Body", 14, 42, 248, "Sources:\n- PRD 3.2 会员启用规则\n- API /member/enable 文档\n- 历史用例 #PC-128\n\n每条 AI 输出都必须可查看来源、差异、确认记录。", { fontSize: 12, lineHeight: 19, fill: "$--muted" }),
    ]),
    frame("Tool Calls", 20, 438, 286, 162, { fill: "#F8FAFC", cornerRadius: 10 }, [
      text("Tool Title", 14, 14, 250, "工具调用透明", { fontSize: 13, fontWeight: "800" }),
      text("Tool Body", 14, 42, 248, "MCP: database.read_state\n原因：验证 enabled 字段\n权限：只读 / 需批准\n结果：未执行\n\n参考：Cline 的 tool approval 和 invocation log。", { fontSize: 12, lineHeight: 19, fill: "$--muted" }),
    ]),
    button("打开当前 Proof Case", 20, 636, 160, "secondary"),
    button("生成修复建议", 190, 636, 116, "primary"),
  ]);

  return screen("A Workbench - Proof Operations", 40, 90, [
    topBar("Workbench"),
    primaryNav("Workbench"),
    main,
    right,
  ]);
}

function proofCaseScreen() {
  const stageRail = frame("Proof Case Stage Rail", 200, 54, 214, 806, { fill: "$--surface", strokeFill: "$--line" }, [
    text("Stage Title", 18, 20, 160, "Proof Case Stages", { fontSize: 14, fontWeight: "800" }),
    ...[
      ["需求理解", "confirmed", "green"],
      ["状态流转", "needs confirmation", "amber"],
      ["用例与证据点", "draft", "purple"],
      ["自动化", "not started", "gray"],
      ["执行证据", "blocked", "red"],
      ["证据矩阵", "not ready", "gray"],
      ["证明报告", "not ready", "gray"],
      ["资产沉淀", "later", "gray"],
    ].flatMap(([name, state, tone], i) => {
      const y = 58 + i * 62;
      return [
        badge(`${i + 1}`, 18, y, 28, tone),
        text(`Stage ${name}`, 56, y + 1, 126, name, { fontSize: 13, fontWeight: "800" }),
        text(`Stage state ${name}`, 56, y + 22, 130, state, { fontSize: 11, fill: "$--muted" }),
      ];
    }),
  ]);

  const center = frame("Proof Case Center", 414, 54, 686, 806, { fill: "$--bg", stroke: false }, [
    frame("Proof Header", 24, 20, 638, 108, { fill: "$--surface", cornerRadius: 10 }, [
      text("Proof Title", 18, 16, 380, "会员状态启用 Proof Case", { fontSize: 20, fontWeight: "800" }),
      text("Proof Meta", 18, 48, 430, "需求：PRD-2026-071 / 系统：会员中心 / 当前阶段：状态流转确认", { fontSize: 12, fill: "$--muted" }),
      badge("Needs Human Confirmation", 432, 18, 178, "amber"),
      badge("High Risk", 432, 52, 80, "red"),
      button("确认状态流转", 18, 74, 126, "primary"),
      button("拒绝 AI 草稿", 154, 74, 110, "secondary"),
    ]),
    frame("Next Action Banner", 24, 146, 638, 76, { fill: "#FFFBEB", cornerRadius: 10, strokeFill: "#FDE68A" }, [
      text("Next Action", 18, 14, 580, "下一步：确认 Disabled -> Enabled 是否是业务真实状态流转，并指定权威证据字段。", { fontSize: 14, fontWeight: "800", fill: "#92400E" }),
      text("Next Action Sub", 18, 42, 580, "AI 已识别 3 个证据点，其中 DB 状态证据需要人工确认是否必须。", { fontSize: 12, fill: "#92400E" }),
    ]),
    frame("State Graph", 24, 240, 638, 118, { fill: "$--surface", cornerRadius: 10 }, [
      text("Graph Title", 18, 14, 220, "状态流转图 + 工作表", { fontSize: 14, fontWeight: "800" }),
      frame("Node Disabled", 34, 50, 124, 42, { fill: "#F1F5F9", cornerRadius: 21 }, [
        text("Disabled", 18, 12, 88, "Disabled", { fontSize: 12, fontWeight: "800" }),
      ]),
      text("Arrow 1", 178, 58, 62, "enable()", { fontSize: 12, fill: "$--muted" }),
      text("Arrow line 1", 244, 60, 24, "→", { fontSize: 20, fontWeight: "800", fill: "$--muted" }),
      frame("Node Enabled", 280, 50, 124, 42, { fill: "#ECFDF5", cornerRadius: 21, strokeFill: "#A7F3D0" }, [
        text("Enabled", 20, 12, 84, "Enabled", { fontSize: 12, fontWeight: "800", fill: "#047857" }),
      ]),
      text("Arrow 2", 426, 58, 72, "audit log", { fontSize: 12, fill: "$--muted" }),
      text("Arrow line 2", 500, 60, 24, "→", { fontSize: 20, fontWeight: "800", fill: "$--muted" }),
      frame("Node Audit", 532, 50, 86, 42, { fill: "#EFF6FF", cornerRadius: 21, strokeFill: "#BFDBFE" }, [
        text("Audit", 18, 12, 50, "Audit", { fontSize: 12, fontWeight: "800", fill: "#1D4ED8" }),
      ]),
    ]),
    frame("State Table", 24, 380, 638, 176, { fill: "$--surface", cornerRadius: 10 }, [
      text("State Table Title", 18, 14, 260, "状态流转确认表", { fontSize: 14, fontWeight: "800" }),
      miniRow("State Header", 18, ["对象", "初始", "触发", "目标", "证据点", "确认"], [78, 86, 94, 88, 180, 76], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("State Row 1", 54, ["Member", "Disabled", "enable", "Enabled", "UI badge + API + DB", "待确认"], [78, 86, 94, 88, 180, 76], { fillBg: "#FFFBEB" }),
      miniRow("State Row 2", 90, ["Audit", "None", "enable", "Created", "audit log entry", "已确认"], [78, 86, 94, 88, 180, 76], { fillBg: "#FFFFFF" }),
      miniRow("State Row 3", 126, ["Cache", "stale", "refresh", "current", "response timestamp", "可跳过"], [78, 86, 94, 88, 180, 76], { fillBg: "#FFFFFF" }),
    ]),
    frame("Evidence Matrix", 24, 578, 638, 154, { fill: "$--surface", cornerRadius: 10 }, [
      text("Evidence Title", 18, 14, 260, "证据矩阵预览", { fontSize: 14, fontWeight: "800" }),
      miniRow("Evidence Header", 18, ["状态流转", "UI", "API", "DB", "Log", "结论"], [170, 70, 70, 70, 70, 160], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("Evidence Row 1", 54, ["Disabled -> Enabled", "有效", "有效", "缺失", "有效", "Needs Review"], [170, 70, 70, 70, 70, 160], { fillBg: "#FFFBEB" }),
      miniRow("Evidence Row 2", 90, ["None -> Audit Created", "无", "有效", "无", "有效", "Proved"], [170, 70, 70, 70, 70, 160], { fillBg: "#FFFFFF" }),
    ]),
    frame("Run Console", 24, 748, 638, 42, { fill: "#0F172A", cornerRadius: 10, strokeFill: "#0F172A" }, [
      text("Console Text", 14, 11, 600, "[gate] report blocked: DB evidence required for high-risk state transition.", { fontFamily: "$--font-mono", fontSize: 12, fill: "#CBD5E1" }),
    ]),
  ]);

  const right = frame("Proof Right Inspector", 1100, 54, 340, 806, { fill: "$--surface", strokeFill: "$--line" }, [
    text("Inspector Title", 20, 22, 270, "Sources / Risks / Approval", { fontSize: 16, fontWeight: "800" }),
    frame("AI Draft Card", 20, 62, 296, 142, { fill: "#F5F3FF", cornerRadius: 10, strokeFill: "#DDD6FE" }, [
      text("Draft Title", 14, 14, 250, "AI Draft", { fontSize: 13, fontWeight: "800", fill: "$--purple" }),
      text("Draft Body", 14, 42, 250, "AI 根据 PRD 和 API 文档推断会员启用会改变 enabled 字段。这个推断不能直接进入报告，必须由人确认。", { fontSize: 12, lineHeight: 19, fill: "#4C1D95" }),
    ]),
    frame("Approval Checklist", 20, 222, 296, 164, { fill: "$--surface", cornerRadius: 10 }, [
      text("Approval Title", 14, 14, 250, "Human Confirmation", { fontSize: 13, fontWeight: "800" }),
      text("Approval Body", 14, 42, 250, "☑ 业务对象确认：Member\n☐ 权威状态字段确认：enabled\n☐ DB 证据是否必须\n☐ 排除缓存状态误判\n☐ 报告阻塞规则确认", { fontSize: 12, lineHeight: 22, fill: "$--muted" }),
    ]),
    frame("Risk Detail", 20, 404, 296, 152, { fill: "#FEF2F2", cornerRadius: 10, strokeFill: "#FECACA" }, [
      text("Risk Detail Title", 14, 14, 250, "为什么不能只看测试通过", { fontSize: 13, fontWeight: "800", fill: "#991B1B" }),
      text("Risk Detail Body", 14, 42, 250, "UI 显示 Enabled 并不等于业务状态已落库。Proof Case 必须证明状态流转真实成立。", { fontSize: 12, lineHeight: 19, fill: "#991B1B" }),
    ]),
    frame("Trace Chain", 20, 574, 296, 150, { fill: "#F8FAFC", cornerRadius: 10 }, [
      text("Trace Title", 14, 14, 250, "证据链", { fontSize: 13, fontWeight: "800" }),
      text("Trace Body", 14, 42, 250, "Requirement -> State Transition -> Case -> API/UI Step -> Execution -> Artifact -> Reviewer -> Report", { fontSize: 12, lineHeight: 20, fill: "$--muted" }),
    ]),
    button("查看来源", 20, 746, 92, "secondary"),
    button("提交确认", 122, 746, 96, "primary"),
    button("标记问题", 228, 746, 88, "danger"),
  ]);

  return screen("B Proof Case Detail - Lifecycle Workspace", 1520, 90, [
    topBar("Proof Case Detail"),
    primaryNav("Verification Tasks"),
    stageRail,
    center,
    right,
  ]);
}

function apiWorkbenchScreen() {
  const left = frame("API Collection Tree", 200, 54, 246, 806, { fill: "$--surface", strokeFill: "$--line" }, [
    text("Tree Title", 18, 20, 160, "API Scenarios", { fontSize: 15, fontWeight: "800" }),
    badge("Hoppscotch-like", 126, 18, 98, "blue"),
    text("Tree Body", 18, 62, 206, "会员状态启用\n  POST /member/enable\n  GET /member/{id}\n  GET /audit/events\n\n退款审批链路\n  POST /refund/apply\n  POST /refund/approve\n  GET /refund/{id}\n\n环境：Staging\n变量：memberId, token, operator", { fontSize: 12, lineHeight: 23, fill: "$--text" }),
    frame("Tree Note", 18, 516, 206, 170, { fill: "#F8FAFC", cornerRadius: 10 }, [
      text("Tree Note Text", 14, 14, 178, "不是通用 API 客户端。\n树按 Business Flow / Scenario / Request 组织，并持续显示绑定的 Proof Case 和状态流转。", { fontSize: 12, lineHeight: 20, fill: "$--muted" }),
    ]),
  ]);

  const center = frame("API Request Editor", 446, 54, 604, 566, { fill: "$--bg", stroke: false }, [
    frame("Request Toolbar", 24, 20, 556, 76, { fill: "$--surface", cornerRadius: 10 }, [
      badge("POST", 16, 20, 54, "green"),
      frame("URL Input", 82, 18, 340, 32, { fill: "#F8FAFC", cornerRadius: 7 }, [
        text("URL", 12, 8, 310, "{{baseUrl}}/member/{{memberId}}/enable", { fontFamily: "$--font-mono", fontSize: 12 }),
      ]),
      button("Send", 436, 17, 72, "primary"),
      text("Binding", 16, 54, 500, "绑定：Proof Case PC-071 / Disabled -> Enabled / Evidence: API response enabled=true", { fontSize: 11, fill: "$--muted" }),
    ]),
    frame("Request Tabs", 24, 112, 556, 44, { fill: "$--surface", cornerRadius: 10 }, [
      badge("Params", 14, 10, 60, "gray"),
      badge("Headers", 82, 10, 68, "gray"),
      badge("Body", 158, 10, 48, "blue"),
      badge("Assertions", 214, 10, 84, "gray"),
      badge("Extraction", 306, 10, 84, "gray"),
      badge("Evidence Binding", 398, 10, 128, "purple"),
    ]),
    frame("Body Editor", 24, 174, 556, 168, { fill: "#0F172A", cornerRadius: 10, strokeFill: "#0F172A" }, [
      text("Body Code", 16, 16, 510, "{\n  \"operator\": \"{{qaUser}}\",\n  \"reason\": \"release verification\",\n  \"expectedState\": \"Enabled\"\n}", { fontFamily: "$--font-mono", fontSize: 12, lineHeight: 22, fill: "#CBD5E1" }),
    ]),
    frame("Assertion Panel", 24, 360, 556, 166, { fill: "$--surface", cornerRadius: 10 }, [
      text("Assertion Title", 16, 14, 200, "Assertions / Extraction", { fontSize: 14, fontWeight: "800" }),
      miniRow("Assert Header", 16, ["断言", "来源", "证据绑定", "状态"], [190, 100, 150, 78], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("Assert Row 1", 52, ["json.enabled == true", "response", "API evidence", "通过"], [190, 100, 150, 78], { fillBg: "#FFFFFF" }),
      miniRow("Assert Row 2", 88, ["extract member.version", "response", "DB follow-up", "已提取"], [190, 100, 150, 78], { fillBg: "#FFFFFF" }),
      miniRow("Assert Row 3", 124, ["status == 200", "HTTP", "basic health", "通过"], [190, 100, 150, 78], { fillBg: "#FFFFFF" }),
    ]),
  ]);

  const right = frame("API Response Evidence", 1050, 54, 390, 566, { fill: "$--surface", strokeFill: "$--line" }, [
    text("Response Title", 20, 20, 220, "Response / Evidence", { fontSize: 16, fontWeight: "800" }),
    badge("200 OK", 262, 18, 70, "green"),
    text("Response Meta", 20, 56, 320, "184ms / 2.1KB / staging / run #EX-778", { fontSize: 12, fill: "$--muted" }),
    frame("Response Body", 20, 88, 346, 170, { fill: "#0F172A", cornerRadius: 10, strokeFill: "#0F172A" }, [
      text("Response JSON", 14, 14, 310, "{\n  \"memberId\": \"M-10086\",\n  \"enabled\": true,\n  \"version\": 42,\n  \"auditId\": \"A-2291\"\n}", { fontFamily: "$--font-mono", fontSize: 12, lineHeight: 22, fill: "#CBD5E1" }),
    ]),
    frame("Evidence Inspector", 20, 278, 346, 174, { fill: "#F8FAFC", cornerRadius: 10 }, [
      text("Evidence Inspector Title", 14, 14, 260, "Evidence Binding Inspector", { fontSize: 13, fontWeight: "800" }),
      text("Evidence Inspector Body", 14, 42, 310, "证明目标：Disabled -> Enabled\n已满足：API response enabled=true\n未满足：DB enabled snapshot\n报告影响：Needs Review\n下一步：添加 DB read-only evidence step", { fontSize: 12, lineHeight: 20, fill: "$--muted" }),
    ]),
    button("保存为 Evidence Step", 20, 480, 146, "secondary"),
    button("生成 DB 验证", 178, 480, 118, "primary"),
  ]);

  const bottom = frame("API Runner Logs", 446, 620, 994, 240, { fill: "$--surface", strokeFill: "$--line" }, [
    text("Runner Title", 24, 18, 300, "Runner / Logs / History", { fontSize: 15, fontWeight: "800" }),
    miniRow("Runner Header", 24, ["Step", "Result", "Evidence", "Duration", "Report Impact"], [320, 140, 180, 110, 180], { bold: true, fillBg: "#F8FAFC" }),
    miniRow("Runner Row 1", 62, ["POST enable member", "passed", "API response", "184ms", "supports transition"], [320, 140, 180, 110, 180], { fillBg: "#FFFFFF" }),
    miniRow("Runner Row 2", 100, ["GET member detail", "passed", "API detail snapshot", "121ms", "supports transition"], [320, 140, 180, 110, 180], { fillBg: "#FFFFFF" }),
    miniRow("Runner Row 3", 138, ["DB enabled snapshot", "missing", "state evidence", "-", "blocks report"], [320, 140, 180, 110, 180], { fillBg: "#FEF2F2" }),
    text("Runner Note", 24, 194, 900, "迁移 Hoppscotch 的左树 + 中间请求编辑 + 右侧响应 + 底部 Runner，但所有结果都必须绑定 Proof Case 的证据点。", { fontSize: 12, fill: "$--muted" }),
  ]);

  return screen("C API Automation Workbench - Evidence Binding", 3000, 90, [
    topBar("API Automation"),
    primaryNav("Verification Tasks"),
    left,
    center,
    right,
    bottom,
  ]);
}

function executionReportScreen() {
  const left = frame("Execution Evidence Detail", 200, 54, 602, 806, { fill: "$--bg", stroke: false }, [
    frame("Execution Header", 20, 20, 562, 76, { fill: "$--surface", cornerRadius: 10 }, [
      text("Execution Title", 16, 14, 280, "Execution Evidence Detail", { fontSize: 16, fontWeight: "800" }),
      badge("Failed proof step selected", 340, 14, 170, "red"),
      text("Execution Meta", 16, 44, 500, "参考 Playwright：默认选中失败 action，并联动 screenshot / network / log / source。", { fontSize: 12, fill: "$--muted" }),
    ]),
    frame("Action Timeline", 20, 114, 196, 420, { fill: "$--surface", cornerRadius: 10 }, [
      text("Timeline Title", 14, 14, 150, "Proof Step Timeline", { fontSize: 13, fontWeight: "800" }),
      text("Timeline Rows", 14, 48, 164, "✓ login as QA\n✓ open member page\n✓ click Enable\n✓ API enabled=true\n✕ DB enabled snapshot\n✓ audit log created\n\n失败定位：\n不是脚本 IDE，而是证明链断点。", { fontSize: 12, lineHeight: 22, fill: "$--muted" }),
    ]),
    frame("Screenshot Preview", 236, 114, 346, 250, { fill: "#E2E8F0", cornerRadius: 10, strokeFill: "#CBD5E1" }, [
      text("Screenshot Label", 20, 18, 300, "Screenshot / Trace Preview", { fontSize: 14, fontWeight: "800", fill: "#334155" }),
      frame("Browser Bar", 20, 56, 306, 26, { fill: "#FFFFFF", cornerRadius: 6 }, [
        text("Browser URL", 12, 7, 270, "https://staging/member/M-10086", { fontSize: 11, fill: "$--muted" }),
      ]),
      frame("Screenshot Body", 44, 106, 258, 90, { fill: "#FFFFFF", cornerRadius: 8 }, [
        text("Screenshot Body Text", 18, 18, 210, "Member Status\nEnabled", { fontSize: 18, fontWeight: "800", fill: "$--green" }),
      ]),
    ]),
    frame("Failure Inspector", 236, 384, 346, 150, { fill: "#FEF2F2", cornerRadius: 10, strokeFill: "#FECACA" }, [
      text("Failure Title", 14, 14, 300, "Failed Proof Step", { fontSize: 13, fontWeight: "800", fill: "#991B1B" }),
      text("Failure Body", 14, 42, 306, "期望：DB member.enabled = true\n实际：未采集到 DB snapshot\n影响：报告不能给出 Go\n建议：补 read-only DB evidence 或降低此状态流转风险等级。", { fontSize: 12, lineHeight: 20, fill: "#991B1B" }),
    ]),
    frame("Evidence Tabs", 20, 556, 562, 220, { fill: "$--surface", cornerRadius: 10 }, [
      badge("Call", 14, 14, 48, "gray"),
      badge("Log", 70, 14, 44, "blue"),
      badge("Errors", 122, 14, 58, "red"),
      badge("Console", 188, 14, 70, "gray"),
      badge("Network", 266, 14, 76, "gray"),
      badge("Source", 350, 14, 64, "gray"),
      badge("Attachments", 422, 14, 100, "gray"),
      text("Log Content", 16, 56, 520, "[04] API assertion passed response.enabled == true\n[05] DB state evidence skipped: no configured read-only connection\n[gate] Evidence Matrix row marked Needs Review", { fontFamily: "$--font-mono", fontSize: 12, lineHeight: 22, fill: "$--text" }),
    ]),
  ]);

  const right = frame("Proof Report", 802, 54, 638, 806, { fill: "$--surface", strokeFill: "$--line" }, [
    frame("Report Decision Band", 22, 20, 594, 108, { fill: "#FFFBEB", cornerRadius: 10, strokeFill: "#FDE68A" }, [
      text("Report Title", 18, 16, 300, "Proof Report: Needs Review", { fontSize: 20, fontWeight: "800", fill: "#92400E" }),
      text("Report Why", 18, 48, 420, "不能直接发布：高风险状态流转缺少 DB 层证据。", { fontSize: 13, fill: "#92400E" }),
      badge("Release Owner 待确认", 404, 16, 138, "amber"),
      badge("Allure-like drill-down", 404, 52, 136, "blue"),
    ]),
    frame("Report Nav", 22, 150, 144, 504, { fill: "#F8FAFC", cornerRadius: 10 }, [
      text("Report Nav Text", 16, 16, 110, "Summary\nEvidence Matrix\nState Transitions\nCases\nExecutions\nArtifacts\nHistory\nEnvironment", { fontSize: 12, lineHeight: 30, fill: "$--text" }),
    ]),
    frame("Report Content", 186, 150, 430, 306, { fill: "$--surface", cornerRadius: 10 }, [
      text("Summary Title", 16, 14, 260, "第一屏回答发布判断", { fontSize: 15, fontWeight: "800" }),
      miniRow("Summary Header", 16, ["问题", "当前结论", "证据", "风险"], [140, 110, 90, 70], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("Summary Row 1", 52, ["会员启用", "Needs Review", "UI/API/Log", "High"], [140, 110, 90, 70], { fillBg: "#FFFBEB" }),
      miniRow("Summary Row 2", 88, ["审计生成", "Proved", "API/Log", "Medium"], [140, 110, 90, 70], { fillBg: "#FFFFFF" }),
      text("Summary Copy", 16, 142, 380, "报告不是通过率页。管理者先看能不能发，QA/开发再钻取到 matrix、step、artifact、raw response。", { fontSize: 12, lineHeight: 20, fill: "$--muted" }),
    ]),
    frame("Matrix Detail", 186, 474, 430, 180, { fill: "#F8FAFC", cornerRadius: 10 }, [
      text("Matrix Detail Title", 16, 14, 260, "Evidence Matrix Drill-down", { fontSize: 14, fontWeight: "800" }),
      text("Matrix Detail Body", 16, 44, 380, "Selected row: Disabled -> Enabled\nArtifacts:\n- screenshot: enabled badge\n- HTTP exchange: POST enable\n- log: audit event\n- DB snapshot: missing\nReviewer decision: pending", { fontSize: 12, lineHeight: 21, fill: "$--muted" }),
    ]),
    frame("Artifact Strip", 22, 676, 594, 88, { fill: "#0F172A", cornerRadius: 10, strokeFill: "#0F172A" }, [
      text("Artifact Strip Text", 16, 14, 540, "Artifact preview strip: screenshot | video | Playwright trace | HTTP exchange | logs | source link", { fontFamily: "$--font-mono", fontSize: 12, fill: "#CBD5E1" }),
      text("Artifact Strip Note", 16, 44, 540, "附件必须绑定到状态流转、步骤、断言或报告结论，不能只是文件列表。", { fontSize: 12, fill: "#94A3B8" }),
    ]),
  ]);

  return screen("D Execution Evidence + Proof Report", 40, 1000, [
    topBar("Execution & Report"),
    primaryNav("Verification Tasks"),
    left,
    right,
  ]);
}

function systemContextScreen() {
  const content = frame("System Context Main", 200, 54, 1240, 806, { fill: "$--bg", stroke: false }, [
    text("System Title", 28, 24, 540, "System Context & Governance Surfaces", { fontSize: 24, fontWeight: "800" }),
    text("System Sub", 28, 58, 820, "这些模块是 Proof Case 的上下文与治理能力，不抢占日常工作入口。每个模块迁移成熟产品的页面结构。", { fontSize: 13, fill: "$--muted" }),
    frame("Knowledge Panel", 28, 104, 570, 250, { fill: "$--surface", cornerRadius: 10 }, [
      text("Knowledge Title", 18, 16, 280, "Knowledge Source Trust Center", { fontSize: 16, fontWeight: "800" }),
      badge("Dify", 378, 14, 48, "blue"),
      badge("Open WebUI", 436, 14, 94, "purple"),
      text("Knowledge Body", 18, 52, 520, "结构：Sources / Documents / Retrieval Test / Citations / Usage / Settings\n核心交互：索引状态、检索测试、引用预览、AI 使用记录。\n不要：把 RAG 做成上传后不可解释的黑箱。", { fontSize: 12, lineHeight: 22, fill: "$--muted" }),
      miniRow("Knowledge Row", 18, ["Source", "Index", "Freshness", "Used by", "Scope"], [118, 80, 90, 122, 96], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("Knowledge Row 1", 54, ["PRD 会员启用", "ready", "fresh", "PC-071", "Project"], [118, 80, 90, 122, 96], { fillBg: "#FFFFFF" }),
      miniRow("Knowledge Row 2", 90, ["API 文档", "stale", "3d", "Assertions", "Project"], [118, 80, 90, 122, 96], { fillBg: "#FFFBEB" }),
    ]),
    frame("Skills Panel", 622, 104, 570, 250, { fill: "$--surface", cornerRadius: 10 }, [
      text("Skills Title", 18, 16, 280, "Skills / Contextual AI Chat", { fontSize: 16, fontWeight: "800" }),
      badge("Open WebUI", 392, 14, 94, "purple"),
      badge("Dify Plugins", 494, 14, 86, "blue"),
      text("Skills Body", 18, 52, 520, "Skill 是可治理能力资产；Chat 是右侧使用入口。\n列表展示：用途、版本、状态、绑定 Knowledge、允许 MCP、调用历史。\n所有 AI 输出必须能 accept / edit / reject / regenerate / mark reason。", { fontSize: 12, lineHeight: 22, fill: "$--muted" }),
      miniRow("Skill Row Header", 18, ["Skill", "Context", "Sources", "Tools", "Status"], [130, 118, 110, 92, 86], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("Skill Row 1", 54, ["状态流转识别", "Requirement", "PRD/API", "none", "enabled"], [130, 118, 110, 92, 86], { fillBg: "#FFFFFF" }),
      miniRow("Skill Row 2", 90, ["失败分析", "Execution", "logs/trace", "read-only", "enabled"], [130, 118, 110, 92, 86], { fillBg: "#FFFFFF" }),
    ]),
    frame("MCP Panel", 28, 382, 570, 250, { fill: "$--surface", cornerRadius: 10 }, [
      text("MCP Title", 18, 16, 280, "MCP Governance Center", { fontSize: 16, fontWeight: "800" }),
      badge("Cline", 438, 14, 52, "purple"),
      badge("Official MCP", 500, 14, 96, "blue"),
      text("MCP Body", 18, 52, 520, "结构：Server list -> Tools / Resources / Prompts -> Permission -> Invocation Logs\n交互：server row 展开、tool-level auto-approve、调用原因/输入/结果/影响对象可见。\n不要：让用户直接编辑 JSON 或全局默认启用所有工具。", { fontSize: 12, lineHeight: 22, fill: "$--muted" }),
      miniRow("MCP Row Header", 18, ["Server", "Status", "Tools", "Permission", "Last call"], [126, 80, 80, 132, 108], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("MCP Row 1", 54, ["playwright", "online", "8", "confirm write", "PC-071"], [126, 80, 80, 132, 108], { fillBg: "#FFFFFF" }),
      miniRow("MCP Row 2", 90, ["db-readonly", "online", "3", "read approval", "missing"], [126, 80, 80, 132, 108], { fillBg: "#FFFBEB" }),
    ]),
    frame("Settings Panel", 622, 382, 570, 250, { fill: "$--surface", cornerRadius: 10 }, [
      text("Settings Title", 18, 16, 280, "Project Governance Settings", { fontSize: 16, fontWeight: "800" }),
      badge("Supabase", 442, 14, 78, "green"),
      text("Settings Body", 18, 52, 520, "结构：General / Members / Model Providers / Credentials / Environment Variables / Audit / Danger Zone\n交互：左侧设置分组，中间配置表单或表格，右侧 scope/risk/usage inspector。\n不要：早期复杂企业 RBAC；不要把所有设置平铺一级菜单。", { fontSize: 12, lineHeight: 22, fill: "$--muted" }),
      text("Settings Groups", 18, 150, 520, "Credentials 要区分 publishable / server-only secret / service-role / MCP credential / model provider credential。Danger Zone 必须用 Alert Dialog 和确认短语。", { fontSize: 12, lineHeight: 21, fill: "$--muted" }),
    ]),
    frame("Boundary Note", 28, 664, 1164, 90, { fill: "#F8FAFC", cornerRadius: 10 }, [
      text("Boundary Title", 18, 14, 260, "边界规则", { fontSize: 14, fontWeight: "800" }),
      text("Boundary Body", 18, 42, 1080, "Knowledge / Skills / MCP / Settings 都服务 Proof Case 的证据链和可信 AI，不是独立炫技中心。高频工作入口仍是 Workbench 与 Verification Tasks。", { fontSize: 12, fill: "$--muted" }),
    ]),
  ]);

  return screen("E System Context - Knowledge / Skills / MCP / Settings", 1520, 1000, [
    topBar("System Context"),
    primaryNav("System Context"),
    content,
  ]);
}

function componentMatrixScreen() {
  const content = frame("Component Matrix Main", 200, 54, 1240, 806, { fill: "$--bg", stroke: false }, [
    text("Component Title", 28, 24, 650, "Component Reference Matrix", { fontSize: 24, fontWeight: "800" }),
    text("Component Sub", 28, 58, 940, "OpenPencil 是画布工具，不是 shadcn-vue 组件库。这里把产品页面模式、组件视觉参考、最终落地组件分清楚。", { fontSize: 13, fill: "$--muted" }),
    frame("Tool Boundary", 28, 94, 1164, 158, { fill: "$--surface", cornerRadius: 10 }, [
      miniRow("Tool Boundary Header", 18, ["需求", "推荐工具/链路", "原因"], [220, 330, 576], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("Tool Boundary Row 1", 54, ["看/画原型画布", "OpenPencil", "适合产品结构、交互说明、评审用低保真画布"], [220, 330, 576], { fillBg: "#FFFFFF" }),
      miniRow("Tool Boundary Row 2", 86, ["免费 shadcn 风格 UI Kit", "Figma 社区 shadcn kit", "组件形态更接近设计师使用习惯，适合高保真"], [220, 330, 576], { fillBg: "#FFFFFF" }),
      miniRow("Tool Boundary Row 3", 118, ["桥接到 OpenPencil", "Figma kit -> .fig -> OpenPencil", "桥接设计外观和组件结构，不桥接 Vue 代码能力、运行时交互、完整 variants/tokens"], [220, 330, 576], { fillBg: "#F8FAFC" }),
    ]),
    frame("Component Table", 28, 276, 1164, 354, { fill: "$--surface", cornerRadius: 10 }, [
      text("Component Table Title", 18, 16, 360, "组件清单：参考系 -> Crab 用法 -> 落地组件", { fontSize: 16, fontWeight: "800" }),
      miniRow("Comp Header", 18, ["组件/模式", "Crab 使用场景", "实现基础", "视觉/交互参考", "产品模式来源"], [160, 266, 186, 240, 274], { bold: true, fillBg: "#F8FAFC" }),
      miniRow("Comp Row 1", 54, ["Sidebar/Breadcrumb/Resizable", "工作台外壳、左树、中间工作区、右面板", "shadcn-vue", "shadcn Blocks / Atlassian", "Hoppscotch / Playwright"], [160, 266, 186, 240, 274], { fillBg: "#FFFFFF" }),
      miniRow("Comp Row 2", 90, ["Data Table / Table", "状态流转表、证据矩阵、Skills/MCP/Settings 列表", "shadcn-vue", "Atlassian dense table", "Allure / Dify / Supabase"], [160, 266, 186, 240, 274], { fillBg: "#FFFFFF" }),
      miniRow("Comp Row 3", 126, ["Dialog / Alert Dialog", "创建、确认、删除、Danger Zone", "shadcn-vue + radix-vue", "Radix Themes", "Supabase settings"], [160, 266, 186, 240, 274], { fillBg: "#FFFFFF" }),
      miniRow("Comp Row 4", 162, ["Sheet / Drawer", "AI 助手、证据详情、属性检查、检索测试", "shadcn-vue", "shadcn Blocks", "Cline / Dify"], [160, 266, 186, 240, 274], { fillBg: "#FFFFFF" }),
      miniRow("Comp Row 5", 198, ["Tabs / Accordion / Stepper", "请求编辑、Trace tabs、报告 drill-down、生命周期阶段", "shadcn-vue", "Radix / Material Motion", "Hoppscotch / Playwright / Allure"], [160, 266, 186, 240, 274], { fillBg: "#FFFFFF" }),
      miniRow("Comp Row 6", 234, ["Badge / Progress / Skeleton / Sonner", "状态、风险、AI/人/系统来源、执行反馈", "shadcn-vue", "Atlassian status + Material feedback", "所有模块"], [160, 266, 186, 240, 274], { fillBg: "#FFFFFF" }),
      miniRow("Comp Row 7", 270, ["Command / Dropdown / Tooltip", "全局搜索、批量动作、解释图标/风险", "shadcn-vue", "shadcn Blocks", "Workbench / Settings"], [160, 266, 186, 240, 274], { fillBg: "#FFFFFF" }),
      miniRow("Comp Row 8", 306, ["Business Components", "Proof 状态、AI 草稿、确认条、证据矩阵、时间线、报告结论", "一方组件封装", "Figma shadcn kit + coded prototype", "Crab 自身领域模型"], [160, 266, 186, 240, 274], { fillBg: "#F8FAFC" }),
    ]),
    frame("Reference Links", 28, 650, 560, 128, { fill: "$--surface", cornerRadius: 10 }, [
      text("Links Title", 16, 14, 230, "UI/UX 参考链接", { fontSize: 15, fontWeight: "800" }),
      text("Links Body", 16, 44, 510, "shadcn-vue Components: https://www.shadcn-vue.com/docs/components\nshadcn-vue Figma: https://www.shadcn-vue.com/docs/figma\nshadcn/ui Blocks: https://ui.shadcn.com/blocks\nRadix Themes / Atlassian / Material Motion / Apple HIG / Mobbin", { fontSize: 11, lineHeight: 19, fill: "$--muted" }),
    ]),
    frame("Design Handoff", 612, 650, 580, 128, { fill: "#F8FAFC", cornerRadius: 10 }, [
      text("Handoff Title", 16, 14, 240, "交付规则", { fontSize: 15, fontWeight: "800" }),
      text("Handoff Body", 16, 44, 530, "OpenPencil 输出页面结构和交互意图；Figma kit 用来确认高保真组件样式；最终以项目里的 shadcn-vue + Tailwind coded prototype 为实现真相。", { fontSize: 12, lineHeight: 20, fill: "$--muted" }),
    ]),
  ]);

  return screen("F Component Reference System", 3000, 1000, [
    topBar("Component System"),
    primaryNav("Settings"),
    content,
  ]);
}

const root = frame("Crab Proof Case Product Prototype v2", 0, 0, 4480, 1920, { fill: "$--canvas", stroke: false }, [
  text("Canvas Title", 40, 24, 900, "Crab / RJ Auto Test - Proof Case Product Prototype v2", { fontSize: 28, fontWeight: "800" }),
  text("Canvas Note", 40, 58, 1320, "用途：产品评审画布。它体现 Proof Case 证据链、参考产品迁移、组件参考系，不等于最终 shadcn-vue 高保真实现。", { fontSize: 13, fill: "$--muted" }),
  workbenchScreen(),
  proofCaseScreen(),
  apiWorkbenchScreen(),
  executionReportScreen(),
  systemContextScreen(),
  componentMatrixScreen(),
]);

const doc = {
  version: "2.8",
  children: [root],
  variables: {
    "--canvas": { type: "color", value: "#E5E7EB" },
    "--screen": { type: "color", value: "#F8FAFC" },
    "--bg": { type: "color", value: "#F1F5F9" },
    "--surface": { type: "color", value: "#FFFFFF" },
    "--line": { type: "color", value: "#CBD5E1" },
    "--text": { type: "color", value: "#0F172A" },
    "--muted": { type: "color", value: "#64748B" },
    "--blue": { type: "color", value: "#2563EB" },
    "--purple": { type: "color", value: "#7C3AED" },
    "--green": { type: "color", value: "#16A34A" },
    "--amber": { type: "color", value: "#D97706" },
    "--red": { type: "color", value: "#DC2626" },
    "--font-primary": { type: "string", value: "Microsoft YaHei" },
    "--font-mono": { type: "string", value: "Consolas" },
  },
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
console.log(outFile);
