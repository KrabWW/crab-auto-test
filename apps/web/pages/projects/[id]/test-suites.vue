<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Batch Execution</p>
          <h2 class="text-xl font-bold">Test Suites</h2>
          <p class="text-sm text-muted-foreground">Group cases, control execution order, and inspect suite run status.</p>
        </div>
        <Button :disabled="!isReady" @click="showNew = !showNew">{{ showNew ? "Close" : "New suite" }}</Button>
      </div>
    </Card>

    <div class="grid gap-3 md:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label" class="p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ stat.label }}</div>
        <div class="mt-2 text-2xl font-semibold tabular-nums">{{ stat.value }}</div>
        <div class="mt-1 text-xs text-muted-foreground">{{ stat.detail }}</div>
      </Card>
    </div>

    <Card v-if="showNew" class="animate-slide-in p-4">
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

    <div class="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card class="overflow-hidden">
        <div class="border-b p-4">
          <h3 class="font-semibold">Suite Library</h3>
          <p class="text-sm text-muted-foreground">Reusable batches for smoke and regression.</p>
        </div>
        <button
          v-for="suite in suites"
          :key="suite.id"
          class="block w-full p-4 text-left transition hover:bg-muted/40"
          :class="selected?.id === suite.id ? 'bg-accent/60' : ''"
          @click="selected = suite"
        >
          <div class="font-medium">{{ suite.name }}</div>
          <div class="mt-1 text-xs text-muted-foreground">
            {{ suite.cases.length }} cases / Updated {{ shortDate(suite.updatedAt) }}
          </div>
        </button>
        <div v-if="!suites.length" class="p-4 text-sm text-muted-foreground">No test suites yet.</div>
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
          <div class="flex gap-2">
            <Button variant="outline" :disabled="!selectedDraft.name" @click="saveDetails">Save details</Button>
            <Button variant="destructive" @click="deleteSuite">Delete</Button>
            <Button variant="outline" :disabled="!editableCases.length" @click="saveMembers">Save members</Button>
            <Button :disabled="!editableCases.length" @click="runSuite">Run suite</Button>
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
          <div v-if="!editableCases.length" class="p-4 text-sm text-muted-foreground">This suite has no cases.</div>
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
              <div class="font-medium">{{ titleFor(execution.testCaseId) }}</div>
              <div>{{ execution.status }}</div>
              <div class="text-muted-foreground">{{ execution.environment }}</div>
            </div>
          </div>
        </Card>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import type { SuiteRunDto, SuiteRunStatus, TestCaseDto, TestSuiteCaseDto, TestSuiteDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const suites = ref<TestSuiteDto[]>([]);
const cases = ref<TestCaseDto[]>([]);
const selected = ref<TestSuiteDto | null>(null);
const editableCases = ref<TestSuiteCaseDto[]>([]);
const lastRun = ref<SuiteRunDto | null>(null);
const showNew = ref(false);
const selectedDraft = ref({ name: "", description: "" });
const addCaseId = ref("");
const isReady = ref(false);
const draft = ref({
  name: "",
  description: "",
  caseIds: [] as string[],
});

const stats = computed(() => [
  { label: "Suites", value: suites.value.length, detail: "Reusable execution batches" },
  { label: "Case links", value: suites.value.reduce((sum, suite) => sum + suite.cases.length, 0), detail: "Ordered suite membership" },
  { label: "Available cases", value: cases.value.length, detail: "Can be assigned to suites" },
  { label: "Latest run", value: lastRun.value?.status ?? "idle", detail: "Current suite signal" },
]);

const addableCases = computed(() => {
  const used = new Set(editableCases.value.map((testCase) => testCase.testCaseId));
  return cases.value.filter((testCase) => !used.has(testCase.id));
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
  } finally {
    isReady.value = true;
  }
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

async function deleteSuite() {
  if (!selected.value) return;
  await api.testSuites.remove(projectId, selected.value.id);
  selected.value = null;
  await load();
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

async function runSuite() {
  if (!selected.value) return;
  lastRun.value = await api.testSuites.run(projectId, selected.value.id, { environment: "local" });
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
