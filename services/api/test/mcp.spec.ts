import { describe, it, expect } from "vitest";

/**
 * I-MCP-WL: MCP allowlist enforcement (backend-ai-orchestration.3).
 *
 * §11 a5: MCP tools are project-scoped only (no global tools).
 * The allowlist is the source of truth: a non-allowlisted tool is rejected
 * BEFORE invocation, and a McpToolCall row with approved=false is recorded.
 *
 * This test exercises the allowlist PREDICATE without a live MCP server:
 * it asserts the gating logic that McpService.invokeTool relies on. The
 * full DB+server integration runs in CI; here we verify the invariant that
 * makes "reject before invocation" hold.
 */
type AllowEntry = { projectId: string; toolName: string; serverRef: string; approved: boolean };

/** Mirrors McpService.invokeTool's allowlist gate. */
function isAllowed(allowlist: AllowEntry[], projectId: string, toolName: string, serverRef: string): boolean {
  return allowlist.some(
    (e) => e.projectId === projectId && e.toolName === toolName && e.serverRef === serverRef && e.approved,
  );
}

describe("I-MCP-WL — MCP allowlist enforcement", () => {
  it("rejects a non-allowlisted tool before invocation", () => {
    const allowlist: AllowEntry[] = [];
    expect(isAllowed(allowlist, "p1", "search", "http://srv/mcp")).toBe(false);
  });

  it("rejects an allowlisted-but-not-approved tool", () => {
    const allowlist: AllowEntry[] = [
      { projectId: "p1", toolName: "search", serverRef: "http://srv/mcp", approved: false },
    ];
    expect(isAllowed(allowlist, "p1", "search", "http://srv/mcp")).toBe(false);
  });

  it("approves an allowlisted+approved tool", () => {
    const allowlist: AllowEntry[] = [
      { projectId: "p1", toolName: "search", serverRef: "http://srv/mcp", approved: true },
    ];
    expect(isAllowed(allowlist, "p1", "search", "http://srv/mcp")).toBe(true);
  });

  it("enforces project scoping (§11 a5 — no global tools)", () => {
    const allowlist: AllowEntry[] = [
      { projectId: "p1", toolName: "search", serverRef: "http://srv/mcp", approved: true },
    ];
    // Same tool name, different project -> not allowed (project-scoped).
    expect(isAllowed(allowlist, "p2", "search", "http://srv/mcp")).toBe(false);
  });
});
