<script setup lang="ts">
import { computed, toRef } from "vue";
import { ListChecks, Play, BookOpen } from "lucide-vue-next";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import EmptyState from "./EmptyState.vue";
import { useProjectOverview } from "~/composables/useProjectOverview";
import type { ProjectDto } from "@crab/shared-types";

const props = defineProps<{
  project: ProjectDto | null;
  projectId: string;
}>();

const { counts, loading } = useProjectOverview(toRef(props, "projectId"));

interface StatDef {
  key: "testCases" | "executions" | "knowledgeBases";
  /** kebab-case test id used by e2e (project-workspace.spec.ts). */
  testId: string;
  label: string;
  to: string;
  icon: typeof ListChecks;
}

const stats = computed<StatDef[]>(() => [
  {
    key: "testCases",
    testId: "stat-test-cases",
    label: "Test Cases",
    to: `/projects/${props.projectId}/test-cases`,
    icon: ListChecks,
  },
  {
    key: "executions",
    testId: "stat-executions",
    label: "Executions",
    to: `/projects/${props.projectId}/executions`,
    icon: Play,
  },
  {
    key: "knowledgeBases",
    testId: "stat-knowledge-bases",
    label: "Knowledge Bases",
    to: `/projects/${props.projectId}/knowledge`,
    icon: BookOpen,
  },
]);

const allEmpty = computed(
  () =>
    counts.value.testCases === 0 &&
    counts.value.executions === 0 &&
    counts.value.knowledgeBases === 0,
);
</script>

<template>
  <div class="space-y-6">
    <!-- Project missing: 404 / forbidden -->
    <EmptyState
      v-if="project === null"
      title="Project not found or you lack access"
      description="The project may have been deleted, or your account does not have access to it."
    />

    <template v-else>
      <section class="grid gap-4 sm:grid-cols-3">
        <NuxtLink
          v-for="stat in stats"
          :key="stat.key"
          :to="stat.to"
          :data-testid="stat.testId"
          class="block"
        >
          <Card class="p-5 flex items-center gap-4 hover:bg-muted/40 transition-colors h-full">
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-foreground">
              <component :is="stat.icon" class="h-5 w-5" />
            </div>
            <div>
              <div class="text-2xl font-semibold tabular-nums">
                <span v-if="loading">—</span>
                <span v-else>{{ counts[stat.key] }}</span>
              </div>
              <div class="text-sm text-muted-foreground">{{ stat.label }}</div>
            </div>
          </Card>
        </NuxtLink>
      </section>

      <EmptyState
        v-if="!loading && allEmpty"
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
