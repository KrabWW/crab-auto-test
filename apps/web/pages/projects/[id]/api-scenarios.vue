<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Ordered workflows</p>
          <h2 class="text-xl font-bold">API Scenarios</h2>
          <p class="text-sm text-muted-foreground">
            Chain saved API cases into ordered workflows. Variables extracted in step N feed the next steps.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="outline" as-child>
            <NuxtLink :to="`/projects/${projectId}/api-automation`">Back to API cases</NuxtLink>
          </Button>
          <Button :disabled="loading" variant="outline" @click="load">Refresh</Button>
          <Button data-testid="new-scenario" @click="showNew = !showNew">
            {{ showNew ? "Close" : "New scenario" }}
          </Button>
        </div>
      </div>
    </Card>

    <div class="grid gap-3 md:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label" class="p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ stat.label }}</div>
        <div class="mt-2 text-2xl font-semibold tabular-nums">{{ stat.value }}</div>
        <div class="mt-1 text-xs text-muted-foreground">{{ stat.detail }}</div>
      </Card>
    </div>

    <Card v-if="showNew" class="p-4">
      <h3 class="font-semibold">New scenario</h3>
      <p class="text-sm text-muted-foreground">Pick one or more API cases. Reorder after creation.</p>
      <div class="mt-4 grid gap-3">
        <Input v-model="draft.name" data-testid="scenario-name" placeholder="Scenario name" />
        <Input v-model="draft.description" placeholder="Description (optional)" />
        <div class="max-h-72 overflow-auto rounded-md border">
          <label
            v-for="testCase in cases"
            :key="testCase.id"
            class="flex items-start gap-2 border-b p-3 text-sm last:border-b-0"
          >
            <input
              v-model="draft.caseIds"
              class="mt-1"
              type="checkbox"
              :value="testCase.id"
              :data-testid="`scenario-pick-${testCase.id}`"
            />
            <span class="min-w-0">
              <span class="block font-medium">{{ testCase.name }}</span>
              <span class="text-xs text-muted-foreground">{{ testCase.method }} · {{ testCase.url }}</span>
            </span>
          </label>
        </div>
        <Button data-testid="create-scenario" :disabled="!canCreate" @click="createScenario">Create scenario</Button>
      </div>
    </Card>

    <div class="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card class="overflow-hidden">
        <div class="border-b p-4">
          <h3 class="font-semibold">Scenario library</h3>
          <p class="text-sm text-muted-foreground">Project-scoped multi-step workflows.</p>
        </div>
        <button
          v-for="scenario in scenarios"
          :key="scenario.id"
          type="button"
          class="block w-full p-4 text-left transition hover:bg-muted/40"
          :class="selected?.id === scenario.id ? 'bg-accent/60' : ''"
          :data-testid="`scenario-row-${scenario.id}`"
          @click="selectScenario(scenario)"
        >
          <div class="font-medium">{{ scenario.name }}</div>
          <div class="mt-1 text-xs text-muted-foreground">
            {{ scenario.steps.length }} steps / Updated {{ shortDate(scenario.updatedAt) }}
          </div>
        </button>
        <div v-if="!scenarios.length" class="p-4 text-sm text-muted-foreground">
          No scenarios yet. Create the first one to chain API cases into ordered workflows.
        </div>
      </Card>

      <Card v-if="selected" class="p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-primary">Scenario detail</p>
            <div class="mt-2 grid gap-2 md:grid-cols-2">
              <Input v-model="detailDraft.name" aria-label="Scenario name" />
              <Input v-model="detailDraft.description" aria-label="Scenario description" />
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" :disabled="!detailDraft.name" @click="saveDetails">Save details</Button>
            <Button variant="destructive" data-testid="delete-scenario" @click="confirmDelete">Delete</Button>
            <Button variant="outline" :disabled="!selected.steps.length" data-testid="save-steps" @click="saveSteps">
              Save steps
            </Button>
            <Button :disabled="!selected.steps.length" data-testid="run-scenario" @click="runScenario">
              {{ running ? "Running..." : "Run scenario" }}
            </Button>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2 rounded-md border p-3">
          <select v-model="addCaseId" class="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Add API case">
            <option value="">Add an existing case...</option>
            <option v-for="testCase in addableCases" :key="testCase.id" :value="testCase.id">
              {{ testCase.name }} ({{ testCase.method }})
            </option>
          </select>
          <Button variant="outline" :disabled="!addCaseId" @click="addStep">Add step</Button>
        </div>

        <div class="mt-4 overflow-hidden rounded-md border">
          <div class="grid grid-cols-[56px_1fr_140px_180px] bg-muted/60 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div>Order</div>
            <div>Case</div>
            <div>Method</div>
            <div>Controls</div>
          </div>
          <div
            v-for="(item, index) in editableSteps"
            :key="item.localId"
            class="grid grid-cols-[56px_1fr_140px_180px] items-center border-t px-3 py-3 text-sm"
          >
            <div class="tabular-nums">{{ index + 1 }}</div>
            <div class="min-w-0">
              <div class="truncate font-medium">{{ titleFor(item.caseId) }}</div>
              <div class="truncate text-xs text-muted-foreground">{{ urlFor(item.caseId) }}</div>
            </div>
            <div>
              <span class="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{{ methodFor(item.caseId) }}</span>
            </div>
            <div class="flex gap-1">
              <Button variant="outline" size="sm" :disabled="index === 0" @click="moveStep(index, -1)">Up</Button>
              <Button variant="outline" size="sm" :disabled="index === editableSteps.length - 1" @click="moveStep(index, 1)">Down</Button>
              <Button variant="outline" size="sm" @click="removeStep(index)">Remove</Button>
            </div>
          </div>
          <div v-if="!editableSteps.length" class="p-4 text-sm text-muted-foreground">
            No steps yet. Add API cases above to build the ordered workflow.
          </div>
        </div>

        <Card v-if="lastRun" class="mt-4 border-primary/30 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 class="font-semibold">Latest run</h4>
              <p class="text-sm text-muted-foreground">
                {{ lastRun.status }} / {{ lastRun.environmentName ?? "default" }} /
                {{ lastRun.executions.length }} steps
                <span v-if="lastRun.durationMs !== undefined">· {{ lastRun.durationMs }} ms</span>
              </p>
            </div>
            <span class="rounded-full px-2 py-1 text-xs" :class="runStatusClass(lastRun.status)">{{ lastRun.status }}</span>
          </div>
          <div v-if="lastRun.summary" class="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
            <div>Total: {{ lastRun.summary.totalSteps }}</div>
            <div>Executed: {{ lastRun.summary.executedSteps }}</div>
            <div class="text-emerald-700">Passed: {{ lastRun.summary.passed }}</div>
            <div class="text-rose-700">Failed: {{ lastRun.summary.failed }}</div>
            <div class="text-amber-700">Errored: {{ lastRun.summary.errored }}</div>
          </div>
          <div class="mt-3 grid gap-2">
            <div
              v-for="(execution, idx) in lastRun.executions"
              :key="execution.id"
              class="grid gap-2 rounded-md bg-muted/50 p-3 text-sm md:grid-cols-[36px_1fr_120px_120px]"
            >
              <div class="tabular-nums text-muted-foreground">{{ (execution.scenarioStepIndex ?? idx) + 1 }}</div>
              <div class="truncate font-medium">{{ titleFor(execution.caseId) }}</div>
              <div>
                <span class="rounded-full px-2 py-1 text-xs" :class="runStatusClass(execution.status as ApiScenarioRunStatus)">
                  {{ execution.status }}
                </span>
              </div>
              <div class="text-xs text-muted-foreground">
                {{ execution.responseStatus ?? "—" }}
                <span v-if="execution.durationMs !== undefined">· {{ execution.durationMs }} ms</span>
              </div>
            </div>
          </div>
        </Card>
      </Card>

      <Card v-else class="p-6">
        <div class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          <p class="font-medium text-foreground">No scenario selected</p>
          <p class="mt-1">Pick one from the library, or click "New scenario" to chain API cases into ordered workflows.</p>
        </div>
      </Card>
    </div>

    <Dialog v-model:open="confirmOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete scenario</DialogTitle>
          <DialogDescription>
            Scenarios that already have runs cannot be deleted. This action is permanent.
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="confirmOpen = false">Cancel</Button>
          <Button variant="destructive" data-testid="delete-confirm" @click="runConfirmed">Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type {
  ApiScenarioDto,
  ApiScenarioRunDto,
  ApiScenarioRunStatus,
  ApiTestCaseDto,
} from "@crab/shared-types";

interface EditableStep {
  localId: string;
  caseId: string;
  order: number;
}

const route = useRoute();
const projectId = route.params.id as string;

const loading = ref(false);
const running = ref(false);
const showNew = ref(false);
const scenarios = ref<ApiScenarioDto[]>([]);
const cases = ref<ApiTestCaseDto[]>([]);
const selected = ref<ApiScenarioDto | null>(null);
const editableSteps = ref<EditableStep[]>([]);
const detailDraft = ref({ name: "", description: "" });
const addCaseId = ref("");
const lastRun = ref<ApiScenarioRunDto | null>(null);

const confirmOpen = ref(false);

const draft = ref({ name: "", description: "", caseIds: [] as string[] });

const canCreate = computed(
  () => draft.value.name.trim().length > 0 && draft.value.caseIds.length > 0,
);

const stats = computed(() => [
  { label: "Scenarios", value: scenarios.value.length, detail: "Multi-step workflows" },
  {
    label: "Total steps",
    value: scenarios.value.reduce((sum, s) => sum + s.steps.length, 0),
    detail: "Ordered case references",
  },
  { label: "API cases", value: cases.value.length, detail: "Available to chain" },
  { label: "Latest run", value: lastRun.value?.status ?? "idle", detail: "Most recent signal" },
]);

const addableCases = computed(() => {
  const used = new Set(editableSteps.value.map((s) => s.caseId));
  return cases.value.filter((c) => !used.has(c.id));
});

onMounted(load);

watch(selected, (scenario) => {
  editableSteps.value = scenario
    ? scenario.steps.map((s) => ({ localId: s.id, caseId: s.caseId, order: s.order }))
    : [];
  detailDraft.value = { name: scenario?.name ?? "", description: scenario?.description ?? "" };
  addCaseId.value = "";
  lastRun.value = null;
});

async function load() {
  loading.value = true;
  try {
    const [sc, cs, runs] = await Promise.all([
      api.apiScenarios.list(projectId),
      api.apiAutomation.listCases(projectId),
      api.apiScenarios.listRuns(projectId).catch(() => [] as ApiScenarioRunDto[]),
    ]);
    scenarios.value = sc;
    cases.value = cs;
    if (selected.value) {
      selected.value = sc.find((s) => s.id === selected.value?.id) ?? null;
    } else {
      selected.value = sc[0] ?? null;
    }
    if (runs[0]) {
      try {
        lastRun.value = await api.apiScenarios.getRun(projectId, runs[0]!.id);
      } catch {
        lastRun.value = runs[0] ?? null;
      }
    }
  } finally {
    loading.value = false;
  }
}

function selectScenario(scenario: ApiScenarioDto) {
  selected.value = scenario;
}

function titleFor(id: string) {
  return cases.value.find((c) => c.id === id)?.name ?? id;
}

function urlFor(id: string) {
  return cases.value.find((c) => c.id === id)?.url ?? "—";
}

function methodFor(id: string) {
  return cases.value.find((c) => c.id === id)?.method ?? "—";
}

async function createScenario() {
  const created = await api.apiScenarios.create(projectId, {
    name: draft.value.name,
    description: draft.value.description || undefined,
    cases: [] as never,
    steps: draft.value.caseIds.map((caseId, order) => ({ caseId, order: order + 1 })),
  } as never);
  draft.value = { name: "", description: "", caseIds: [] };
  showNew.value = false;
  await load();
  selected.value = created;
}

function addStep() {
  const testCase = cases.value.find((c) => c.id === addCaseId.value);
  if (!testCase) return;
  editableSteps.value.push({
    localId: `local-${editableSteps.value.length + 1}`,
    caseId: testCase.id,
    order: editableSteps.value.length + 1,
  });
  addCaseId.value = "";
}

function moveStep(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= editableSteps.value.length) return;
  const list = editableSteps.value;
  [list[index], list[target]] = [list[target]!, list[index]!];
  list.forEach((s, i) => (s.order = i + 1));
}

function removeStep(index: number) {
  editableSteps.value.splice(index, 1);
  editableSteps.value.forEach((s, i) => (s.order = i + 1));
}

async function saveDetails() {
  if (!selected.value) return;
  selected.value = await api.apiScenarios.update(projectId, selected.value.id, {
    name: detailDraft.value.name,
    description: detailDraft.value.description || undefined,
  });
  await load();
}

async function saveSteps() {
  if (!selected.value) return;
  selected.value = await api.apiScenarios.updateSteps(
    projectId,
    selected.value.id,
    editableSteps.value.map((s, i) => ({ caseId: s.caseId, order: i + 1 })),
  );
  await load();
}

function confirmDelete() {
  confirmOpen.value = true;
}

async function runConfirmed() {
  if (!selected.value) return;
  confirmOpen.value = false;
  await api.apiScenarios.remove(projectId, selected.value.id);
  selected.value = null;
  await load();
}

async function runScenario() {
  if (!selected.value) return;
  running.value = true;
  try {
    lastRun.value = await api.apiScenarios.run(projectId, selected.value.id);
    await load();
  } finally {
    running.value = false;
  }
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(new Date(value));
}

function runStatusClass(status: ApiScenarioRunStatus | string): string {
  const s = status as ApiScenarioRunStatus;
  return {
    running: "bg-blue-100 text-blue-700",
    passed: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
    aborted: "bg-slate-100 text-slate-700",
    partial: "bg-amber-100 text-amber-700",
    // ApiExecutionStatus values
    queued: "bg-slate-100 text-slate-700",
    dispatched: "bg-blue-100 text-blue-700",
    timeout: "bg-rose-100 text-rose-700",
    error: "bg-rose-100 text-rose-700",
  }[s] ?? "bg-slate-100 text-slate-700";
}
</script>
