<script setup lang="ts">
import { computed, toRef } from "vue";
import {
  BookOpen,
  BotMessageSquare,
  ClipboardCheck,
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
import EmptyState from "./EmptyState.vue";
import { useProjectOverview } from "~/composables/useProjectOverview";
import type { ProjectDto, ProjectWorkspaceSummaryDto } from "@crab/shared-types";

const props = defineProps<{
  project: ProjectDto | null;
  projectId: string;
}>();

const { counts, summary, loading, error, refresh } = useProjectOverview(toRef(props, "projectId"));

type CountKey = keyof ProjectWorkspaceSummaryDto["counts"];
interface MetricDef {
  key: CountKey;
  testId: string;
  label: string;
  detail: string;
  to: string;
  icon: LucideIcon;
}

interface WorkflowDef {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  metrics: Array<{ label: string; key: CountKey }>;
}

const headlineMetrics = computed<MetricDef[]>(() => [
  {
    key: "testCases",
    testId: "stat-test-cases",
    label: "Test Cases",
    detail: `${counts.value.testSuites} suites ready for ordered runs`,
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

const workflowGroups = computed<WorkflowDef[]>(() => [
  {
    title: "Plan & author",
    description: "Manage requirements, cases, suites, and AI-assisted draft generation.",
    to: `/projects/${props.projectId}/requirements`,
    icon: ClipboardCheck,
    metrics: [
      { label: "requirements", key: "requirements" },
      { label: "approved", key: "approvedRequirements" },
      { label: "suites", key: "testSuites" },
    ],
  },
  {
    title: "Run & report",
    description: "Track browser executions, API checks, failures, and queued work.",
    to: `/projects/${props.projectId}/executions`,
    icon: Play,
    metrics: [
      { label: "executions", key: "executions" },
      { label: "queued", key: "queuedExecutions" },
      { label: "API runs", key: "apiExecutions" },
    ],
  },
  {
    title: "AI context",
    description: "Review chat sessions, knowledge bases, MCP tools, and generated artifacts.",
    to: `/projects/${props.projectId}/chat`,
    icon: BotMessageSquare,
    metrics: [
      { label: "chats", key: "chatSessions" },
      { label: "KBs", key: "knowledgeBases" },
      { label: "MCP approved", key: "approvedMcpTools" },
    ],
  },
  {
    title: "Extensions",
    description: "Check skill installation state and MCP tool governance at a glance.",
    to: `/projects/${props.projectId}/skills`,
    icon: PackageCheck,
    metrics: [
      { label: "skills", key: "skills" },
      { label: "enabled", key: "enabledSkills" },
      { label: "tools", key: "mcpTools" },
    ],
  },
]);

const allEmpty = computed(() => Object.values(counts.value).every((value) => value === 0));
</script>

<template>
  <div class="space-y-6">
    <EmptyState
      v-if="project === null"
      title="Project not found or you lack access"
      description="The project may have been deleted, or your account does not have access to it."
    />

    <template v-else>
      <Card class="overflow-hidden">
        <div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-primary">Workspace Command Center</p>
            <h2 class="mt-1 text-2xl font-bold">Testing workspace overview</h2>
            <p class="mt-2 max-w-3xl text-sm text-muted-foreground">
              Use this project home as the control room for requirements, functional cases, API checks,
              execution evidence, AI context, MCP governance, and skills.
            </p>
          </div>
          <div class="rounded-md bg-muted/40 p-3 text-sm">
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
      </Card>

      <Card v-if="error" class="border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900" data-testid="workspace-summary-error">
        <div class="font-medium">Workspace summary unavailable</div>
        <div class="mt-1">Refresh the summary before trusting overview counts. {{ error.message }}</div>
      </Card>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="metric in headlineMetrics"
          :key="metric.key"
          :to="metric.to"
          :data-testid="metric.testId"
          class="block"
        >
          <Card class="flex h-full items-center gap-4 p-5 transition-colors hover:bg-muted/40">
            <div class="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <component :is="metric.icon" class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <div class="text-2xl font-semibold tabular-nums">
                <span v-if="loading">—</span>
                <span v-else>{{ counts[metric.key] }}</span>
              </div>
              <div class="text-sm font-medium">{{ metric.label }}</div>
              <div class="truncate text-xs text-muted-foreground">{{ metric.detail }}</div>
            </div>
          </Card>
        </NuxtLink>
      </section>

      <section class="grid gap-4 lg:grid-cols-2">
        <NuxtLink v-for="workflow in workflowGroups" :key="workflow.title" :to="workflow.to" class="block">
          <Card class="h-full p-5 transition-colors hover:bg-muted/40">
            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <component :is="workflow.icon" class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold">{{ workflow.title }}</h3>
                <p class="mt-1 text-sm text-muted-foreground">{{ workflow.description }}</p>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div v-for="metric in workflow.metrics" :key="`${workflow.title}-${metric.key}`" class="rounded-md bg-muted/40 p-2">
                <div class="font-semibold tabular-nums">{{ loading ? "—" : counts[metric.key] }}</div>
                <div class="text-xs text-muted-foreground">{{ metric.label }}</div>
              </div>
            </div>
          </Card>
        </NuxtLink>
      </section>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card class="p-5">
          <div class="flex items-start gap-3">
            <Sparkles class="mt-1 h-5 w-5 text-primary" />
            <div>
              <h3 class="font-semibold">Suggested next actions</h3>
              <p class="mt-1 text-sm text-muted-foreground">
                Keep the workspace moving by filling missing test assets, running queued work, or wiring AI context.
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <Button as-child>
                  <NuxtLink :to="`/projects/${projectId}/test-cases`">Author test cases</NuxtLink>
                </Button>
                <Button as-child variant="outline">
                  <NuxtLink :to="`/projects/${projectId}/test-suites`">Build suites</NuxtLink>
                </Button>
                <Button as-child variant="outline">
                  <NuxtLink :to="`/projects/${projectId}/ai-generation`">Generate with AI</NuxtLink>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card class="p-5">
          <div class="flex items-start gap-3">
            <Wrench class="mt-1 h-5 w-5 text-primary" />
            <div>
              <h3 class="font-semibold">Governance snapshot</h3>
              <p class="mt-1 text-sm text-muted-foreground">
                {{ counts.approvedMcpTools }} approved MCP tools and {{ counts.enabledSkills }} enabled skills are available.
              </p>
              <NuxtLink :to="`/projects/${projectId}/mcp-admin`" class="mt-3 inline-block text-sm font-medium text-primary">
                Review tool approvals →
              </NuxtLink>
            </div>
          </div>
        </Card>
      </div>

      <EmptyState
        v-if="!loading && !error && allEmpty"
        title="Nothing in this project yet"
        description="Get started by creating a test case, configuring a model provider, or importing knowledge."
      >
        <Button as-child>
          <NuxtLink :to="`/projects/${projectId}/ai-generation`">Generate test cases with AI</NuxtLink>
        </Button>
      </EmptyState>
    </template>
  </div>
</template>
