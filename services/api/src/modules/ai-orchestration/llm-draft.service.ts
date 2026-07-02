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
import type { DraftTestCaseDto } from "@crab/shared-types";

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

export interface DraftGenerationResult {
  cases: DraftTestCaseDto[];
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
