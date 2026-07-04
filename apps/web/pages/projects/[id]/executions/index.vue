<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Execution Queue</p>
          <h2 class="text-xl font-bold">Executions</h2>
          <p class="text-sm text-muted-foreground">
            Track project-scoped queued work, running jobs, retained artifacts, and report summaries.
          </p>
        </div>
        <Button :disabled="loading" @click="load">{{ loading ? "Refreshing..." : "Refresh" }}</Button>
      </div>
    </Card>

    <div class="grid gap-3 md:grid-cols-4" data-testid="execution-stats">
      <Card v-for="stat in stats" :key="stat.label" class="p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ stat.label }}</div>
        <div class="mt-2 text-2xl font-semibold tabular-nums">{{ stat.value }}</div>
        <div class="mt-1 text-xs text-muted-foreground">{{ stat.detail }}</div>
      </Card>
    </div>

    <Card class="overflow-hidden">
      <div class="grid grid-cols-[1fr_120px_140px_120px] bg-muted/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <div>Source case</div>
        <div>Status</div>
        <div>Environment</div>
        <div>Artifacts</div>
      </div>

      <NuxtLink
        v-for="execution in executions"
        :key="execution.id"
        :to="`/projects/${projectId}/executions/${execution.id}`"
        class="grid grid-cols-[1fr_120px_140px_120px] items-center gap-3 border-t px-4 py-3 text-sm transition hover:bg-muted/40"
        :data-testid="`execution-row-${execution.id}`"
      >
        <div class="min-w-0">
          <div class="truncate font-medium">{{ execution.testCaseTitle || execution.testCaseId }}</div>
          <div class="truncate text-xs text-muted-foreground">
            {{ shortDate(execution.startedAt) }} / {{ duration(execution.durationMs) }}
          </div>
        </div>
        <div>
          <span class="rounded-full px-2 py-1 text-xs" :class="statusClass(execution.status)">
            {{ execution.status }}
          </span>
        </div>
        <div class="truncate text-muted-foreground">{{ execution.environment }}</div>
        <div class="tabular-nums text-muted-foreground">{{ execution.artifacts.length }}</div>
      </NuxtLink>

      <div v-if="!executions.length" class="border-t p-4 text-sm text-muted-foreground">
        No executions yet. Start a case or suite run to populate this queue.
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { ExecutionDto, ExecutionStatus } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const executions = ref<ExecutionDto[]>([]);
const loading = ref(false);

const terminalStatuses = new Set<ExecutionStatus>(["passed", "failed", "aborted", "timeout"]);
const stats = computed(() => {
  const queued = executions.value.filter((execution) => execution.status === "queued").length;
  const active = executions.value.filter((execution) => execution.status === "running" || execution.status === "dispatched").length;
  const terminal = executions.value.filter((execution) => terminalStatuses.has(execution.status)).length;
  const artifacts = executions.value.reduce((sum, execution) => sum + execution.artifacts.length, 0);
  return [
    { label: "Queued", value: queued, detail: "Waiting for worker claim" },
    { label: "Active", value: active, detail: "Dispatched or running" },
    { label: "Terminal", value: terminal, detail: "Completed or stopped" },
    { label: "Artifacts", value: artifacts, detail: "Retained report files" },
  ];
});

onMounted(load);

async function load() {
  loading.value = true;
  try {
    executions.value = await api.executions.list(projectId);
  } finally {
    loading.value = false;
  }
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function duration(value?: number) {
  if (value === undefined) return "duration pending";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function statusClass(status: ExecutionStatus) {
  return {
    queued: "bg-slate-100 text-slate-700",
    dispatched: "bg-blue-100 text-blue-700",
    running: "bg-amber-100 text-amber-800",
    passed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
    aborted: "bg-slate-100 text-slate-700",
    timeout: "bg-red-100 text-red-700",
  }[status];
}
</script>
