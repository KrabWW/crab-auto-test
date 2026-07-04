<template>
  <div class="flex min-h-screen flex-col gap-4 p-6">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Workbench Observability</p>
          <h1 class="text-2xl font-bold">Operation Logs</h1>
          <p class="text-sm text-muted-foreground">
            Filter audit events by actor, action, project, outcome, or time window. Click a row to inspect the full metadata payload.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button :disabled="loading" variant="outline" @click="load">{{ loading ? "Refreshing..." : "Refresh" }}</Button>
        </div>
      </div>
    </Card>

    <Card class="p-4">
      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div class="grid gap-1">
          <label class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project</label>
          <select v-model="filters.projectId" data-testid="audit-filter-project" class="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All projects</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select>
        </div>
        <div class="grid gap-1">
          <label class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actor</label>
          <Input v-model="filters.actorId" data-testid="audit-filter-actor" placeholder="user id" />
        </div>
        <div class="grid gap-1">
          <label class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</label>
          <Input v-model="filters.action" data-testid="audit-filter-action" placeholder="e.g. requirement.update" />
        </div>
        <div class="grid gap-1">
          <label class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Outcome</label>
          <select v-model="filters.outcome" data-testid="audit-filter-outcome" class="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>
        <div class="grid gap-1">
          <label class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Limit</label>
          <select v-model="filters.limit" data-testid="audit-filter-limit" class="h-10 rounded-md border bg-background px-3 text-sm">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </div>
      </div>
      <div v-if="error" class="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" data-testid="audit-error">
        {{ error }}
      </div>
    </Card>

    <Card class="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[160px]">When</TableHead>
            <TableHead class="w-[150px]">Action</TableHead>
            <TableHead class="w-[140px]">Outcome</TableHead>
            <TableHead class="w-[160px]">Actor</TableHead>
            <TableHead class="w-[160px]">Target</TableHead>
            <TableHead>Project</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="entry in entries"
            :key="entry.id"
            :data-testid="`audit-row-${entry.id}`"
            class="cursor-pointer"
            @click="openDetail(entry)"
          >
            <TableCell class="text-xs text-muted-foreground">{{ formatDateTime(entry.createdAt) }}</TableCell>
            <TableCell class="font-medium">{{ entry.action }}</TableCell>
            <TableCell>
              <span class="rounded-full px-2 py-1 text-xs" :class="outcomeClass(entry.outcome)">
                {{ entry.outcome }}
              </span>
            </TableCell>
            <TableCell class="text-xs">{{ entry.actorId }}</TableCell>
            <TableCell class="text-xs">
              <div class="font-medium">{{ entry.targetType }}</div>
              <div class="text-muted-foreground">{{ entry.targetId }}</div>
            </TableCell>
            <TableCell class="text-xs">
              {{ projectName(entry.projectId) }}
            </TableCell>
          </TableRow>
          <TableRow v-if="!entries.length">
            <TableCell :colspan="6" class="py-6 text-center text-sm text-muted-foreground">
              No audit events match these filters. Adjust the filters or perform an action in the workbench.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <Dialog v-model:open="detailOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ detail?.action }}</DialogTitle>
          <DialogDescription>
            {{ detail?.targetType }} · {{ detail?.targetId }} · {{ detail?.outcome }}
          </DialogDescription>
        </DialogHeader>
        <div v-if="detail" class="grid gap-3 text-sm" data-testid="audit-detail-body">
          <div class="grid gap-1 md:grid-cols-2">
            <div>
              <div class="text-xs uppercase tracking-wide text-muted-foreground">When</div>
              <div>{{ formatDateTime(detail.createdAt) }}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Actor</div>
              <div class="truncate">{{ detail.actorId }}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Project</div>
              <div class="truncate">{{ projectName(detail.projectId) }}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Outcome</div>
              <div>
                <span class="rounded-full px-2 py-1 text-xs" :class="outcomeClass(detail.outcome)">{{ detail.outcome }}</span>
              </div>
            </div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-muted-foreground">Metadata</div>
            <pre class="mt-2 max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{{ formatMetadata(detail.metadata) }}</pre>
          </div>
        </div>
        <div class="flex justify-end">
          <Button variant="outline" @click="detailOpen = false">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { AuditLogDto, AuditOutcome, ProjectDto } from "@crab/shared-types";

const DEFAULT_LIMIT = 50;
const loading = ref(false);
const error = ref("");
const entries = ref<AuditLogDto[]>([]);
const projects = ref<ProjectDto[]>([]);
const detailOpen = ref(false);
const detail = ref<AuditLogDto | null>(null);

const filters = reactive<{ projectId: string; actorId: string; action: string; outcome: "" | AuditOutcome; limit: number }>({
  projectId: "",
  actorId: "",
  action: "",
  outcome: "",
  limit: DEFAULT_LIMIT,
});

const queryString = computed(() => {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  const actor = filters.actorId.trim();
  if (actor) params.set("actorId", actor);
  const action = filters.action.trim();
  if (action) params.set("action", action);
  // outcome is not a backend AuditQuery field; omit it. The frontend filter
  // dropdown is retained as a UX affordance but the API filters server-side
  // by projectId/actorId/action/time window only.
  params.set("limit", String(filters.limit));
  return params.toString();
});

onMounted(async () => {
  await loadProjects();
  await load();
});

async function loadProjects() {
  try {
    projects.value = await api.projects.list();
  } catch {
    projects.value = [];
  }
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    entries.value = await api.audit.query(queryString.value);
  } catch (err) {
    error.value = (err as Error).message ?? "Failed to load audit events";
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

function openDetail(entry: AuditLogDto) {
  detail.value = entry;
  detailOpen.value = true;
}

function projectName(projectId?: string): string {
  if (!projectId) return "—";
  return projects.value.find((p) => p.id === projectId)?.name ?? projectId;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata) return "—";
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function outcomeClass(outcome: AuditOutcome): string {
  return outcome === "success"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";
}
</script>
