import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

/**
 * Seed the local admin plus a complete requirement-first demo workspace.
 * Usage: pnpm --filter @crab/api db:seed
 * Credentials come from env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD),
 * defaulting to admin@crab.local / admin12345.
 */
const prisma = new PrismaClient();

async function ensureAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@crab.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`seed: admin ${email} already exists (id=${existing.id})`);
    return existing;
  }

  const user = await prisma.user.create({
    data: {
      email,
      displayName: "Admin",
      passwordHash: await bcrypt.hash(password, 12),
      isAdmin: true,
    },
  });
  console.log(`seed: created admin ${email} (id=${user.id})`);
  return user;
}

async function ensureDemoWorkspace(ownerId: string) {
  const project = await prisma.project.upsert({
    where: { slug: "wharttest-demo-workspace" },
    update: {
      name: "WhartTest Demo Workspace",
      description:
        "Requirement-first demo workspace with approved requirements, generated cases, suite runs, and reports.",
    },
    create: {
      name: "WhartTest Demo Workspace",
      slug: "wharttest-demo-workspace",
      description:
        "Requirement-first demo workspace with approved requirements, generated cases, suite runs, and reports.",
      ownerId,
    },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: ownerId } },
    update: { role: "owner", acceptedAt: new Date() },
    create: {
      projectId: project.id,
      userId: ownerId,
      role: "owner",
      acceptedAt: new Date(),
    },
  });

  const provider =
    (await prisma.modelProvider.findFirst({
      where: { projectId: project.id, name: "Demo generation provider" },
    })) ??
    (await prisma.modelProvider.create({
      data: {
        scope: "project",
        projectId: project.id,
        name: "Demo generation provider",
        kind: "generation",
        baseUrl: "https://example.invalid/v1",
        modelName: "demo-generation-model",
        credentialCiphertext: Buffer.from("demo-provider-ciphertext"),
        credentialKeyId: "local-demo-key",
        status: "unvalidated",
        createdBy: ownerId,
      },
    }));

  const module =
    (await prisma.module.findFirst({
      where: { projectId: project.id, name: "Requirement-first smoke" },
    })) ??
    (await prisma.module.create({
      data: { projectId: project.id, name: "Requirement-first smoke", order: 1 },
    }));

  const requirement =
    (await prisma.requirement.findFirst({
      where: { projectId: project.id, title: "Checkout approval flow" },
    })) ??
    (await prisma.requirement.create({
      data: {
        projectId: project.id,
        title: "Checkout approval flow",
        content:
          "A signed-in shopper can review cart totals, submit payment, and receive a confirmation without losing entered details.",
        status: "approved",
        version: 1,
        createdBy: ownerId,
        reviewedBy: ownerId,
        approvedBy: ownerId,
      },
    }));

  if (requirement.status !== "approved") {
    await prisma.requirement.update({
      where: { id: requirement.id },
      data: { status: "approved", reviewedBy: ownerId, approvedBy: ownerId },
    });
  }

  const requirementVersion =
    (await prisma.requirementVersion.findFirst({
      where: { requirementId: requirement.id, version: requirement.version },
    })) ??
    (await prisma.requirementVersion.create({
      data: {
        requirementId: requirement.id,
        projectId: project.id,
        version: requirement.version,
        title: requirement.title,
        content: requirement.content,
        status: "approved",
        createdBy: ownerId,
        reviewedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: ownerId,
      },
    }));

  for (const event of [
    { action: "capture", fromStatus: null, toStatus: "draft" },
    { action: "review", fromStatus: "draft", toStatus: "reviewed" },
    { action: "approve", fromStatus: "reviewed", toStatus: "approved" },
  ]) {
    const existingEvent = await prisma.requirementReviewEvent.findFirst({
      where: { requirementId: requirement.id, action: event.action },
    });
    if (!existingEvent) {
      await prisma.requirementReviewEvent.create({
        data: {
          requirementId: requirement.id,
          projectId: project.id,
          actorId: ownerId,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          action: event.action,
        },
      });
    }
  }

  const draftCases = [
    {
      title: "Checkout completes with approved payment",
      priority: "high",
      preconditions: "Shopper is signed in and has items in the cart.",
      steps: [
        { order: 1, action: "Open the cart", expectedResult: "Cart totals are visible" },
        { order: 2, action: "Submit valid payment", expectedResult: "Order is confirmed" },
      ],
      expectedResults: "Confirmation includes an order reference.",
    },
    {
      title: "Checkout keeps cart data after payment retry",
      priority: "medium",
      preconditions: "Payment provider returns a retryable decline.",
      steps: [
        { order: 1, action: "Submit a declined card", expectedResult: "Retry message is shown" },
        { order: 2, action: "Return to checkout", expectedResult: "Cart and contact details remain" },
      ],
      expectedResults: "Shopper can retry without re-entering the cart.",
    },
  ];

  const aiRun =
    (await prisma.aiWorkflowRun.findFirst({
      where: {
        projectId: project.id,
        kind: "test-generation",
        requirementVersionId: requirementVersion.id,
      },
    })) ??
    (await prisma.aiWorkflowRun.create({
      data: {
        projectId: project.id,
        kind: "test-generation",
        status: "accepted",
        providerId: provider.id,
        requirementVersionId: requirementVersion.id,
        createdBy: ownerId,
        finishedAt: new Date(),
        draftCases,
        inputs: {
          create: {
            kind: "managed-requirement",
            contentRef: requirementVersion.id,
            checksum: "demo-requirement-checksum",
          },
        },
        stages: {
          create: [
            { stage: "planning", sequence: 1, status: "success" },
            { stage: "test-generation", sequence: 2, status: "success" },
            { stage: "persistence", sequence: 3, status: "success" },
          ],
        },
      },
    }));

  const generatedCase = await ensureTestCase({
    projectId: project.id,
    moduleId: module.id,
    title: "Checkout completes with approved payment",
    origin: "ai_generated",
    priority: "high",
    status: "active",
    createdBy: ownerId,
    aiRunId: aiRun.id,
    requirementVersionId: requirementVersion.id,
    preconditions: "Shopper is signed in and has items in the cart.",
    steps: [
      { order: 1, action: "Open the cart", expectedResult: "Cart totals are visible" },
      { order: 2, action: "Submit valid payment", expectedResult: "Order is confirmed" },
    ],
  });

  const regressionCase = await ensureTestCase({
    projectId: project.id,
    moduleId: module.id,
    title: "Checkout keeps cart data after payment retry",
    origin: "ai_generated",
    priority: "medium",
    status: "active",
    createdBy: ownerId,
    aiRunId: aiRun.id,
    requirementVersionId: requirementVersion.id,
    preconditions: "Payment provider returns a retryable decline.",
    steps: [
      { order: 1, action: "Submit a declined card", expectedResult: "Retry message is shown" },
      { order: 2, action: "Return to checkout", expectedResult: "Cart and contact details remain" },
    ],
  });

  const suite =
    (await prisma.testSuite.findFirst({
      where: { projectId: project.id, name: "Checkout regression suite" },
    })) ??
    (await prisma.testSuite.create({
      data: {
        projectId: project.id,
        name: "Checkout regression suite",
        description: "Demo suite proving the approved requirement through generated cases.",
        createdBy: ownerId,
      },
    }));

  await prisma.testSuiteCase.createMany({
    data: [
      { suiteId: suite.id, testCaseId: generatedCase.id, order: 1 },
      { suiteId: suite.id, testCaseId: regressionCase.id, order: 2 },
    ],
    skipDuplicates: true,
  });

  const execution =
    (await prisma.testExecution.findFirst({
      where: { projectId: project.id, testCaseId: generatedCase.id, workerJobId: "demo-report-job" },
    })) ??
    (await prisma.testExecution.create({
      data: {
        projectId: project.id,
        testCaseId: generatedCase.id,
        createdBy: ownerId,
        environment: "local-demo",
        status: "passed",
        finishedAt: new Date(),
        durationMs: 1840,
        workerJobId: "demo-report-job",
        reportSummary: {
          passed: 1,
          failed: 0,
          artifacts: 1,
          note: "Demo report entry for requirement-first workspace acceptance.",
        },
      },
    }));

  const report = await prisma.executionArtifact.findFirst({
    where: { executionId: execution.id, type: "report" },
  });
  if (!report) {
    await prisma.executionArtifact.create({
      data: {
        executionId: execution.id,
        type: "report",
        storageRef: `demo-reports/${execution.id}.json`,
        filename: "checkout-regression-report.json",
        sizeBytes: BigInt(512),
        checksum: "demo-report-checksum",
        metadata: { suiteName: suite.name, result: "passed" },
      },
    });
  }

  const suiteRun = await prisma.suiteRun.findFirst({
    where: { projectId: project.id, suiteId: suite.id, environment: "local-demo" },
  });
  if (!suiteRun) {
    await prisma.suiteRun.create({
      data: {
        projectId: project.id,
        suiteId: suite.id,
        environment: "local-demo",
        status: "passed",
        executionIds: [execution.id],
        finishedAt: new Date(),
        durationMs: 1840,
        createdBy: ownerId,
      },
    });
  }

  console.log(`seed: ensured demo workspace ${project.name} (id=${project.id})`);
}

async function ensureTestCase(input: {
  projectId: string;
  moduleId: string;
  title: string;
  origin: "manual" | "ai_generated";
  priority: "low" | "medium" | "high" | "critical";
  status: "draft" | "active" | "deprecated" | "archived";
  createdBy: string;
  aiRunId?: string;
  requirementVersionId?: string;
  preconditions?: string;
  steps: { order: number; action: string; expectedResult: string }[];
}) {
  const existing = await prisma.testCase.findFirst({
    where: { projectId: input.projectId, title: input.title },
    include: { steps: true },
  });
  if (existing) return existing;

  return prisma.testCase.create({
    data: {
      projectId: input.projectId,
      moduleId: input.moduleId,
      title: input.title,
      origin: input.origin,
      priority: input.priority,
      status: input.status,
      createdBy: input.createdBy,
      aiRunId: input.aiRunId,
      requirementVersionId: input.requirementVersionId,
      preconditions: input.preconditions,
      tags: ["demo", "requirement-first"],
      steps: { create: input.steps },
    },
    include: { steps: true },
  });
}

async function main() {
  const user = await ensureAdmin();
  await ensureDemoWorkspace(user.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
