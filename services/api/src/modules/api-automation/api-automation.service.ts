import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EnvelopeEncryptionService } from "../../infra/crypto/envelope-encryption.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ApiGlobalHeadersService } from "./api-global-headers.service";
import type {
  ApiAssertionDto,
  ApiAssertionOperator,
  ApiAssertionResultDto,
  ApiAssertionSource,
  ApiEnvironmentDto,
  ApiExecutionDto,
  ApiExecutionStatus,
  ApiExtractionSource,
  ApiHttpMethod,
  ApiNamedValueDto,
  ApiTestCaseDto,
  ApiVariableExtractionDto,
  CreateApiEnvironmentRequest,
  CreateApiNamedValueRequest,
  CreateApiRunRequest,
  CreateApiTestCaseRequest,
  UpdateApiEnvironmentRequest,
  UpdateApiTestCaseRequest,
} from "@crab/shared-types";

const HTTP_METHODS = new Set<ApiHttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const ASSERTION_SOURCES = new Set<ApiAssertionSource>(["status", "header", "body"]);
const ASSERTION_OPERATORS = new Set<ApiAssertionOperator>([
  "equals",
  "contains",
  "exists",
  "not-empty",
]);
const EXTRACTION_SOURCES = new Set<ApiExtractionSource>(["header", "body"]);
const SNAPSHOT_BODY_LIMIT = 4_000;
const REQUEST_TIMEOUT_MS = 15_000;

type HeaderBag = Record<string, string>;
type JsonObject = Record<string, unknown>;

interface ApiCaseRow {
  id: string;
  projectId: string;
  name: string;
  method: string;
  url: string;
  headers: unknown;
  body: string | null;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  assertions: Array<{
    id: string;
    order: number;
    source: string;
    target: string | null;
    operator: string;
    expected: string | null;
  }>;
  extractions: Array<{
    id: string;
    order: number;
    name: string;
    source: string;
    path: string;
  }>;
}

interface ApiEnvironmentRow {
  id: string;
  projectId: string;
  name: string;
  variables: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ApiExecutionRow {
  id: string;
  projectId: string;
  caseId: string;
  environmentId: string | null;
  environmentName: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  responseStatus: number | null;
  assertionResults: unknown;
  extractedVariables: unknown;
  responseSnapshot: unknown;
  reportSummary: unknown;
  createdBy: string;
  createdAt: Date;
}

@Injectable()
export class ApiAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: EnvelopeEncryptionService,
    private readonly audit: AuditService,
    private readonly globalHeaders: ApiGlobalHeadersService,
  ) {}

  async listEnvironments(projectId: string): Promise<ApiEnvironmentDto[]> {
    const rows = await this.prisma.apiEnvironment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toEnvironmentDto(row));
  }

  async createEnvironment(
    projectId: string,
    actorId: string,
    req: CreateApiEnvironmentRequest,
  ): Promise<ApiEnvironmentDto> {
    const variables = await this.normalizeNamedValues(
      projectId,
      actorId,
      "environment",
      req.variables ?? [],
    );
    const env = await this.prisma.apiEnvironment.create({
      data: {
        projectId,
        name: req.name,
        variables: variables as never,
        createdBy: actorId,
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-environment.create",
      targetType: "api-environment",
      targetId: env.id,
      outcome: "success",
      metadata: { variableCount: variables.length },
    });
    return this.toEnvironmentDto(env);
  }

  async updateEnvironment(
    projectId: string,
    environmentId: string,
    actorId: string,
    req: UpdateApiEnvironmentRequest,
  ): Promise<ApiEnvironmentDto> {
    await this.assertEnvironment(projectId, environmentId);
    const variables =
      req.variables === undefined
        ? undefined
        : await this.normalizeNamedValues(projectId, actorId, "environment", req.variables);
    const env = await this.prisma.apiEnvironment.update({
      where: { id: environmentId },
      data: {
        ...(req.name !== undefined ? { name: req.name } : {}),
        ...(variables !== undefined ? { variables: variables as never } : {}),
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-environment.update",
      targetType: "api-environment",
      targetId: env.id,
      outcome: "success",
    });
    return this.toEnvironmentDto(env);
  }

  async deleteEnvironment(projectId: string, environmentId: string, actorId: string): Promise<void> {
    await this.assertEnvironment(projectId, environmentId);
    await this.prisma.apiEnvironment.delete({ where: { id: environmentId } });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-environment.delete",
      targetType: "api-environment",
      targetId: environmentId,
      outcome: "success",
    });
  }

  async listCases(projectId: string): Promise<ApiTestCaseDto[]> {
    const rows = await this.prisma.apiTestCase.findMany({
      where: { projectId },
      include: this.caseInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toCaseDto(row));
  }

  async getCase(projectId: string, caseId: string): Promise<ApiTestCaseDto> {
    const row = await this.findCase(projectId, caseId);
    return this.toCaseDto(row);
  }

  async createCase(
    projectId: string,
    actorId: string,
    req: CreateApiTestCaseRequest,
  ): Promise<ApiTestCaseDto> {
    const method = this.normalizeMethod(req.method);
    const headers = await this.normalizeNamedValues(projectId, actorId, "case-header", req.headers ?? []);
    const assertions = this.normalizeAssertions(req.assertions ?? []);
    const extractions = this.normalizeExtractions(req.extractions ?? []);
    this.assertUrl(req.url, { allowTemplates: true });

    const created = await this.prisma.apiTestCase.create({
      data: {
        projectId,
        name: req.name,
        method,
        url: req.url,
        headers: headers as never,
        body: req.body,
        tags: this.normalizeTags(req.tags),
        createdBy: actorId,
        assertions: {
          create: assertions.map((a) => ({
            order: a.order,
            source: a.source,
            target: a.target,
            operator: a.operator,
            expected: a.expected,
          })),
        },
        extractions: {
          create: extractions.map((e) => ({
            order: e.order,
            name: e.name,
            source: e.source,
            path: e.path,
          })),
        },
      },
      include: this.caseInclude,
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-case.create",
      targetType: "api-case",
      targetId: created.id,
      outcome: "success",
      metadata: { assertionCount: assertions.length, extractionCount: extractions.length },
    });
    return this.toCaseDto(created);
  }

  async updateCase(
    projectId: string,
    caseId: string,
    actorId: string,
    req: UpdateApiTestCaseRequest,
  ): Promise<ApiTestCaseDto> {
    await this.findCase(projectId, caseId);
    const method = req.method === undefined ? undefined : this.normalizeMethod(req.method);
    if (req.url !== undefined) this.assertUrl(req.url, { allowTemplates: true });
    const headers =
      req.headers === undefined
        ? undefined
        : await this.normalizeNamedValues(projectId, actorId, "case-header", req.headers);
    const assertions = req.assertions === undefined ? undefined : this.normalizeAssertions(req.assertions);
    const extractions =
      req.extractions === undefined ? undefined : this.normalizeExtractions(req.extractions);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (assertions !== undefined) {
        await tx.apiAssertion.deleteMany({ where: { caseId } });
      }
      if (extractions !== undefined) {
        await tx.apiVariableExtraction.deleteMany({ where: { caseId } });
      }
      return tx.apiTestCase.update({
        where: { id: caseId },
        data: {
          ...(req.name !== undefined ? { name: req.name } : {}),
          ...(method !== undefined ? { method } : {}),
          ...(req.url !== undefined ? { url: req.url } : {}),
          ...(headers !== undefined ? { headers: headers as never } : {}),
          ...(req.body !== undefined ? { body: req.body } : {}),
          ...(req.tags !== undefined ? { tags: this.normalizeTags(req.tags) } : {}),
          ...(assertions !== undefined
            ? {
                assertions: {
                  create: assertions.map((a) => ({
                    order: a.order,
                    source: a.source,
                    target: a.target,
                    operator: a.operator,
                    expected: a.expected,
                  })),
                },
              }
            : {}),
          ...(extractions !== undefined
            ? {
                extractions: {
                  create: extractions.map((e) => ({
                    order: e.order,
                    name: e.name,
                    source: e.source,
                    path: e.path,
                  })),
                },
              }
            : {}),
        },
        include: this.caseInclude,
      });
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-case.update",
      targetType: "api-case",
      targetId: updated.id,
      outcome: "success",
    });
    return this.toCaseDto(updated);
  }

  async deleteCase(projectId: string, caseId: string, actorId: string): Promise<void> {
    await this.findCase(projectId, caseId);
    await this.prisma.apiTestCase.delete({ where: { id: caseId } });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-case.delete",
      targetType: "api-case",
      targetId: caseId,
      outcome: "success",
    });
  }

  async runCase(
    projectId: string,
    caseId: string,
    actorId: string,
    req: CreateApiRunRequest,
  ): Promise<ApiExecutionDto> {
    const testCase = await this.findCase(projectId, caseId);
    const environment =
      req.environmentId === undefined
        ? undefined
        : await this.findEnvironment(projectId, req.environmentId);

    const secrets: string[] = [];
    const variables = await this.resolveVariables(projectId, environment, secrets);
    const globalHeaders = await this.globalHeaders.resolveForRun(projectId);
    const request = await this.buildRequest(projectId, testCase, variables, secrets, globalHeaders);
    const startedAt = new Date();
    const started = Date.now();

    let status: ApiExecutionStatus = "error";
    let responseStatus: number | undefined;
    let assertionResults: ApiAssertionResultDto[] = [];
    let extractedVariables: Record<string, string> = {};
    let responseSnapshot: JsonObject | undefined;
    let errorMessage: string | undefined;

    try {
      const response = await this.fetchWithTimeout(request);
      responseStatus = response.status;
      const responseText = await response.text();
      const responseHeaders = headersToObject(response.headers);
      assertionResults = evaluateAssertions(
        testCase.assertions.map((a) => this.toAssertionDto(a)),
        {
          status: response.status,
          headers: responseHeaders,
          bodyText: responseText,
          variables,
        },
      ).map((result) => ({
        ...result,
        expected: result.expected === undefined ? undefined : redactSecrets(result.expected, secrets),
        actual: result.actual === undefined ? undefined : redactSecrets(result.actual, secrets),
        message: result.message === undefined ? undefined : redactSecrets(result.message, secrets),
      }));
      extractedVariables = extractVariables(
        testCase.extractions.map((e) => this.toExtractionDto(e)),
        responseHeaders,
        responseText,
        secrets,
      );
      status = assertionResults.every((result) => result.passed) ? "passed" : "failed";
      responseSnapshot = {
        status: response.status,
        headers: redactHeaderBag(responseHeaders, secrets),
        body: truncate(redactSecrets(responseText, secrets), SNAPSHOT_BODY_LIMIT),
      };
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Request failed";
      assertionResults = testCase.assertions.map((a) => ({
        ...this.toAssertionDto(a),
        expected:
          a.expected === null ? undefined : redactSecrets(applyTemplate(a.expected, variables), secrets),
        passed: false,
        message: redactSecrets(errorMessage!, secrets),
      }));
      responseSnapshot = { error: redactSecrets(errorMessage, secrets) };
    }

    const finishedAt = new Date();
    const durationMs = Date.now() - started;
    const execution = await this.prisma.apiExecution.create({
      data: {
        projectId,
        caseId,
        environmentId: environment?.id,
        environmentName: environment?.name,
        status,
        startedAt,
        finishedAt,
        durationMs,
        responseStatus,
        assertionResults: assertionResults as never,
        extractedVariables: extractedVariables as never,
        responseSnapshot: responseSnapshot as never,
        reportSummary: {
          caseName: testCase.name,
          method: testCase.method,
          url: redactSecrets(request.url, secrets),
          assertionTotal: assertionResults.length,
          assertionPassed: assertionResults.filter((result) => result.passed).length,
          extractedCount: Object.keys(extractedVariables).length,
          error: errorMessage === undefined ? undefined : redactSecrets(errorMessage, secrets),
        } as never,
        createdBy: actorId,
      },
    });
    await this.audit.record({
      actorId,
      projectId,
      action: "api-case.run",
      targetType: "api-execution",
      targetId: execution.id,
      outcome: status === "error" ? "failure" : "success",
      metadata: { caseId, status },
    });
    return this.toExecutionDto(execution);
  }

  async listExecutions(projectId: string): Promise<ApiExecutionDto[]> {
    const rows = await this.prisma.apiExecution.findMany({
      where: { projectId },
      orderBy: { startedAt: "desc" },
    });
    return rows.map((row) => this.toExecutionDto(row));
  }

  async getExecution(projectId: string, executionId: string): Promise<ApiExecutionDto> {
    const row = await this.prisma.apiExecution.findFirst({
      where: { id: executionId, projectId },
    });
    if (!row) throw new NotFoundException("API execution not found");
    return this.toExecutionDto(row);
  }

  private readonly caseInclude = {
    assertions: { orderBy: { order: "asc" as const } },
    extractions: { orderBy: { order: "asc" as const } },
  };

  private async assertEnvironment(projectId: string, environmentId: string): Promise<void> {
    await this.findEnvironment(projectId, environmentId);
  }

  private async findEnvironment(
    projectId: string,
    environmentId: string,
  ): Promise<ApiEnvironmentRow> {
    const env = await this.prisma.apiEnvironment.findFirst({
      where: { id: environmentId, projectId },
    });
    if (!env) throw new NotFoundException("API environment not found");
    return env;
  }

  private async findCase(projectId: string, caseId: string): Promise<ApiCaseRow> {
    const testCase = await this.prisma.apiTestCase.findFirst({
      where: { id: caseId, projectId },
      include: this.caseInclude,
    });
    if (!testCase) throw new NotFoundException("API test case not found");
    return testCase;
  }

  private async normalizeNamedValues(
    projectId: string,
    actorId: string,
    scope: string,
    values: CreateApiNamedValueRequest[],
  ): Promise<ApiNamedValueDto[]> {
    const out: ApiNamedValueDto[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      const key = value.key.trim();
      if (!key) throw new BadRequestException("Named value key is required");
      const normalized = key.toLowerCase();
      if (seen.has(normalized)) throw new BadRequestException(`Duplicate named value: ${key}`);
      seen.add(normalized);
      if (value.secret) {
        const encrypted = this.crypto.encrypt(value.value);
        const secret = await this.prisma.apiSecret.create({
          data: {
            projectId,
            name: `${scope}:${key}`,
            credentialCiphertext: Buffer.from(encrypted.blob, "base64"),
            credentialKeyId: encrypted.keyId,
            createdBy: actorId,
          },
        });
        out.push({ key, secretRefId: secret.id, masked: true });
      } else {
        out.push({ key, value: value.value });
      }
    }
    return out;
  }

  private normalizeMethod(method: string): ApiHttpMethod {
    const normalized = method.toUpperCase() as ApiHttpMethod;
    if (!HTTP_METHODS.has(normalized)) {
      throw new BadRequestException(`Unsupported API method: ${method}`);
    }
    return normalized;
  }

  private normalizeAssertions(assertions: ApiAssertionDto[]): ApiAssertionDto[] {
    const out = assertions.map((assertion, index) => {
      if (!ASSERTION_SOURCES.has(assertion.source)) {
        throw new BadRequestException(`Unsupported assertion source: ${assertion.source}`);
      }
      if (!ASSERTION_OPERATORS.has(assertion.operator)) {
        throw new BadRequestException(`Unsupported assertion operator: ${assertion.operator}`);
      }
      return {
        order: Number.isFinite(assertion.order) ? assertion.order : index + 1,
        source: assertion.source,
        target: assertion.target?.trim() || undefined,
        operator: assertion.operator,
        expected: assertion.expected,
      };
    });
    assertUniqueOrders(out.map((item) => item.order), "assertion");
    return out.sort((a, b) => a.order - b.order);
  }

  private normalizeExtractions(extractions: ApiVariableExtractionDto[]): ApiVariableExtractionDto[] {
    const out = extractions.map((extraction, index) => {
      if (!extraction.name.trim()) throw new BadRequestException("Extraction name is required");
      if (!EXTRACTION_SOURCES.has(extraction.source)) {
        throw new BadRequestException(`Unsupported extraction source: ${extraction.source}`);
      }
      return {
        order: Number.isFinite(extraction.order) ? extraction.order : index + 1,
        name: extraction.name.trim(),
        source: extraction.source,
        path: extraction.path.trim(),
      };
    });
    assertUniqueOrders(out.map((item) => item.order), "extraction");
    return out.sort((a, b) => a.order - b.order);
  }

  private assertUrl(url: string, options: { allowTemplates: boolean } = { allowTemplates: false }) {
    const candidate = options.allowTemplates ? normalizeUrlTemplate(url) : url;
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new BadRequestException("API URL must be http or https");
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("API URL is invalid");
    }
  }

  private async resolveVariables(
    projectId: string,
    environment: ApiEnvironmentRow | undefined,
    secrets: string[],
  ): Promise<Record<string, string>> {
    if (!environment) return {};
    const variables: Record<string, string> = {};
    for (const item of parseNamedValues(environment.variables)) {
      variables[item.key] = await this.resolveNamedValue(projectId, item, secrets);
    }
    return variables;
  }

  private async buildRequest(
    projectId: string,
    testCase: ApiCaseRow,
    variables: Record<string, string>,
    secrets: string[],
    globalHeaders?: Record<string, string>,
  ): Promise<{ url: string; init: RequestInit }> {
    // Project-level global headers provide defaults; explicit case headers override.
    const headers: HeaderBag = { ...(globalHeaders ?? {}) };
    for (const item of parseNamedValues(testCase.headers)) {
      headers[item.key] = applyTemplate(
        await this.resolveNamedValue(projectId, item, secrets),
        variables,
      );
    }
    const method = this.normalizeMethod(testCase.method);
    const body =
      method === "GET" || method === "DELETE" || testCase.body === null
        ? undefined
        : applyTemplate(testCase.body, variables);
    const url = applyTemplate(testCase.url, variables);
    this.assertUrl(url);
    return {
      url,
      init: { method, headers, body },
    };
  }

  private async resolveNamedValue(
    projectId: string,
    item: ApiNamedValueDto,
    secrets: string[],
  ): Promise<string> {
    if (item.secretRefId) {
      const secret = await this.prisma.apiSecret.findFirst({
        where: { id: item.secretRefId, projectId },
      });
      if (!secret) throw new BadRequestException(`Secret reference not found for ${item.key}`);
      const plaintext = this.crypto.decrypt({
        blob: secret.credentialCiphertext.toString("base64"),
        keyId: secret.credentialKeyId,
      });
      secrets.push(plaintext);
      return plaintext;
    }
    return item.value ?? "";
  }

  private async fetchWithTimeout(request: {
    url: string;
    init: RequestInit;
  }): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(request.url, { ...request.init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private toEnvironmentDto = (row: ApiEnvironmentRow): ApiEnvironmentDto => ({
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    variables: parseNamedValues(row.variables),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  private toCaseDto = (row: ApiCaseRow): ApiTestCaseDto => ({
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    method: this.normalizeMethod(row.method),
    url: row.url,
    headers: parseNamedValues(row.headers),
    body: row.body ?? undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    assertions: row.assertions.map((assertion) => this.toAssertionDto(assertion)),
    extractions: row.extractions.map((extraction) => this.toExtractionDto(extraction)),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  private normalizeTags(tags: string[] | undefined): string[] {
    if (!Array.isArray(tags)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags) {
      const trimmed = String(raw).trim();
      if (!trimmed || trimmed.length > 40) continue;
      const lowered = trimmed.toLowerCase();
      if (seen.has(lowered)) continue;
      seen.add(lowered);
      out.push(trimmed);
    }
    return out;
  }

  private toAssertionDto(assertion: {
    id: string;
    order: number;
    source: string;
    target: string | null;
    operator: string;
    expected: string | null;
  }): ApiAssertionDto {
    if (!ASSERTION_SOURCES.has(assertion.source as ApiAssertionSource)) {
      throw new BadRequestException(`Unsupported assertion source: ${assertion.source}`);
    }
    if (!ASSERTION_OPERATORS.has(assertion.operator as ApiAssertionOperator)) {
      throw new BadRequestException(`Unsupported assertion operator: ${assertion.operator}`);
    }
    return {
      id: assertion.id,
      order: assertion.order,
      source: assertion.source as ApiAssertionSource,
      target: assertion.target ?? undefined,
      operator: assertion.operator as ApiAssertionOperator,
      expected: assertion.expected ?? undefined,
    };
  }

  private toExtractionDto(extraction: {
    id: string;
    order: number;
    name: string;
    source: string;
    path: string;
  }): ApiVariableExtractionDto {
    if (!EXTRACTION_SOURCES.has(extraction.source as ApiExtractionSource)) {
      throw new BadRequestException(`Unsupported extraction source: ${extraction.source}`);
    }
    return {
      id: extraction.id,
      order: extraction.order,
      name: extraction.name,
      source: extraction.source as ApiExtractionSource,
      path: extraction.path,
    };
  }

  private toExecutionDto = (row: ApiExecutionRow): ApiExecutionDto => ({
    id: row.id,
    projectId: row.projectId,
    caseId: row.caseId,
    environmentId: row.environmentId ?? undefined,
    environmentName: row.environmentName ?? undefined,
    status: row.status as ApiExecutionStatus,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString(),
    durationMs: row.durationMs ?? undefined,
    responseStatus: row.responseStatus ?? undefined,
    assertionResults: parseAssertionResults(row.assertionResults),
    extractedVariables: parseStringRecord(row.extractedVariables),
    responseSnapshot: parseObject(row.responseSnapshot),
    reportSummary: parseObject(row.reportSummary),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  });
}

export function evaluateAssertions(
  assertions: ApiAssertionDto[],
  response: {
    status: number;
    headers: HeaderBag;
    bodyText: string;
    variables?: Record<string, string>;
  },
): ApiAssertionResultDto[] {
  const bodyJson = parseJson(response.bodyText);
  return assertions.map((assertion) => {
    const actual = readAssertionValue(assertion, response, bodyJson);
    const expected =
      assertion.expected === undefined
        ? undefined
        : applyTemplate(assertion.expected, response.variables ?? {});
    const passed = compareAssertion(actual, expected, assertion.operator);
    return {
      ...assertion,
      expected,
      actual,
      passed,
      message: passed ? undefined : `${assertion.source} assertion did not match`,
    };
  });
}

export function extractVariables(
  extractions: ApiVariableExtractionDto[],
  headers: HeaderBag,
  bodyText: string,
  secrets: string[] = [],
): Record<string, string> {
  const bodyJson = parseJson(bodyText);
  const out: Record<string, string> = {};
  for (const extraction of extractions) {
    const value =
      extraction.source === "header"
        ? headers[extraction.path.toLowerCase()]
        : readBodyValue(bodyText, bodyJson, extraction.path);
    if (value !== undefined) {
      out[extraction.name] = redactSecrets(value, secrets);
    }
  }
  return out;
}

export function redactSecrets(input: string, secrets: string[]): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .reduce((text, secret) => text.replace(new RegExp(escapeRegExp(secret), "g"), "[secret]"), input);
}

function assertUniqueOrders(orders: number[], name: string) {
  if (new Set(orders).size !== orders.length) {
    throw new BadRequestException(`Duplicate ${name} order`);
  }
}

function parseNamedValues(value: unknown): ApiNamedValueDto[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "object" && item !== null ? (item as JsonObject) : undefined))
    .filter((item): item is JsonObject => item !== undefined)
    .map((item) => ({
      key: String(item.key ?? ""),
      value: typeof item.value === "string" ? item.value : undefined,
      secretRefId: typeof item.secretRefId === "string" ? item.secretRefId : undefined,
      masked: item.masked === true || typeof item.secretRefId === "string",
    }))
    .filter((item) => item.key.length > 0);
}

function parseAssertionResults(value: unknown): ApiAssertionResultDto[] {
  if (!Array.isArray(value)) return [];
  return value as ApiAssertionResultDto[];
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = String(item ?? "");
  }
  return out;
}

function parseObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function headersToObject(headers: Headers): HeaderBag {
  const out: HeaderBag = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function redactHeaderBag(headers: HeaderBag, secrets: string[]): HeaderBag {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, redactSecrets(value, secrets)]),
  );
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

function applyTemplate(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key]! : match,
  );
}

function normalizeUrlTemplate(value: string): string {
  const replaced = value.replace(/\{\{\s*[A-Za-z0-9_.-]+\s*\}\}/g, "template.local");
  return replaced.startsWith("template.local") ? `https://${replaced}` : replaced;
}

function readAssertionValue(
  assertion: ApiAssertionDto,
  response: { status: number; headers: HeaderBag; bodyText: string },
  bodyJson: unknown,
): string | undefined {
  if (assertion.source === "status") return String(response.status);
  if (assertion.source === "header") {
    return assertion.target ? response.headers[assertion.target.toLowerCase()] : undefined;
  }
  return readBodyValue(response.bodyText, bodyJson, assertion.target);
}

function readBodyValue(bodyText: string, bodyJson: unknown, path?: string): string | undefined {
  if (!path || path === "$" || path === "body") return bodyText;
  if (bodyJson === undefined) return undefined;
  const value = getByPath(bodyJson, path);
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function compareAssertion(
  actual: string | undefined,
  expected: string | undefined,
  operator: ApiAssertionOperator,
): boolean {
  if (operator === "exists") return actual !== undefined;
  if (operator === "not-empty") return actual !== undefined && actual.length > 0;
  if (operator === "contains") return actual !== undefined && actual.includes(expected ?? "");
  return actual === (expected ?? "");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function getByPath(value: unknown, path: string): unknown {
  const normalized = path.replace(/^\$\.?/, "");
  if (!normalized) return value;
  return normalized.split(".").reduce<unknown>((current, segment) => {
    if (current === undefined || current === null) return undefined;
    if (/^\d+$/.test(segment) && Array.isArray(current)) {
      return current[Number(segment)];
    }
    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
