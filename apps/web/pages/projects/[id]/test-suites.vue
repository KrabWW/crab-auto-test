<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Batch Execution</p>
          <h2 class="text-xl font-bold">Test Suites</h2>
          <p class="text-sm text-muted-foreground">Group cases, control execution order, and inspect suite run status.</p>
        </div>
        <div class="flex items-center gap-2">
          <Input
            v-model="search"
            data-testid="suite-search"
            placeholder="Search suites"
            class="h-9 w-56"
          />
          <Button :disabled="!isReady" @click="showNew = !showNew">{{ showNew ? "Close" : "New suite" }}</Button>
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

    <div v-if="!isReady" class="grid gap-3">
      <Card v-for="i in 2" :key="i" class="p-4">
        <div class="h-4 w-1/3 animate-pulse rounded bg-muted"></div>
        <div class="mt-3 h-8 w-2/3 animate-pulse rounded bg-muted/70"></div>
      </Card>
    </div>

    <Card v-else-if="showNew" class="p-4">
      <div class="grid gap-3">
        <div class="grid gap-3 md:grid-cols-2">
          <Input v-model="draft.name" placeholder="Suite name" />
          <Input v-model="draft.description" placeholder="Description" />
        </div>
        <div class="max-h-80 overflow-auto rounded-md border">
          <label v-for="testCase in cases" :key="testCase.id" class="flex items-start gap-2 border-b p-3 text-sm last:border-b-0">
            <input v-model="draft.caseIds" class="mt-1" type="checkbox" :value="testCase.id" />
            <span class="min-w-0">
              <span class="block font-medium">{{ testCase.title }}</span>
              <span class="text-xs text-muted-foreground">{{ testCase.priority }} / {{ testCase.status }} / {{ testCase.steps.length }} steps</span>
            </span>
          </label>
        </div>
        <Button :disabled="!draft.name || !draft.caseIds.length" @click="createSuite">Create suite</Button>
      </div>
    </Card>

    <div v-if="isReady" class="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card class="overflow-hidden">
        <div class="border-b p-4">
          <h3 class="font-semibold">Suite Library</h3>
          <p class="text-sm text-muted-foreground">Reusable batches for smoke and regression.</p>
        </div>
        <button
          v-for="suite in filteredSuites"
          :key="suite.id"
          class="block w-full p-4 text-left transition hover:bg-muted/40"
          :class="selected?.id === suite.id ? 'bg-accent/60' : ''"
          @click="selectSuite(suite)"
        >
          <div class="font-medium">{{ suite.name }}</div>
          <div class="mt-1 text-xs text-muted-foreground">
            {{ suite.cases.length }} cases / Updated {{ shortDate(suite.updatedAt) }}
          </div>
        </button>
        <div v-if="!filteredSuites.length" class="p-4 text-sm text-muted-foreground">
          <p v-if="!suites.length">No test suites yet. Click "New suite" to group test cases for batch execution.</p>
          <p v-else>No suites match the current search.</p>
        </div>
      </Card>

      <Card v-if="selected" class="p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-primary">Suite Detail</p>
            <div class="mt-2 grid gap-2 md:grid-cols-2">
              <Input v-model="selectedDraft.name" aria-label="Suite name" />
              <Input v-model="selectedDraft.description" aria-label="Suite description" />
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" :disabled="!selectedDraft.name" @click="saveDetails">Save details</Button>
            <Button variant="destructive" data-testid="delete-suite" @click="confirmDelete">Delete</Button>
            <Button variant="outline" :disabled="!editableCases.length" @click="saveMembers">Save members</Button>
            <Button :disabled="!editableCases.length" data-testid="run-suite" @click="confirmRun">Run suite</Button>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2 rounded-md border p-3">
          <select v-model="addCaseId" class="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Add test case">
            <option value="">Add an existing case...</option>
            <option v-for="testCase in addableCases" :key="testCase.id" :value="testCase.id">{{ testCase.title }}</option>
          </select>
          <Button variant="outline" :disabled="!addCaseId" @click="addCase">Add case</Button>
        </div>

        <div class="mt-4 overflow-hidden rounded-md border">
          <div class="grid grid-cols-[56px_1fr_140px_180px] bg-muted/60 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div>Order</div>
            <div>Case</div>
            <div>Priority</div>
            <div>Controls</div>
          </div>
          <div v-for="(item, index) in editableCases" :key="item.testCaseId" class="grid grid-cols-[56px_1fr_140px_180px] items-center border-t px-3 py-3 text-sm">
            <div class="tabular-nums">{{ index + 1 }}</div>
            <div class="min-w-0">
              <div class="truncate font-medium">{{ titleFor(item.testCaseId) }}</div>
              <div class="text-xs text-muted-foreground">{{ item.testCase?.status || "active" }}</div>
            </div>
            <div>
              <span class="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{{ item.testCase?.priority || "medium" }}</span>
            </div>
            <div class="flex gap-1">
              <Button variant="outline" size="sm" :disabled="index === 0" @click="moveCase(index, -1)">Up</Button>
              <Button variant="outline" size="sm" :disabled="index === editableCases.length - 1" @click="moveCase(index, 1)">Down</Button>
              <Button variant="outline" size="sm" @click="removeCase(index)">Remove</Button>
            </div>
          </div>
          <div v-if="!editableCases.length" class="p-4 text-sm text-muted-foreground">
            This suite has no cases. Add an existing case above to build the execution order.
          </div>
        </div>

        <Card v-if="lastRun" class="mt-4 border-primary/30 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 class="font-semibold">Suite Run</h4>
              <p class="text-sm text-muted-foreground">
                {{ lastRun.status }} / {{ lastRun.environment }} / {{ lastRun.executions.length }} executions
              </p>
            </div>
            <span class="rounded-full px-2 py-1 text-xs" :class="statusClass(lastRun.status)">{{ lastRun.status }}</span>
          </div>
          <div class="mt-3 grid gap-2">
            <div v-for="execution in lastRun.executions" :key="execution.id" class="grid gap-2 rounded-md bg-muted/50 p-3 text-sm md:grid-cols-[1fr_120px_160px]">
              <NuxtLink :to="`/projects/${projectId}/executions/${execution.id}`" class="font-medium text-primary">
                {{ titleFor(execution.testCaseId) }}
              </NuxtLink>
              <div>{{ execution.status }}</div>
              <div class="text-muted-foreground">{{ execution.environment }}</div>
            </div>
          </div>
        </Card>
        <Card v-else-if="recentRun" class="mt-4 border-muted p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h4 class="font-semibold text-muted-foreground">Last suite run</h4>
              <p class="text-sm text-muted-foreground">
                {{ recentRun.status }} / {{ recentRun.environment }} / {{ recentRun.executions.length }} executions
              </p>
            </div>
            <span class="rounded-full px-2 py-1 text-xs" :class="statusClass(recentRun.status)">{{ recentRun.status }}</span>
          </div>
        </Card>
      </Card>

      <Card v-else class="p-6">
        <div class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          <p class="font-medium text-foreground">No suite selected</p>
          <p class="mt-1">Pick one from the library, or click "New suite" to group test cases for batch execution.</p>
        </div>
      </Card>
    </div>

    <Dialog v-model:open="confirmOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ confirmTitle }}</DialogTitle>
          <DialogDescription>{{ confirmDescription }}</DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="confirmOpen = false">Cancel</Button>
          <Button :variant="confirmVariant" data-testid="confirm-action" @click="runConfirmed">Confirm</Button>
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
import type { SuiteRunDto, SuiteRunStatus, TestCaseDto, TestSuiteCaseDto, TestSuiteDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const suites = ref<TestSuiteDto[]>([]);
const cases = ref<TestCaseDto[]>([]);
const selected = ref<TestSuiteDto | null>(null);
const editableCases = ref<TestSuiteCaseDto[]>([]);
const lastRun = ref<SuiteRunDto | null>(null);
const recentRun = ref<SuiteRunDto | null>(null);
const showNew = ref(false);
const search = ref("");
const selectedDraft = ref({ name: "", description: "" });
const addCaseId = ref("");
const isReady = ref(false);
const draft = ref({
  name: "",
  description: "",
  caseIds: [] as string[],
});

const confirmOpen = ref(false);
const confirmTitle = ref("");
const confirmDescription = ref("");
const confirmVariant = ref<"default" | "destructive">("default");
const confirmAction = ref<null | "delete" | "run">(null);

const stats = computed(() => [
  { label: "Suites", value: suites.value.length, detail: "Reusable execution batches" },
  { label: "Case links", value: suites.value.reduce((sum, suite) => sum + suite.cases.length, 0), detail: "Ordered suite membership" },
  { label: "Available cases", value: cases.value.length, detail: "Can be assigned to suites" },
  { label: "Latest run", value: recentRun.value?.status ?? lastRun.value?.status ?? "idle", detail: "Current suite signal" },
]);

const addableCases = computed(() => {
  const used = new Set(editableCases.value.map((testCase) => testCase.testCaseId));
  return cases.value.filter((testCase) => !used.has(testCase.id));
});

const filteredSuites = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return suites.value;
  return suites.value.filter(
    (s) => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q),
  );
});

onMounted(load);

watch(selected, (suite) => {
  editableCases.value = suite ? suite.cases.map((testCase) => ({ ...testCase })) : [];
  selectedDraft.value = { name: suite?.name ?? "", description: suite?.description ?? "" };
  addCaseId.value = "";
  lastRun.value = null;
});

async function load() {
  isReady.value = false;
  try {
    const [suiteRows, caseRows] = await Promise.all([
      api.testSuites.list(projectId),
      api.testCases.list(projectId),
    ]);
    suites.value = suiteRows;
    cases.value = caseRows;
    if (selected.value) {
      selected.value = suiteRows.find((suite) => suite.id === selected.value?.id) ?? null;
    } else {
      selected.value = suiteRows[0] ?? null;
    }
    if (suiteRows[0]) {
      try {
        const runs = await Promise.all(
          suiteRows.slice(0, 5).map((s) =>
            fetchRecentRun(s.id).catch(() => null),
          ),
        );
        recentRun.value = runs.find((r): r is SuiteRunDto => r !== null) ?? null;
      } catch {
        recentRun.value = null;
      }
    }
  } finally {
    isReady.value = true;
  }
}

async function fetchRecentRun(suiteId: string): Promise<SuiteRunDto | null> {
  // No list endpoint for runs; fetch the first run by scanning via suite-runs/:id is not possible
  // without a run id. As a lightweight signal, return null when no recent run is tracked.
  // The full run summary loads when the user clicks "Run suite".
  return null;
}

function selectSuite(suite: TestSuiteDto) {
  selected.value = suite;
}

function titleFor(id: string) {
  return cases.value.find((testCase) => testCase.id === id)?.title ?? id;
}

async function createSuite() {
  await api.testSuites.create(projectId, {
    name: draft.value.name,
    description: draft.value.description || undefined,
    cases: draft.value.caseIds.map((testCaseId, index) => ({ testCaseId, order: index + 1 })),
  });
  draft.value = { name: "", description: "", caseIds: [] };
  showNew.value = false;
  await load();
}

function moveCase(index: number, direction: -1 | 1) {
  const target = index + direction;
  [editableCases.value[index], editableCases.value[target]] = [editableCases.value[target]!, editableCases.value[index]!];
}

function removeCase(index: number) {
  editableCases.value.splice(index, 1);
}

async function saveDetails() {
  if (!selected.value) return;
  selected.value = await api.testSuites.update(projectId, selected.value.id, {
    name: selectedDraft.value.name,
    description: selectedDraft.value.description || undefined,
  });
  await load();
}

function confirmDelete() {
  if (!selected.value) return;
  confirmAction.value = "delete";
  confirmTitle.value = "Delete test suite";
  confirmDescription.value =
    "Deletion is permanent. Suites that already have runs cannot be deleted; archive their runs first if needed.";
  confirmVariant.value = "destructive";
  confirmOpen.value = true;
}

function confirmRun() {
  if (!selected.value) return;
  confirmAction.value = "run";
  confirmTitle.value = "Run test suite";
  confirmDescription.value =
    "Starts a new suite run. Each member case gets a queued execution record. The summary updates as executions finish.";
  confirmVariant.value = "default";
  confirmOpen.value = true;
}

async function runConfirmed() {
  if (!selected.value || !confirmAction.value) return;
  const action = confirmAction.value;
  confirmOpen.value = false;
  confirmAction.value = null;
  if (action === "delete") {
    await api.testSuites.remove(projectId, selected.value.id);
    selected.value = null;
    await load();
  } else if (action === "run") {
    const run = await api.testSuites.run(projectId, selected.value.id, { environment: "local" });
    await load();
    lastRun.value = run;
    recentRun.value = run;
  }
}

function addCase() {
  const testCase = cases.value.find((item) => item.id === addCaseId.value);
  if (!testCase) return;
  editableCases.value.push({
    testCaseId: testCase.id,
    order: editableCases.value.length + 1,
    testCase: {
      id: testCase.id,
      title: testCase.title,
      priority: testCase.priority,
      status: testCase.status,
    },
  });
  addCaseId.value = "";
}

async function saveMembers() {
  if (!selected.value) return;
  selected.value = await api.testSuites.updateCases(
    projectId,
    selected.value.id,
    editableCases.value.map((testCase, index) => ({ testCaseId: testCase.testCaseId, order: index + 1 })),
  );
  await load();
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(new Date(value));
}

function statusClass(status: SuiteRunStatus) {
  return {
    queued: "bg-slate-100 text-slate-700",
    dispatched: "bg-blue-100 text-blue-700",
    running: "bg-amber-100 text-amber-800",
    partial: "bg-violet-100 text-violet-700",
    passed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
    aborted: "bg-slate-100 text-slate-700",
    timeout: "bg-red-100 text-red-700",
  }[status];
}
</script>
