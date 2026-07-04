/**
 * LangChain.js model adapter for ai-orchestration (B1).
 *
 * R7: MVP graph has NO MCP/Skill nodes. This adapter imports ONLY
 * @langchain/openai + @langchain/core + zod — no MCP, no Skill adapters.
 * CI import-scan (r7-import-scan.mjs) enforces this remains true.
 *
 * Backend-owns-orchestration (§11 a7): the LLM is called here, server-side.
 * The credential is resolved in-process from ModelProvidersService (Architect-R5)
 * and NEVER crosses to the client.
 */
import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { ModelProvidersService } from "../model-providers/model-providers.service";
import type {
  DraftTestCaseDto,
  RequirementModuleSplit,
  RequirementReviewDimensionResult,
  RequirementReviewIssue,
  RequirementReviewResult,
} from "@crab/shared-types";

const DraftStepSchema = z.object({
  order: z.number().describe("Step sequence, 1-based"),
  action: z.string().describe("The action to perform"),
  expectedResult: z.string().optional().describe("Expected outcome of the action"),
});

const DraftCaseSchema = z.object({
  title: z.string().describe("Concise test case title"),
  priority: z.enum(["low", "medium", "high", "critical"]).describe("Priority"),
  preconditions: z.string().optional().describe("Preconditions for the case"),
  steps: z.array(DraftStepSchema).min(1).describe("Ordered test steps"),
  expectedResults: z.string().optional().describe("Overall expected result"),
});

const DraftCasesSchema = z.object({
  cases: z.array(DraftCaseSchema).min(1).max(5).describe("Generated test cases"),
});

const ModuleSplitItemSchema = z.object({
  title: z.string().describe("Short module name"),
  content: z.string().describe("Requirement text belonging to this module"),
  order: z.number().describe("1-based position in the source document"),
  confidence: z.number().min(0).max(1).describe("Confidence in this module boundary"),
});

const ModuleSplitSchema = z.object({
  modules: z.array(ModuleSplitItemSchema).min(1).max(15).describe("Functional modules"),
});

const ReviewIssueSchema = z.object({
  severity: z.enum(["high", "medium", "low"]).describe("Issue severity"),
  message: z.string().describe("One-line description of the issue"),
  suggestion: z.string().optional().describe("Concrete improvement suggestion"),
});

const ReviewSchema = z.object({
  clarityScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  testabilityScore: z.number().min(0).max(100),
  boundariesScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  issues: z.array(ReviewIssueSchema).max(20),
  improvements: z.array(z.string()).max(10),
});

export interface DraftGenerationResult {
  cases: DraftTestCaseDto[];
  modelUsed: string;
}

export interface ModuleSplitResult {
  modules: RequirementModuleSplit[];
  modelUsed: string;
}

export interface ReviewResultData {
  result: RequirementReviewResult;
  modelUsed: string;
}

@Injectable()
export class LlmDraftService {
  private readonly logger = new Logger(LlmDraftService.name);

  constructor(private readonly providers: ModelProvidersService) {}

  /**
   * Generate structured draft test cases from requirement text.
   * Uses a configured `generation` provider; decrypts its credential in-process.
   */
  async generateDrafts(
    providerId: string | undefined,
    requirementText: string,
    projectId: string,
  ): Promise<DraftGenerationResult> {
    const provider = await this.resolveProvider(providerId, projectId);
    const model = new ChatOpenAI({
      model: provider.modelName,
      configuration: { baseURL: provider.baseUrl },
      apiKey: provider.credential,
      temperature: 0.3,
    });

    const structured = model.withStructuredOutput(DraftCasesSchema, {
      name: "draft_test_cases",
      method: "jsonSchema",
    });

    const prompt = this.buildPrompt(requirementText);
    this.logger.log(`drafting from requirement (${requirementText.length} chars) via ${provider.modelName}`);

    const result = await structured.invoke(prompt);
    const cases: DraftTestCaseDto[] = result.cases.map((c) => ({
      title: c.title,
      priority: c.priority,
      preconditions: c.preconditions,
      steps: c.steps.map((s) => ({
        order: s.order,
        action: s.action,
        expectedResult: s.expectedResult,
      })),
      expectedResults: c.expectedResults,
    }));
    return { cases, modelUsed: provider.modelName };
  }

  /**
   * AI module splitting (Commit 2): break a requirements document into
   * functional modules. Self-written prompt — no WHartTest copy.
   */
  async generateModules(
    providerId: string | undefined,
    documentText: string,
    documentKind: string,
    projectId: string,
  ): Promise<ModuleSplitResult> {
    const provider = await this.resolveProvider(providerId, projectId);
    const model = new ChatOpenAI({
      model: provider.modelName,
      configuration: { baseURL: provider.baseUrl },
      apiKey: provider.credential,
      temperature: 0.2,
    });

    const structured = model.withStructuredOutput(ModuleSplitSchema, {
      name: "split_requirement_into_modules",
      method: "jsonSchema",
    });

    const prompt = [
      "You are a software test analyst. Split the requirements document below into modules that can be tested independently.",
      "",
      `Source document type: ${documentKind}`,
      "Source document content:",
      documentText.trim().slice(0, 8000),
      "",
      "Rules:",
      "- Usually produces 3-8 modules.",
      "- Each module boundary must be clear enough to author standalone test cases.",
      "- Keep the original terminology. Do not invent features the document does not mention.",
      "- confidence ∈ [0, 1] reflects how certain you are about the module boundary.",
    ].join("\n");

    this.logger.log(`splitting modules (${documentText.length} chars) via ${provider.modelName}`);
    const result = await structured.invoke(prompt);
    const modules: RequirementModuleSplit[] = result.modules.map((m) => ({
      title: m.title,
      content: m.content,
      order: m.order,
      confidence: m.confidence,
    }));
    return { modules, modelUsed: provider.modelName };
  }

  /**
   * AI review (Commit 3): 4-dimension review with issues + improvements.
   * Self-written prompt and dimensions — no WHartTest copy.
   */
  async reviewDocument(
    providerId: string | undefined,
    documentText: string,
    projectId: string,
  ): Promise<ReviewResultData> {
    const provider = await this.resolveProvider(providerId, projectId);
    const model = new ChatOpenAI({
      model: provider.modelName,
      configuration: { baseURL: provider.baseUrl },
      apiKey: provider.credential,
      temperature: 0.2,
    });

    const structured = model.withStructuredOutput(ReviewSchema, {
      name: "review_requirement_document",
      method: "jsonSchema",
    });

    const prompt = [
      "You are a senior test architect. Review the requirements document below across four dimensions:",
      "",
      "1. clarity — are the statements specific, unambiguous, and individually verifiable?",
      "2. completeness — are happy paths, error paths, and boundary conditions covered?",
      "3. testability — can each statement be turned into concrete executable steps?",
      "4. boundaries — are inputs, state transitions, and external dependencies defined?",
      "",
      "Document content:",
      documentText.trim().slice(0, 8000),
      "",
      "Rules:",
      "- Score each dimension 0-100 (integer).",
      "- Provide up to 20 specific issues with severity and a concrete suggestion.",
      "- Provide 3-5 actionable improvement suggestions in the improvements array.",
      "- overallScore is your holistic judgment, not a strict average.",
    ].join("\n");

    this.logger.log(`reviewing document (${documentText.length} chars) via ${provider.modelName}`);
    const result = await structured.invoke(prompt);

    const issues: RequirementReviewIssue[] = result.issues.map((i) => ({
      severity: i.severity,
      message: i.message,
      ...(i.suggestion ? { suggestion: i.suggestion } : {}),
    }));

    const dimensionResult: RequirementReviewDimensionResult = {
      clarityScore: Math.round(result.clarityScore),
      completenessScore: Math.round(result.completenessScore),
      testabilityScore: Math.round(result.testabilityScore),
      boundariesScore: Math.round(result.boundariesScore),
      overallScore: Math.round(result.overallScore),
      issues,
      improvements: result.improvements,
    };
    return { result: dimensionResult, modelUsed: provider.modelName };
  }

  private async resolveProvider(providerId: string | undefined, projectId: string) {
    let id = providerId;
    if (!id) {
      // Pick the first valid `generation` provider visible to this project.
      const list = await this.providers.list(projectId);
      const gen = list.find((p) => p.kind === "generation" && p.status === "valid");
      if (!gen) {
        throw new BadRequestException(
          "No validated 'generation' model provider configured. Configure one via /model-providers and validate it.",
        );
      }
      id = gen.id;
    }
    const resolved = await this.providers.resolveForOrchestration(id, "generation");
    return resolved;
  }

  private buildPrompt(requirementText: string): string {
    return [
      "You are a senior QA engineer. Generate structured functional test cases from the requirement below.",
      "Return 1-5 high-signal cases covering the happy path and the most important edge cases.",
      "Each case must have a concise title, a priority, ordered steps (each with an action and an expected result).",
      "",
      "Requirement:",
      requirementText.trim().slice(0, 4000),
    ].join("\n");
  }
}
