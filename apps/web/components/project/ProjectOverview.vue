<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Globe,
  ListChecks,
  PackageCheck,
  Play,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-vue-next";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import EmptyState from "./EmptyState.vue";
import { useProjectOverview } from "~/composables/useProjectOverview";
import type {
  ProjectDto,
  ProjectWorkspaceModuleKey,
  ProjectWorkspaceModuleSummaryDto,
  ProjectWorkspaceSummaryDto,
} from "@crab/shared-types";

const props = defineProps<{
  project: ProjectDto | null;
  projectId: string;
}>();

const { counts, summary, loading, error, refresh } = useProjectOverview(toRef(props, "projectId"));
const moduleQuery = ref("");

type CountKey = keyof ProjectWorkspaceSummaryDto["counts"];
interface MetricDef {
  key: CountKey;
  testId: string;
  label: string;
  detail: string;
  to: string;
  icon: LucideIcon;
}

const acceptanceRoute = [
  "Requirement intake",
  "Requirement review",
  "Requirement approval",
  "AI case generation",
  "Case management",
  "Suite execution",
  "Execution report",
];

const headlineMetrics = computed<MetricDef[]>(() => [
  {
    key: "requirements",
    testId: "stat-requirements",
    label: "Requirements",
    detail: `${counts.value.approvedRequirements} approved for generation`,
    to: `/projects/${props.projectId}/requirements`,
    icon: ClipboardCheck,
  },
  {
    key: "testCases",
    testId: "stat-test-cases",
    label: "Test Cases",
    detail: `${counts.value.aiGeneratedCases} AI-generated cases linked`,
    to: `/projects/${props.projectId}/test-cases`,
    icon: ListChecks,
  },
  {
    key: "executions",
    testId: "stat-executions",
    label: "Executions",
    detail: `${counts.value.queuedExecutions} queued / ${counts.value.failedExecutions} failed`,
    to: `/projects/${props.projectId}/executions`,
    icon: Play,
  },
  {
    key: "apiCases",
    testId: "stat-api-cases",
    label: "API Cases",
    detail: `${counts.value.apiExecutions} API run records`,
    to: `/projects/${props.projectId}/api-automation`,
    icon: Globe,
  },
  {
    key: "knowledgeBases",
    testId: "stat-knowledge-bases",
    label: "Knowledge Bases",
    detail: `${counts.value.knowledgeDocuments} source documents`,
    to: `/projects/${props.projectId}/knowledge`,
    icon: BookOpen,
  },
]);

const fallbackModules = computed<ProjectWorkspaceModuleSummaryDto[]>(() => [
  {
    key: "requirements",
    label: "Requirements",
    count: counts.value.requirements,
    complete: counts.value.approvedRequirements > 0,
    nextAction: counts.value.requirements
      ? "Review and approve the next requirement"
      : "Capture first requirement",
    gap: counts.value.approvedRequirements
      ? "Approved requirement ready for generation"
      : "No approved requirement yet",
    to: `/projects/${props.projectId}/requirements`,
  },
  {
    key: "ai-generation",
    label: "AI case generation",
    count: counts.value.aiRuns,
    complete: counts.value.aiRuns > 0,
    nextAction: counts.value.approvedRequirements
      ? "Generate cases from an approved requirement"
      : "Approve a requirement before generation",
    gap: counts.value.aiRuns ? "Generation history exists" : "No generation run yet",
    to: `/projects/${props.projectId}/ai-generation`,
  },
  {
    key: "test-cases",
    label: "Case management",
    count: counts.value.testCases,
    complete: counts.value.testCases > 0,
    nextAction: counts.value.testCases
      ? "Review case coverage and ownership"
      : "Accept generated cases or add one manually",
    gap: counts.value.aiGeneratedCases
      ? "Generated cases are linked"
      : "No AI-generated case linked yet",
    to: `/projects/${props.projectId}/test-cases`,
  },
  {
    key: "test-suites",
    label: "Suite execution",
    count: counts.value.testSuites,
    complete: counts.value.testSuites > 0,
    nextAction: counts.value.testSuites
      ? "Run the next regression suite"
      : "Create a suite from approved cases",
    gap: counts.value.testSuites ? "Suite is available" : "No suite assembled yet",
    to: `/projects/${props.projectId}/test-suites`,
  },
  {
    key: "executions",
    label: "Execution queue",
    count: counts.value.executions,
    complete: counts.value.executions > 0,
    nextAction: counts.value.queuedExecutions
      ? "Watch queued executions"
      : "Start a run from a case or suite",
    gap: counts.value.failedExecutions
      ? `${counts.value.failedExecutions} failed execution needs triage`
      : "No failed executions",
    to: `/projects/${props.projectId}/executions`,
  },
  {
    key: "api-automation",
    label: "API automation",
    count: counts.value.apiCases,
    complete: counts.value.apiCases > 0,
    nextAction: counts.value.apiCases
      ? "Review assertions and environments"
      : "Add API checks after the core flow is stable",
    gap: counts.value.apiExecutions
      ? "API execution evidence exists"
      : "No API execution evidence yet",
    to: `/projects/${props.projectId}/api-automation`,
  },
  {
    key: "reports",
    label: "Execution report",
    count: counts.value.reportArtifacts,
    complete: counts.value.reportArtifacts > 0,
    nextAction: counts.value.reportArtifacts
      ? "Open the latest report artifact"
      : "Run a suite to publish a report",
    gap: counts.value.reportArtifacts ? "Report artifact available" : "No report artifact yet",
    to: `/projects/${props.projectId}/executions`,
  },
]);

const modules = computed(() =>
  summary.value?.modules?.length ? summary.value.modules : fallbackModules.value,
);
const filteredModules = computed(() => {
  const term = moduleQuery.value.trim().toLowerCase();
  if (!term) return modules.value;
  return modules.value.filter((module) =>
    `${module.label} ${module.nextAction} ${module.gap}`.toLowerCase().includes(term),
  );
});
const recentActivity = computed(() => summary.value?.recentActivity ?? []);
const primaryNextAction = computed(
  () => modules.value.find((module) => !module.complete)?.nextAction ?? "Review latest execution report",
);
const allEmpty = computed(() => Object.values(counts.value).every((value) => value === 0));

function moduleIcon(key: ProjectWorkspaceModuleKey): LucideIcon {
  const icons: Record<ProjectWorkspaceModuleKey, LucideIcon> = {
    requirements: ClipboardCheck,
    "ai-generation": Sparkles,
    "test-cases": ListChecks,
    "test-suites": PackageCheck,
    executions: Play,
    "api-automation": Globe,
    reports: FileText,
  };
  return icons[key];
}

function formatTime(value?: string) {
  if (!value) return "Next";
  return new Date(value).toLocaleString();
}
</script>

<template>
  <div class="space-y-6">
    <EmptyState
      v-if="project === null"
      title="Project not found or you lack access"
      description="The project may have been deleted, or your account does not have access to it."
    />

    <template v-else>
      <Card class="overflow-hidden border-slate-200 bg-white shadow-sm">
        <div class="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-primary">Requirement-first workspace</p>
            <h2 class="mt-1 text-2xl font-bold">Start with approved requirements, then generate and run.</h2>
            <p class="mt-2 max-w-3xl text-sm text-muted-foreground">
              {{ project?.name }} is organized as a testing workbench: capture demand, review intent,
              approve scope, generate cases, manage coverage, run suites, and publish execution evidence.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <Button as-child>
                <NuxtLink :to="`/projects/${projectId}/requirements`">Capture first requirement</NuxtLink>
              </Button>
              <Button as-child variant="outline">
                <NuxtLink :to="`/projects/${projectId}/requirements`">Review requirements</NuxtLink>
              </Button>
            </div>
          </div>
          <div class="rounded-lg border bg-muted/30 p-3 text-sm">
            <div class="font-medium">Next best action</div>
            <p class="mt-1 text-muted-foreground">{{ primaryNextAction }}</p>
            <div class="mt-3 border-t pt-3">
              <div class="font-medium">Summary freshness</div>
              <div class="mt-1 text-muted-foreground" data-testid="workspace-summary-freshness">
                <span v-if="loading">Refreshing workspace counts...</span>
                <span v-else-if="summary">Generated {{ new Date(summary.generatedAt).toLocaleString() }}</span>
                <span v-else>Waiting for workspace data</span>
              </div>
              <Button class="mt-3" variant="outline" size="sm" :disabled="loading" @click="refresh">
                Refresh summary
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card class="p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 class="font-semibold">Requirement-first acceptance route</h3>
            <p class="text-sm text-muted-foreground">
              The first screen tells testers how to move from requirement intent to report evidence.
            </p>
          </div>
          <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Requirements first</span>
        </div>
        <div class="grid gap-2 md:grid-cols-7">
          <div
            v-for="(step, index) in acceptanceRoute"
            :key="step"
            class="motion-card rounded-lg border bg-muted/20 p-3 text-sm"
          >
            <div class="text-xs font-semibold text-muted-foreground">Step {{ index + 1 }}</div>
            <div class="mt-1 font-medium">{{ step }}</div>
          </div>
        </div>
      </Card>

      <Card
        v-if="error"
        class="border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900"
        data-testid="workspace-summary-error"
      >
        <div class="flex gap-2">
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div class="font-medium">Workspace summary unavailable</div>
            <div class="mt-1">Refresh the summary before trusting overview counts. {{ error.message }}</div>
          </div>
        </div>
      </Card>

      <Card v-if="loading && !summary" class="p-4 text-sm text-muted-foreground">
        Loading requirement, case, suite, execution, and report counts...
      </Card>

      <Card v-if="!loading && !error && allEmpty" class="border-dashed p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-primary">No workspace evidence yet</p>
            <h3 class="mt-1 font-semibold">Capture the first requirement to start the testing loop.</h3>
            <p class="mt-2 text-sm text-muted-foreground">
              Empty projects should not strand testers. The next step is requirement intake, then review,
              approval, AI case generation, case management, suite execution, and report evidence.
            </p>
          </div>
          <Button as-child>
            <NuxtLink :to="`/projects/${projectId}/requirements`">Capture first requirement</NuxtLink>
          </Button>
        </div>
      </Card>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <NuxtLink
          v-for="metric in headlineMetrics"
          :key="metric.key"
          :to="metric.to"
          :data-testid="metric.testId"
          class="block"
        >
          <Card class="motion-card flex h-full items-center gap-4 p-4 hover:border-primary/30 hover:bg-muted/30">
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <component :is="metric.icon" class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <div class="text-2xl font-semibold tabular-nums">
                <span v-if="loading">...</span>
                <span v-else>{{ counts[metric.key] }}</span>
              </div>
              <div class="text-sm font-medium">{{ metric.label }}</div>
              <div class="truncate text-xs text-muted-foreground">{{ metric.detail }}</div>
            </div>
          </Card>
        </NuxtLink>
      </section>

      <section>
        <div class="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 class="font-semibold">Module readiness</h3>
            <p class="text-sm text-muted-foreground">Completion, next action, and current gap by product module.</p>
          </div>
          <Input v-model="moduleQuery" class="lg:w-80" placeholder="Filter modules by action or gap" />
        </div>
        <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <NuxtLink v-for="module in filteredModules" :key="module.key" :to="module.to" class="block">
            <Card class="motion-card h-full p-4 hover:border-primary/30 hover:bg-muted/30">
              <div class="flex items-start gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <component :is="moduleIcon(module.key)" class="h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <h4 class="font-semibold">{{ module.label }}</h4>
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="module.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'"
                    >
                      {{ module.complete ? "Ready" : "Gap" }}
                    </span>
                  </div>
                  <div class="mt-1 text-2xl font-semibold tabular-nums">{{ module.count }}</div>
                  <p class="mt-2 text-sm text-muted-foreground">{{ module.nextAction }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">Gap: {{ module.gap }}</p>
                </div>
              </div>
            </Card>
          </NuxtLink>
        </div>
        <Card v-if="!filteredModules.length" class="mt-3 border-dashed p-4 text-sm text-muted-foreground">
          No modules match this filter. Clear the filter to continue the requirement-first route.
        </Card>
      </section>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card class="p-5">
          <div class="flex items-start gap-3">
            <Sparkles class="mt-1 h-5 w-5 text-primary" />
            <div>
              <h3 class="font-semibold">Suggested next actions</h3>
              <p class="mt-1 text-sm text-muted-foreground">
                Keep the workspace moving by approving requirements before generating or running cases.
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <Button as-child>
                  <NuxtLink :to="`/projects/${projectId}/requirements`">Manage requirements</NuxtLink>
                </Button>
                <Button as-child variant="outline">
                  <NuxtLink :to="`/projects/${projectId}/ai-generation`">Generate cases</NuxtLink>
                </Button>
                <Button as-child variant="outline">
                  <NuxtLink :to="`/projects/${projectId}/test-suites`">Build suites</NuxtLink>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card class="p-5">
          <div class="flex items-start gap-3">
            <Wrench class="mt-1 h-5 w-5 text-primary" />
            <div class="min-w-0">
              <h3 class="font-semibold">Recent activity</h3>
              <div class="mt-3 space-y-3">
                <NuxtLink
                  v-for="item in recentActivity"
                  :key="`${item.label}-${item.at ?? item.to}`"
                  :to="item.to"
                  class="block rounded-md border bg-muted/20 p-3 text-sm hover:bg-muted/40"
                >
                  <div class="flex items-center gap-2 font-medium">
                    <CheckCircle2 class="h-4 w-4 text-emerald-600" />
                    <span>{{ item.label }}</span>
                  </div>
                  <div class="mt-1 text-muted-foreground">{{ item.detail }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ formatTime(item.at) }}</div>
                </NuxtLink>
                <div v-if="!recentActivity.length" class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No recent activity yet. Capture a requirement to create the first audit trail.
                </div>
              </div>
              <NuxtLink :to="`/projects/${projectId}/mcp-admin`" class="mt-4 inline-block text-sm font-medium text-primary">
                Review tool approvals ->
              </NuxtLink>
            </div>
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>
