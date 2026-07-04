import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiAutomationService,
  evaluateAssertions,
  extractVariables,
} from "../src/modules/api-automation/api-automation.service";

function makeService(prisma: Record<string, unknown>) {
  return new ApiAutomationService(
    prisma as never,
    {
      encrypt: vi.fn((plaintext: string) => ({
        blob: Buffer.from(`cipher:${plaintext}`).toString("base64"),
        keyId: "key-1",
      })),
      decrypt: vi.fn(() => "s3cr3t"),
    } as never,
    { record: vi.fn() } as never,
    { resolveForRun: vi.fn().mockResolvedValue({}) } as never,
  );
}

function apiCase(overrides: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    projectId: "project-a",
    name: "Health check",
    method: "GET",
    url: "http://service.local/health",
    headers: [],
    body: null,
    createdBy: "user-a",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    assertions: [],
    extractions: [],
    ...overrides,
  };
}

function apiExecution(data: Record<string, unknown>) {
  return {
    id: "exec-1",
    projectId: data.projectId as string,
    caseId: data.caseId as string,
    environmentId: (data.environmentId as string | undefined) ?? null,
    environmentName: (data.environmentName as string | undefined) ?? null,
    status: data.status as string,
    startedAt: data.startedAt as Date,
    finishedAt: (data.finishedAt as Date | undefined) ?? null,
    durationMs: (data.durationMs as number | undefined) ?? null,
    responseStatus: (data.responseStatus as number | undefined) ?? null,
    assertionResults: data.assertionResults,
    extractedVariables: data.extractedVariables,
    responseSnapshot: data.responseSnapshot ?? null,
    reportSummary: data.reportSummary ?? null,
    createdBy: data.createdBy as string,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("api automation case authoring", () => {
  it("stores secret request headers as references and omits plaintext from DTOs", async () => {
    const apiSecretCreate = vi.fn().mockResolvedValue({ id: "secret-1" });
    const apiTestCaseCreate = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve(
        apiCase({
          method: data.method,
          url: data.url,
          headers: data.headers,
          assertions: data.assertions.create.map((a: Record<string, unknown>) => ({
            id: "assert-1",
            ...a,
          })),
        }),
      ),
    );
    const svc = makeService({
      apiSecret: { create: apiSecretCreate },
      apiTestCase: { create: apiTestCaseCreate },
    });

    const dto = await svc.createCase("project-a", "user-a", {
      name: "Secret header",
      method: "GET",
      url: "{{baseUrl}}/health",
      headers: [{ key: "Authorization", value: "Bearer secret-token", secret: true }],
      assertions: [{ order: 1, source: "status", operator: "equals", expected: "200" }],
    });

    expect(apiSecretCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-a",
          credentialCiphertext: expect.any(Buffer),
          credentialKeyId: "key-1",
        }),
      }),
    );
    expect(JSON.stringify(apiTestCaseCreate.mock.calls[0]![0].data)).not.toContain("secret-token");
    expect(dto.headers).toEqual([{ key: "Authorization", secretRefId: "secret-1", masked: true }]);
  });
});

describe("api automation execution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("substitutes environments, records assertion results, and extracts variables", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ token: "abc", echo: "s3cr3t" }), {
          status: 200,
          headers: { "x-trace": "run-1" },
        }),
      ),
    );
    const createExecution = vi.fn().mockImplementation(({ data }) => Promise.resolve(apiExecution(data)));
    const svc = makeService({
      apiTestCase: {
        findFirst: vi.fn().mockResolvedValue(
          apiCase({
            url: "{{baseUrl}}/health",
            headers: [{ key: "Authorization", secretRefId: "secret-1", masked: true }],
            assertions: [
              {
                id: "assert-1",
                order: 1,
                source: "status",
                target: null,
                operator: "equals",
                expected: "200",
              },
              {
                id: "assert-2",
                order: 2,
                source: "body",
                target: "$.echo",
                operator: "equals",
                expected: "{{apiToken}}",
              },
            ],
            extractions: [
              { id: "extract-1", order: 1, name: "token", source: "body", path: "$.token" },
            ],
          }),
        ),
      },
      apiEnvironment: {
        findFirst: vi.fn().mockResolvedValue({
          id: "env-1",
          projectId: "project-a",
          name: "Local",
          variables: [
            { key: "baseUrl", value: "https://api.example.local" },
            { key: "apiToken", secretRefId: "secret-1", masked: true },
          ],
          createdBy: "user-a",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      apiSecret: {
        findFirst: vi.fn().mockResolvedValue({
          id: "secret-1",
          projectId: "project-a",
          credentialCiphertext: Buffer.from("cipher"),
          credentialKeyId: "key-1",
        }),
      },
      apiExecution: { create: createExecution },
    });

    const dto = await svc.runCase("project-a", "case-1", "user-a", { environmentId: "env-1" });

    const fetchCall = vi.mocked(fetch).mock.calls[0]!;
    expect(fetchCall[0]).toBe("https://api.example.local/health");
    expect((fetchCall[1] as RequestInit).headers).toEqual({ Authorization: "s3cr3t" });
    expect(dto.status).toBe("passed");
    expect(dto.assertionResults[0]?.passed).toBe(true);
    expect(dto.assertionResults[1]).toMatchObject({
      actual: "[secret]",
      expected: "[secret]",
      passed: true,
    });
    expect(dto.extractedVariables).toEqual({ token: "abc" });
    expect(JSON.stringify(createExecution.mock.calls[0]![0].data.assertionResults)).not.toContain("s3cr3t");
    expect(JSON.stringify(createExecution.mock.calls[0]![0].data.responseSnapshot)).not.toContain("s3cr3t");
  });

  it("marks failed assertions and stores only a redacted response snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("token=s3cr3t", {
          status: 200,
        }),
      ),
    );
    const createExecution = vi.fn().mockImplementation(({ data }) => Promise.resolve(apiExecution(data)));
    const svc = makeService({
      apiTestCase: {
        findFirst: vi.fn().mockResolvedValue(
          apiCase({
            headers: [{ key: "Authorization", secretRefId: "secret-1", masked: true }],
            assertions: [
              {
                id: "assert-1",
                order: 1,
                source: "status",
                target: null,
                operator: "equals",
                expected: "201",
              },
            ],
          }),
        ),
      },
      apiSecret: {
        findFirst: vi.fn().mockResolvedValue({
          id: "secret-1",
          projectId: "project-a",
          credentialCiphertext: Buffer.from("cipher"),
          credentialKeyId: "key-1",
        }),
      },
      apiExecution: { create: createExecution },
    });

    const dto = await svc.runCase("project-a", "case-1", "user-a", {});

    expect(dto.status).toBe("failed");
    expect(dto.assertionResults[0]).toMatchObject({ passed: false, actual: "200" });
    expect(JSON.stringify(dto.responseSnapshot)).toContain("[secret]");
    expect(JSON.stringify(dto.responseSnapshot)).not.toContain("s3cr3t");
  });

  it("filters execution lookups by project", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const svc = makeService({ apiExecution: { findFirst } });

    await expect(svc.getExecution("project-a", "exec-b")).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "exec-b", projectId: "project-a" } });
  });
});

describe("api automation assertion helpers", () => {
  it("evaluates body paths and extraction paths without a custom DSL", () => {
    const body = JSON.stringify({ nested: { ok: true }, token: "abc" });
    expect(
      evaluateAssertions(
        [{ order: 1, source: "body", target: "$.nested.ok", operator: "equals", expected: "true" }],
        { status: 200, headers: {}, bodyText: body },
      )[0]?.passed,
    ).toBe(true);
    expect(extractVariables([{ order: 1, name: "token", source: "body", path: "$.token" }], {}, body)).toEqual({
      token: "abc",
    });
  });

  it("rejects unsupported methods before persistence", async () => {
    const svc = makeService({});
    await expect(
      svc.createCase("project-a", "user-a", {
        name: "Bad method",
        method: "TRACE" as never,
        url: "https://api.example.local",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
