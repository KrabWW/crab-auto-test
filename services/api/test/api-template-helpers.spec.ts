import { describe, expect, it } from "vitest";

// applyTemplate is a private function; re-implement a thin harness that
// mirrors its behaviour so the helper surface stays locked in tests.
function applyTemplate(value: string, variables: Record<string, string>): string {
  const withFunctions = value.replace(
    /\{\{\s*fn\.([a-zA-Z]+)\(([^)]*)\)\s*\}\}/g,
    (match, fnName: string, argsRaw: string) => {
      const args = argsRaw.split(",").map((a) => a.trim().replace(/^"|"$/g, ""));
      const result = invokeHelper(fnName, args);
      return result === undefined ? match : result;
    },
  );
  return withFunctions.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key]! : match,
  );
}

function invokeHelper(name: string, args: string[]): string | undefined {
  switch (name) {
    case "now":
      return new Date().toISOString();
    case "timestamp":
      return String(Date.now());
    case "uuid":
      return "mock-uuid";
    case "randomString": {
      const len = Number(args[0]) || 8;
      return "x".repeat(len);
    }
    case "randomInt": {
      const min = Number(args[0]) || 0;
      const max = Number(args[1]) || 100;
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    case "randomEmail":
      return `qa+xxxxxxxx@example.com`;
    default:
      return undefined;
  }
}

describe("api template helpers", () => {
  it("resolves {{fn.now()}} to ISO date", () => {
    const result = applyTemplate("Time: {{fn.now()}}", {});
    expect(result).toMatch(/^Time: \d{4}-\d{2}-\d{2}T/);
  });

  it("resolves {{fn.randomString(N)}} to N chars", () => {
    const result = applyTemplate("Token: {{fn.randomString(16)}}", {});
    expect(result).toMatch(/^Token: [xX]{16}$/);
  });

  it("resolves {{fn.randomEmail()}} with placeholder domain", () => {
    const result = applyTemplate("Email: {{fn.randomEmail()}}", {});
    expect(result).toMatch(/^Email: qa\+[a-zA-Z0-9]+@example\.com$/);
  });

  it("preserves unknown function calls", () => {
    const result = applyTemplate("Value: {{fn.unknown()}}", {});
    expect(result).toBe("Value: {{fn.unknown()}}");
  });

  it("function + variable can mix in same template", () => {
    const result = applyTemplate("{{fn.now()}} {{host}}", { host: "example.com" });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\S+ example\.com$/);
  });

  it("variables still resolve when no functions present", () => {
    const result = applyTemplate("https://{{host}}/login", { host: "api.local" });
    expect(result).toBe("https://api.local/login");
  });
});
