<template>
  <div class="flex flex-col gap-4" data-testid="execution-detail">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NuxtLink :to="`/projects/${projectId}/executions`" class="text-xs font-semibold uppercase tracking-wide text-primary">
            Execution Queue
          </NuxtLink>
          <h2 class="mt-1 text-xl font-bold">Execution Report</h2>
          <p class="text-sm text-muted-foreground">
            Project-scoped execution detail, report summary, retained artifacts, and reconnect snapshot.
          </p>
        </div>
        <Button :disabled="loading" @click="load">{{ loading ? "Refreshing..." : "Refresh" }}</Button>
      </div>
    </Card>

    <Card v-if="error" class="border-red-200 p-4 text-sm text-red-700">
      {{ error }}
    </Card>

    <template v-if="execution">
      <div class="grid gap-3 md:grid-cols-4">
        <Card class="p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</div>
          <div class="mt-2">
            <span class="rounded-full px-2 py-1 text-sm" :class="statusClass(execution.status)">
              {{ execution.status }}
            </span>
          </div>
          <div class="mt-2 text-xs text-muted-foreground">{{ execution.environment }}</div>
        </Card>
        <Card class="p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source case</div>
          <NuxtLink :to="`/projects/${projectId}/test-cases`" class="mt-2 block truncate font-semibold text-primary">
            {{ execution.testCaseTitle || execution.testCaseId }}
          </NuxtLink>
          <div class="mt-1 truncate text-xs text-muted-foreground">{{ execution.testCaseId }}</div>
        </Card>
        <Card class="p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timing</div>
          <div class="mt-2 font-semibold">{{ duration(execution.durationMs) }}</div>
          <div class="mt-1 text-xs text-muted-foreground">{{ shortDate(execution.startedAt) }}</div>
        </Card>
        <Card class="p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Worker</div>
          <div class="mt-2 truncate font-semibold">{{ execution.workerJobId || "not claimed" }}</div>
          <div class="mt-1 truncate text-xs text-muted-foreground">
            Failed step: {{ execution.failedStepId || "none" }}
          </div>
        </Card>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="flex flex-col gap-4">
          <Card class="p-4" data-testid="execution-report-summary">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="font-semibold">Report Summary</h3>
                <p class="text-sm text-muted-foreground">Worker-provided rollup stored on the execution record.</p>
              </div>
              <span class="text-xs text-muted-foreground">{{ summaryEntries.length }} fields</span>
            </div>

            <div v-if="summaryEntries.length" class="mt-4 grid gap-2">
              <div
                v-for="[key, value] in summaryEntries"
                :key="key"
                class="grid gap-2 rounded-md bg-muted/40 p-3 text-sm md:grid-cols-[180px_1fr]"
              >
                <div class="font-medium">{{ key }}</div>
                <pre class="whitespace-pre-wrap text-xs text-muted-foreground">{{ formatValue(value) }}</pre>
              </div>
            </div>
            <div v-else class="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No report summary has been recorded yet.
            </div>
          </Card>

          <Card class="p-4" data-testid="execution-artifacts">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="font-semibold">Artifacts</h3>
                <p class="text-sm text-muted-foreground">Screenshots, logs, traces, and report metadata retained by the worker.</p>
              </div>
              <span class="text-xs text-muted-foreground">{{ execution.artifacts.length }} retained</span>
            </div>

            <div v-if="execution.artifacts.length" class="mt-4 grid gap-3">
              <div v-for="artifact in execution.artifacts" :key="artifact.id" class="rounded-md border p-3 text-sm">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="font-medium">{{ artifact.filename }}</div>
                  <span class="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{{ artifact.type }}</span>
                </div>
                <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <div>Storage: {{ artifact.storageRef }}</div>
                  <div>Size: {{ artifact.sizeBytes }} bytes</div>
                  <div>Checksum: {{ artifact.checksum }}</div>
                  <div>Captured: {{ shortDate(artifact.capturedAt) }}</div>
                  <div v-if="artifact.truncated" class="font-medium text-amber-700">Truncated artifact</div>
                </div>
                <div v-if="metadataEntries(artifact.metadata).length" class="mt-3 rounded-md bg-muted/40 p-2">
                  <div class="font-medium">Metadata</div>
                  <div
                    v-for="[key, value] in metadataEntries(artifact.metadata)"
                    :key="`${artifact.id}-${key}`"
                    class="mt-1 grid gap-2 md:grid-cols-[140px_1fr]"
                  >
                    <span>{{ key }}</span>
                    <pre class="whitespace-pre-wrap">{{ formatValue(value) }}</pre>
                  </div>
                </div>
                <div v-if="artifactDataUrl(artifact)" class="mt-3">
                  <img
                    v-if="artifact.type === 'screenshot'"
                    :src="artifactDataUrl(artifact)"
                    :alt="artifact.filename"
                    class="max-h-[520px] w-full rounded-md border object-contain"
                  />
                  <pre
                    v-else-if="artifact.type === 'log' || artifact.type === 'report'"
                    class="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-xs"
                  >{{ artifactText(artifact) }}</pre>
                  <a
                    class="inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    :href="artifactDataUrl(artifact)"
                    :download="artifact.filename"
                  >
                    Download {{ artifact.filename }}
                  </a>
                </div>
              </div>
            </div>
            <div v-else class="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No artifacts have been retained for this execution.
            </div>
          </Card>
        </div>

        <Card class="p-4" data-testid="execution-snapshot">
          <div>
            <h3 class="font-semibold">Reconnect Snapshot</h3>
            <p class="text-sm text-muted-foreground">
              Authoritative status plus bounded live events for clients returning to this execution.
            </p>
          </div>

          <div class="mt-4 grid gap-2 rounded-md bg-muted/40 p-3 text-sm">
            <div>Status: {{ snapshot?.status ?? execution.status }}</div>
            <div>Artifacts: {{ snapshot?.artifacts.length ?? execution.artifacts.length }}</div>
            <div>Events: {{ snapshot?.events.length ?? 0 }}</div>
          </div>

          <div v-if="snapshot?.events.length" class="mt-4 grid gap-2">
            <div v-for="event in snapshot.events" :key="`${event.seq}-${event.ts}`" class="rounded-md border p-3 text-sm">
              <div class="font-medium">#{{ event.seq }} {{ event.type }}</div>
              <div class="text-xs text-muted-foreground">
                {{ event.stage || "execution" }} / {{ shortDate(event.ts) }}
              </div>
              <pre class="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{{ formatValue(event.payload) }}</pre>
            </div>
          </div>
          <div v-else class="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No live events are retained for this execution.
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { ExecutionArtifactDto, ExecutionDto, ExecutionSnapshot, ExecutionStatus } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const executionId = route.params.executionId as string;
const execution = ref<ExecutionDto | null>(null);
const snapshot = ref<ExecutionSnapshot | null>(null);
const loading = ref(false);
const error = ref("");

const summaryEntries = computed(() => Object.entries(execution.value?.reportSummary ?? {}));

onMounted(load);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [executionResult, snapshotResult] = await Promise.allSettled([
      api.executions.get(projectId, executionId),
      api.executions.snapshot(projectId, executionId),
    ]);
    if (executionResult.status === "fulfilled") {
      execution.value = executionResult.value;
    } else {
      throw executionResult.reason;
    }
    if (snapshotResult.status === "fulfilled") {
      snapshot.value = snapshotResult.value;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load execution report.";
  } finally {
    loading.value = false;
  }
}

function metadataEntries(metadata?: Record<string, unknown>) {
  return Object.entries(metadata ?? {}).filter(([key]) => key !== "contentBase64");
}

function artifactDataUrl(artifact: ExecutionArtifactDto) {
  const base64 = artifact.metadata?.contentBase64;
  const mimeType = artifact.metadata?.mimeType;
  if (typeof base64 !== "string" || typeof mimeType !== "string") return "";
  return `data:${mimeType};base64,${base64}`;
}

function artifactText(artifact: ExecutionArtifactDto) {
  const base64 = artifact.metadata?.contentBase64;
  if (typeof base64 !== "string") return "";
  try {
    return atob(base64);
  } catch {
    return "";
  }
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
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
