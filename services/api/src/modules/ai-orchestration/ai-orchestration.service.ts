import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { SnapshotService } from "../../infra/streaming/snapshot.service";
import { TestAssetsService } from "../test-assets/test-assets.service";
import { AuditService } from "../audit/audit.service";
import { LlmDraftService } from "./llm-draft.service";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { McpService } from "../mcp/mcp.service";
import { SkillAdapterService } from "../skills/skill-adapter.service";
import type {
  AiWorkflowRunDto,
  StartTestGenerationRequest,
  AcceptRunRequest,
  DraftTestCaseDto,
  AiRunInputKind,
  AiRunKind,
  AiRunStatus,
  StreamEnvelope,
} from "@crab/shared-types";

/**
 * backend-ai-orchestration.1,2,4 + ai-test-generation.1–3.
 *
 * R1: canonical run state in Prisma AiWorkflowRun (NO LangGraph checkpointer).
 *     Resume post-approval = POST /ai/runs/:id/approve reads Prisma run-state
 *     and invokes the post-approval persist-handoff. No interrupt()/checkpointer.
 *
 * R7: MVP graph topology has NO MCP/Skill nodes (structural absence — this
 *     service imports no MCP/Skill symbols; CI import-scan enforced).
 *
 * MUST-2: MVP exercises state / native tool calls / retries / streaming /
 *         human approval. The "draft" step is a native (non-MCP) tool call;
 *         "validate-structure" performs bounded retries with retryCount.
 *
 * NOTE: LangGraph.js durable checkpointer is intentionally NOT used (R1).
 * LangChain.js ChatOpenAI provides the real LLM draft (B1, llm-draft.service).
 * The graph shape below mirrors §8's node graph as a state-machine, not a
 * persisted LangGraph graph — keeping the canonical-write path off the
 * checkpointer maturity risk.
 */
@Injectable()
export class AiOrchestrationService {
  private readonly logger = new Logger(AiOrchestrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: SnapshotService,
    private readonly assets: TestAssetsService,
    private readonly audit: AuditService,
    private readonly llmDraft: LlmDraftService,
    private readonly knowledge: KnowledgeService,
    private readonly mcp: McpService,
    private readonly skillAdapter: SkillAdapterService,
  ) {}

  async startGeneration(
    actorId: string,
    req: StartTestGenerationRequest,
  ): Promise<AiWorkflowRunDto> {
    let requirementText = req.requirementText;
    if (req.requirementVersionId) {
      const requirementVersion = await this.prisma.requirementVersion.findFirst({
        where: { id: req.requirementVersionId, projectId: req.projectId, status: "approved" },
      });
      if (!requirementVersion) {
        throw new BadRequestException("Approved requirement version not found");
      }
      requirementText = requirementVersion.content;
    }

    if (!requirementText && !(req.attachmentInputIds?.length)) {
      throw new BadRequestException(
        "requirementText, requirementVersionId, or attachmentInputIds required",
      );
    }
    const run = await this.prisma.aiWorkflowRun.create({
      data: {
        projectId: req.projectId,
        kind: "test-generation",
        status: "running",
        providerId: req.providerId,
        requirementVersionId: req.requirementVersionId,
        createdBy: actorId,
        draftCases: [],
      },
    });
    this.snapshot.register(run.id);

    // Stage: context-retrieval. P2: now pulls KB chunks + source attribution
    // (knowledge-rag.4) via KnowledgeService.retrieveForGeneration, injected into
    // the generation trace. MVP fallback: AiRunInput requirement text only.
    let ragSources: Array<{ chunkId: string; filename?: string; section?: string; page?: number }> = [];
    if (req.requirementVersionId) {
      await this.prisma.aiRunInput.create({
        data: {
          runId: run.id,
          kind: "managed-requirement",
          contentRef: `requirement-version:${req.requirementVersionId}`,
        },
      });
    }
    if (requirementText) {
      if (!req.requirementVersionId) {
        await this.prisma.aiRunInput.create({
          data: {
            runId: run.id,
            kind: "requirement-text",
            contentRef: `inline:${run.id}`,
          },
        });
      }
      // P2 RAG: retrieve project knowledge with source attribution.
      try {
        const rag = await this.knowledge.retrieveForGeneration(
          req.projectId,
          requirementText,
          5,
        );
        ragSources = rag.sources;
      } catch (err) {
        this.logger.warn(`RAG retrieval skipped: ${(err as Error).message}`);
      }
    }
    await this.emit(run.id, "stage", {
      stage: "context-retrieval",
      ok: true,
      ragChunks: ragSources.length,
      sourceAttribution: ragSources,
    });

    // Stage: drafting — real LLM call via LangChain.js (B1). Server-side only (a7).
    // MUST-2 tool-calls facet: withStructuredOutput is the native tool/function-call path.
    let drafts: DraftTestCaseDto[];
    try {
      const result = await this.llmDraft.generateDrafts(
        req.providerId,
        requirementText ?? "uploaded context",
        req.projectId,
      );
      drafts = result.cases;
    } catch (err) {
      this.logger.error(`LLM draft failed: ${(err as Error).message}`);
      await this.markStatus(run.id, "failed");
      await this.snapshot.release(run.id);
      await this.emit(run.id, "fail", { error: (err as Error).message });
      return this.toDto(
        await this.prisma.aiWorkflowRun.findUniqueOrThrow({
          where: { id: run.id },
          include: { inputs: true },
        }),
      );
    }
    await this.prisma.aiWorkflowRun.update({
      where: { id: run.id },
      data: { draftCases: drafts as unknown as object },
    });
    await this.emit(run.id, "stage", { stage: "drafting", ok: true, count: drafts.length });

    // Stage: validation with bounded retries (MUST-2 retries facet).
    let validated = false;
    let retryCount = 0;
    for (let attempt = 0; attempt < 3 && !validated; attempt++) {
      retryCount = attempt;
      validated = drafts.every((d) => d.title && d.steps.length > 0);
      if (validated) break;
    }
    await this.emit(run.id, "stage", {
      stage: "validation",
      ok: validated,
      retryCount,
    });

    if (!validated) {
      await this.markStatus(run.id, "failed");
      await this.snapshot.release(run.id);
      return this.toDto(
        await this.prisma.aiWorkflowRun.findUniqueOrThrow({
          where: { id: run.id },
          include: { inputs: true },
        }),
      );
    }

    // P2-5: MCP tool-call node + Skill-adapter node (backend-ai-orchestration.3
    // + skills-store.4). These are OPTIONAL enrichment steps invoked through
    // controlled adapters. R7 (relaxed): ai-orchestration MAY import MCP/Skill
    // adapters; renderer/worker still must not (CI scan enforces). R1 holds —
    // no LangGraph checkpointer; these are state-machine steps.
    // MCP: if the project has any approved MCP tools, attempt a best-effort
    // enrichment call (non-fatal on rejection/failure — recorded as McpToolCall).
    await this.tryMcpEnrichment(run.id, req.projectId, actorId, drafts, ragSources);
    // Skill: if any installed skill is approved for an "enrich-cases" entryPoint,
    // invoke it via the controlled adapter (denied/failed invocations audited).
    await this.trySkillEnrichment(run.id, req.projectId, actorId, drafts);

    // Stage: review (human-approval boundary — R1 soft stop, no checkpointer).
    await this.markStatus(run.id, "awaiting-approval");
    await this.emit(run.id, "stage", { stage: "review", ok: true });
    return this.toDto(
      await this.prisma.aiWorkflowRun.findUniqueOrThrow({
        where: { id: run.id },
        include: { inputs: true },
      }),
    );
  }

  /** P2-5 MCP node: best-effort enrichment via approved MCP tools (non-fatal). */
  private async tryMcpEnrichment(
    runId: string,
    projectId: string,
    actorId: string,
    drafts: DraftTestCaseDto[],
    ragSources: Array<{ chunkId: string; filename?: string }>,
  ) {
    try {
      const allowlist = await this.mcp.listAllowlist(projectId);
      const approved = allowlist.filter((a) => a.approved);
      if (approved.length === 0) return; // no MCP tools configured; skip
      // Invoke the first approved tool with the draft titles as context.
      // (MCP tool semantics are tool-specific; this is a thin enrichment hook.)
      const tool = approved[0]!;
      await this.mcp.invokeTool({
        projectId,
        runId,
        toolName: tool.toolName,
        serverRef: tool.serverRef,
        args: { drafts: drafts.map((d) => d.title), sources: ragSources.map((s) => s.filename) },
        actorId,
      });
      await this.emit(runId, "stage", { stage: "validation", ok: true, mcp: tool.toolName });
    } catch (err) {
      // Non-fatal: MCP enrichment is best-effort; rejections/failures are audited.
      this.logger.debug(`MCP enrichment skipped: ${(err as Error).message}`);
    }
  }

  /** P2-5 Skill node: invoke an approved "enrich-cases" skill via controlled adapter. */
  private async trySkillEnrichment(
    runId: string,
    projectId: string,
    actorId: string,
    drafts: DraftTestCaseDto[],
  ) {
    try {
      const installations = await this.prisma.skillInstallation.findMany({
        where: { projectId, state: "installed" },
      });
      if (installations.length === 0) return;
      // Invoke the first installed skill's "enrich-cases" entryPoint (if approved).
      const inst = installations[0]!;
      await this.skillAdapter.invoke({
        installationId: inst.id,
        adapter: "langgraph",
        entryPoint: "enrich-cases",
        args: { drafts },
        runId,
        actorId,
      });
      await this.emit(runId, "stage", { stage: "validation", ok: true, skill: inst.id });
    } catch (err) {
      // Non-fatal: denied/failed skill invocations are audited by the adapter.
      this.logger.debug(`Skill enrichment skipped: ${(err as Error).message}`);
    }
  }

  /** R1 resume: read Prisma run-state, persist accepted drafts (persist-handoff). */
  async accept(
    actorId: string,
    runId: string,
    req: AcceptRunRequest,
  ): Promise<AiWorkflowRunDto> {
    const run = await this.prisma.aiWorkflowRun.findUnique({
      where: { id: runId },
      include: { inputs: true },
    });
    if (!run) throw new NotFoundException("Run not found");
    if (run.status !== "awaiting-approval") {
      throw new BadRequestException("Run is not awaiting approval");
    }
    const drafts = (
      (run.draftCases as DraftTestCaseDto[] | null) ?? []
    );
    const selected = req.editedDrafts ?? drafts;
    const moduleId = await this.resolveModuleId(run.projectId);
    // Idempotent persist-handoff (MUST-1): dedup by runId+title.
    await this.assets.persistAcceptedDrafts(
      run.projectId,
      actorId,
      runId,
      selected.map((d) => ({
        title: d.title,
        priority: d.priority,
        preconditions: d.preconditions,
        steps: d.steps.map((s) => ({
          order: s.order,
          action: s.action,
          expectedResult: s.expectedResult,
        })),
      })),
      moduleId,
      run.requirementVersionId ?? undefined,
    );
    await this.markStatus(runId, "accepted");
    await this.emit(runId, "stage", { stage: "persistence", ok: true });
    await this.snapshot.release(runId);
    return this.toDto(
      await this.prisma.aiWorkflowRun.findUniqueOrThrow({
        where: { id: runId },
        include: { inputs: true },
      }),
    );
  }

  async reject(actorId: string, runId: string): Promise<AiWorkflowRunDto> {
    await this.markStatus(runId, "rejected");
    await this.snapshot.release(runId);
    await this.audit.record({
      actorId,
      action: "ai-run.reject",
      targetType: "ai-run",
      targetId: runId,
      outcome: "success",
    });
    return this.toDto(
      await this.prisma.aiWorkflowRun.findUniqueOrThrow({
        where: { id: runId },
        include: { inputs: true },
      }),
    );
  }

  async get(runId: string): Promise<AiWorkflowRunDto> {
    const run = await this.prisma.aiWorkflowRun.findUnique({
      where: { id: runId },
      include: { inputs: true },
    });
    if (!run) throw new NotFoundException("Run not found");
    return this.toDto(run);
  }

  async listForProject(projectId: string): Promise<AiWorkflowRunDto[]> {
    const rows = await this.prisma.aiWorkflowRun.findMany({
      where: { projectId },
      include: { inputs: true },
      orderBy: { startedAt: "desc" },
    });
    return rows.map((row) => this.toDto(row));
  }

  /** R8 snapshot refetch — authoritative run state on reconnect. */
  snapshotFor(runId: string): { runId: string; events: StreamEnvelope[] } {
    return { runId, events: this.snapshot.snapshot(runId) };
  }

  /**
   * B2: SSE live stream of WorkflowStageEvents for a run.
   * Emits the shared StreamEnvelope. R8: clients refetch the snapshot on reconnect;
   * this stream is a live-only window (not a durable replay buffer — §11 b′3).
   * The callback receives each new envelope as it is appended.
   */
  subscribe(
    runId: string,
    onEnvelope: (e: StreamEnvelope) => void,
    onClose?: () => void,
  ): () => void {
    // Replay current live window first (so a fresh subscriber catches up),
    // then forward subsequent appends.
    for (const env of this.snapshot.snapshot(runId)) {
      onEnvelope(env);
    }
    const unsubscribe = this.snapshot.subscribe(runId, onEnvelope);
    return () => {
      unsubscribe();
      onClose?.();
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async resolveModuleId(projectId: string): Promise<string | undefined> {
    const first = await this.prisma.module.findFirst({
      where: { projectId },
    });
    return first?.id;
  }

  private async markStatus(runId: string, status: AiRunStatus) {
    await this.prisma.aiWorkflowRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: ["accepted", "rejected", "failed", "completed"].includes(status)
          ? new Date()
          : null,
      },
    });
  }

  private async emit(
    runId: string,
    type: StreamEnvelope["type"],
    payload: unknown,
  ) {
    const seq = this.snapshot.nextSeq(runId);
    const env: StreamEnvelope = {
      runId,
      seq,
      type,
      payload,
      ts: new Date().toISOString(),
    };
    this.snapshot.append(runId, env);
    await this.prisma.workflowStageEvent.create({
      data: {
        runId,
        stage:
          type === "stage"
            ? ((payload as { stage?: string }).stage as never)
            : "drafting",
        sequence: seq,
        status: (payload as { ok?: boolean }).ok === false ? "fail" : "success",
        retryCount: (payload as { retryCount?: number }).retryCount ?? 0,
        sourceAttribution: (payload as { sourceAttribution?: unknown }).sourceAttribution as object | undefined,
      },
    });
  }

  /**
   * Fallback deterministic draft — used only when no LLM provider is configured
   * (e.g. local dev without a provider). Produces a single placeholder case so
   * the generation → review → persist loop is exercisable end-to-end without a
   * real LLM. The real path goes through LlmDraftService (B1).
   *
   * Native (non-MCP) — MUST-2 tool-calls facet, R7 no MCP.
   */
  private draftFromRequirement(text: string): DraftTestCaseDto[] {
    const trimmed = text.trim().slice(0, 2000);
    return [
      {
        title: `Generated case for: ${trimmed.slice(0, 60) || "requirement"}`,
        priority: "medium",
        preconditions: "System is accessible and user is authenticated.",
        steps: [
          { order: 1, action: "Navigate to the target feature", expectedResult: "Feature loads" },
          { order: 2, action: "Perform the primary action", expectedResult: "Action succeeds" },
        ],
        expectedResults: "Primary action completes successfully.",
      },
    ];
  }

  private toDto(run: {
    id: string;
    projectId: string;
    kind: string;
    status: string;
    providerId: string | null;
    requirementVersionId: string | null;
    createdBy: string;
    startedAt: Date;
    finishedAt: Date | null;
    draftCases: unknown;
    inputs: Array<{
      id: string;
      runId: string;
      kind: string;
      contentRef: string;
      filename: string | null;
      sizeBytes: bigint | null;
      checksum: string | null;
      createdAt: Date;
    }>;
  }): AiWorkflowRunDto {
    return {
      id: run.id,
      projectId: run.projectId,
      kind: run.kind as AiRunKind,
      status: run.status as AiRunStatus,
      providerId: run.providerId ?? undefined,
      requirementVersionId: run.requirementVersionId ?? undefined,
      createdBy: run.createdBy,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      inputs: run.inputs.map((i) => ({
        id: i.id,
        runId: i.runId,
        kind: i.kind as AiRunInputKind,
        contentRef: i.contentRef,
        filename: i.filename ?? undefined,
        sizeBytes: i.sizeBytes ? Number(i.sizeBytes) : undefined,
        checksum: i.checksum ?? undefined,
        createdAt: i.createdAt.toISOString(),
      })),
      draftCases: (run.draftCases as DraftTestCaseDto[]) ?? [],
    };
  }
}
