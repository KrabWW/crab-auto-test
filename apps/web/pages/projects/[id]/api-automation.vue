<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">HTTP Checks</p>
          <h2 class="text-xl font-bold">API Automation</h2>
          <p class="text-sm text-muted-foreground">
            Define project-scoped requests, reuse environments, run assertions, and review redacted reports.
          </p>
        </div>
        <Button :disabled="loading" @click="load">Refresh</Button>
      </div>
    </Card>

    <div class="grid gap-3 md:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label" class="p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ stat.label }}</div>
        <div class="mt-2 text-2xl font-semibold tabular-nums">{{ stat.value }}</div>
        <div class="mt-1 text-xs text-muted-foreground">{{ stat.detail }}</div>
      </Card>
    </div>

    <div class="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div class="flex flex-col gap-4">
        <Card class="p-4">
          <div>
            <h3 class="font-semibold">Environment</h3>
            <p class="text-sm text-muted-foreground">
              Variables are substituted as <code v-pre>{{name}}</code> when a case runs.
            </p>
          </div>
          <div class="mt-4 grid gap-3">
            <Input v-model="envDraft.name" placeholder="Environment name" />
            <div
              v-for="(variable, index) in envDraft.variables"
              :key="index"
              class="grid gap-2 rounded-md border p-3"
            >
              <Input v-model="variable.key" placeholder="Variable key" />
              <Input v-model="variable.value" placeholder="Variable value" :type="variable.secret ? 'password' : 'text'" />
              <label class="flex items-center gap-2 text-xs text-muted-foreground">
                <input v-model="variable.secret" type="checkbox" />
                Store as encrypted secret reference
              </label>
              <Button v-if="envDraft.variables.length > 1" variant="outline" size="sm" @click="removeEnvVariable(index)">
                Remove variable
              </Button>
            </div>
            <div class="flex gap-2">
              <Button variant="outline" @click="addEnvVariable">Add variable</Button>
              <Button :disabled="!canSaveEnvironment" @click="saveEnvironment">Save environment</Button>
            </div>
          </div>
        </Card>

        <Card class="overflow-hidden">
          <div class="border-b p-4">
            <h3 class="font-semibold">Environments</h3>
            <p class="text-sm text-muted-foreground">Secret values stay masked after saving.</p>
          </div>
          <button
            v-for="environment in environments"
            :key="environment.id"
            class="block w-full p-4 text-left transition hover:bg-muted/40"
            :class="selectedEnvironmentId === environment.id ? 'bg-accent/60' : ''"
            @click="selectedEnvironmentId = environment.id"
          >
            <div class="font-medium">{{ environment.name }}</div>
            <div class="mt-1 text-xs text-muted-foreground">
              {{ environment.variables.length }} variables / {{ maskedCount(environment) }} masked
            </div>
          </button>
          <div v-if="!environments.length" class="p-4 text-sm text-muted-foreground">No API environments yet.</div>
        </Card>
      </div>

      <div class="flex flex-col gap-4">
        <Card class="p-4">
          <div>
            <h3 class="font-semibold">Request Case</h3>
            <p class="text-sm text-muted-foreground">Requests execute on the API service; reports keep a redacted snapshot.</p>
          </div>

          <div class="mt-4 grid gap-3">
            <div class="grid gap-3 md:grid-cols-[160px_1fr]">
              <select v-model="caseDraft.method" class="h-10 rounded-md border bg-background px-3 text-sm" aria-label="HTTP method">
                <option v-for="method in methods" :key="method" :value="method">{{ method }}</option>
              </select>
              <Input v-model="caseDraft.name" placeholder="API case name" />
            </div>
            <Input v-model="caseDraft.url" placeholder="Request URL" />
            <textarea
              v-model="caseDraft.body"
              class="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Optional request body"
            />

            <div class="rounded-md border p-3">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h4 class="text-sm font-medium">Headers</h4>
                <Button variant="outline" size="sm" @click="addHeader">Add header</Button>
              </div>
              <div v-if="!caseDraft.headers.length" class="text-xs text-muted-foreground">No headers.</div>
              <div v-for="(header, index) in caseDraft.headers" :key="index" class="mb-2 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                <Input v-model="header.key" placeholder="Header name" />
                <Input v-model="header.value" placeholder="Header value" :type="header.secret ? 'password' : 'text'" />
                <label class="flex items-center gap-2 text-xs text-muted-foreground">
                  <input v-model="header.secret" type="checkbox" /> Secret
                </label>
                <Button variant="outline" size="sm" @click="removeHeader(index)">Remove</Button>
              </div>
            </div>

            <div class="rounded-md border p-3">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h4 class="text-sm font-medium">Assertions</h4>
                <Button variant="outline" size="sm" @click="addAssertion">Add assertion</Button>
              </div>
              <div v-for="(assertion, index) in caseDraft.assertions" :key="index" class="mb-2 grid gap-2 md:grid-cols-[120px_1fr_140px_1fr_auto]">
                <select v-model="assertion.source" class="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Assertion source">
                  <option value="status">status</option>
                  <option value="header">header</option>
                  <option value="body">body</option>
                </select>
                <Input v-model="assertion.target" placeholder="Target path/header" />
                <select v-model="assertion.operator" class="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Assertion operator">
                  <option value="equals">equals</option>
                  <option value="contains">contains</option>
                  <option value="exists">exists</option>
                  <option value="not-empty">not-empty</option>
                </select>
                <Input v-model="assertion.expected" placeholder="Expected value" />
                <Button variant="outline" size="sm" :disabled="caseDraft.assertions.length === 1" @click="removeAssertion(index)">Remove</Button>
              </div>
            </div>

            <div class="rounded-md border p-3">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h4 class="text-sm font-medium">Variable extraction</h4>
                <Button variant="outline" size="sm" @click="addExtraction">Add extraction</Button>
              </div>
              <div v-if="!caseDraft.extractions.length" class="text-xs text-muted-foreground">No extraction rules.</div>
              <div v-for="(extraction, index) in caseDraft.extractions" :key="index" class="mb-2 grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
                <Input v-model="extraction.name" placeholder="Variable name" />
                <select v-model="extraction.source" class="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Extraction source">
                  <option value="body">body</option>
                  <option value="header">header</option>
                </select>
                <Input v-model="extraction.path" placeholder="Path or header" />
                <Button variant="outline" size="sm" @click="removeExtraction(index)">Remove</Button>
              </div>
            </div>

            <Button :disabled="!canSaveCase" @click="saveCase">Save API case</Button>
          </div>
        </Card>

        <div class="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
          <Card class="overflow-hidden">
            <div class="border-b p-4">
              <h3 class="font-semibold">Case Library</h3>
              <p class="text-sm text-muted-foreground">Run a case with the selected environment.</p>
            </div>
            <button
              v-for="testCase in apiCases"
              :key="testCase.id"
              class="block w-full p-4 text-left transition hover:bg-muted/40"
              :class="selectedCaseId === testCase.id ? 'bg-accent/60' : ''"
              @click="selectedCaseId = testCase.id"
            >
              <div class="font-medium">{{ testCase.name }}</div>
              <div class="mt-1 text-xs text-muted-foreground">
                {{ testCase.method }} / {{ testCase.assertions.length }} assertions / {{ testCase.extractions.length }} extractions
              </div>
            </button>
            <div v-if="!apiCases.length" class="p-4 text-sm text-muted-foreground">No API cases yet.</div>
          </Card>

          <Card class="p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="font-semibold">Run & Report</h3>
                <p class="text-sm text-muted-foreground">Execution details are project-scoped and redact secrets.</p>
              </div>
              <Button :disabled="!selectedCaseId || running" @click="runSelectedCase">Run API case</Button>
            </div>

            <div v-if="latestExecution" class="mt-4 rounded-md border p-4" data-testid="api-run-report">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="font-medium">API run {{ latestExecution.status }}</div>
                  <div class="text-sm text-muted-foreground">
                    HTTP {{ latestExecution.responseStatus ?? "n/a" }} / {{ latestExecution.durationMs ?? 0 }} ms
                  </div>
                </div>
                <span class="rounded-full px-2 py-1 text-xs" :class="statusClass(latestExecution.status)">
                  {{ latestExecution.status }}
                </span>
              </div>

              <div class="mt-4 grid gap-2">
                <div
                  v-for="result in latestExecution.assertionResults"
                  :key="`${result.order}-${result.source}-${result.target ?? ''}`"
                  class="rounded-md bg-muted/50 p-3 text-sm"
                >
                  <div class="font-medium">
                    Assertion {{ result.order }}: {{ result.source }} {{ result.operator }} {{ result.expected ?? "" }}
                  </div>
                  <div class="text-muted-foreground">Actual: {{ result.actual ?? "(missing)" }} / {{ result.passed ? "passed" : "failed" }}</div>
                </div>
              </div>

              <div class="mt-4 rounded-md bg-muted/40 p-3 text-sm">
                <div class="font-medium">Extracted variables</div>
                <pre class="mt-2 overflow-auto text-xs">{{ JSON.stringify(latestExecution.extractedVariables, null, 2) }}</pre>
              </div>
            </div>

            <div v-else class="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Run a saved API case to see assertion results and extracted variables.
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import type {
  ApiAssertionOperator,
  ApiAssertionSource,
  ApiEnvironmentDto,
  ApiExecutionDto,
  ApiExecutionStatus,
  ApiExtractionSource,
  ApiHttpMethod,
  ApiTestCaseDto,
} from "@crab/shared-types";

type NamedDraft = { key: string; value: string; secret: boolean };
type AssertionDraft = {
  source: ApiAssertionSource;
  target: string;
  operator: ApiAssertionOperator;
  expected: string;
};
type ExtractionDraft = { name: string; source: ApiExtractionSource; path: string };

const route = useRoute();
const projectId = route.params.id as string;
const methods: ApiHttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const environments = ref<ApiEnvironmentDto[]>([]);
const apiCases = ref<ApiTestCaseDto[]>([]);
const executions = ref<ApiExecutionDto[]>([]);
const selectedEnvironmentId = ref("");
const selectedCaseId = ref("");
const latestExecution = ref<ApiExecutionDto | null>(null);
const loading = ref(false);
const running = ref(false);

const envDraft = ref({
  name: "Local API",
  variables: [{ key: "baseUrl", value: "http://localhost:3000", secret: false }] as NamedDraft[],
});

const caseDraft = ref({
  name: "",
  method: "GET" as ApiHttpMethod,
  url: "{{baseUrl}}/api/v1/auth/me",
  body: "",
  headers: [] as NamedDraft[],
  assertions: [{ source: "status", target: "", operator: "equals", expected: "401" }] as AssertionDraft[],
  extractions: [] as ExtractionDraft[],
});

const stats = computed(() => [
  { label: "Cases", value: apiCases.value.length, detail: "Saved HTTP checks" },
  { label: "Environments", value: environments.value.length, detail: "Project variable sets" },
  { label: "Runs", value: executions.value.length, detail: "Recorded API executions" },
  { label: "Last run", value: latestExecution.value?.status ?? "idle", detail: "Assertion rollup" },
]);

const canSaveEnvironment = computed(
  () => envDraft.value.name.trim().length > 0 && envDraft.value.variables.some((item) => item.key.trim()),
);
const canSaveCase = computed(
  () => caseDraft.value.name.trim().length > 0 && caseDraft.value.url.trim().length > 0 && caseDraft.value.assertions.length > 0,
);

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const [envRows, caseRows, executionRows] = await Promise.all([
      api.apiAutomation.listEnvironments(projectId),
      api.apiAutomation.listCases(projectId),
      api.apiAutomation.listExecutions(projectId),
    ]);
    environments.value = envRows;
    apiCases.value = caseRows;
    executions.value = executionRows;
    if (!selectedEnvironmentId.value) selectedEnvironmentId.value = envRows[0]?.id ?? "";
    if (!selectedCaseId.value) selectedCaseId.value = caseRows[0]?.id ?? "";
    latestExecution.value = executionRows[0] ?? latestExecution.value;
  } finally {
    loading.value = false;
  }
}

function addEnvVariable() {
  envDraft.value.variables.push({ key: "", value: "", secret: false });
}

function removeEnvVariable(index: number) {
  envDraft.value.variables.splice(index, 1);
}

function addHeader() {
  caseDraft.value.headers.push({ key: "", value: "", secret: false });
}

function removeHeader(index: number) {
  caseDraft.value.headers.splice(index, 1);
}

function addAssertion() {
  caseDraft.value.assertions.push({ source: "status", target: "", operator: "equals", expected: "200" });
}

function removeAssertion(index: number) {
  caseDraft.value.assertions.splice(index, 1);
}

function addExtraction() {
  caseDraft.value.extractions.push({ name: "", source: "body", path: "" });
}

function removeExtraction(index: number) {
  caseDraft.value.extractions.splice(index, 1);
}

async function saveEnvironment() {
  const environment = await api.apiAutomation.createEnvironment(projectId, {
    name: envDraft.value.name,
    variables: envDraft.value.variables
      .filter((item) => item.key.trim())
      .map((item) => ({ key: item.key, value: item.value, secret: item.secret })),
  });
  selectedEnvironmentId.value = environment.id;
  envDraft.value = { name: "Local API", variables: [{ key: "baseUrl", value: "http://localhost:3000", secret: false }] };
  await load();
}

async function saveCase() {
  const saved = await api.apiAutomation.createCase(projectId, {
    name: caseDraft.value.name,
    method: caseDraft.value.method,
    url: caseDraft.value.url,
    body: caseDraft.value.body || undefined,
    headers: caseDraft.value.headers
      .filter((item) => item.key.trim())
      .map((item) => ({ key: item.key, value: item.value, secret: item.secret })),
    assertions: caseDraft.value.assertions.map((assertion, index) => ({
      order: index + 1,
      source: assertion.source,
      target: assertion.target || undefined,
      operator: assertion.operator,
      expected: assertion.expected || undefined,
    })),
    extractions: caseDraft.value.extractions
      .filter((extraction) => extraction.name.trim() && extraction.path.trim())
      .map((extraction, index) => ({
        order: index + 1,
        name: extraction.name,
        source: extraction.source,
        path: extraction.path,
      })),
  });
  selectedCaseId.value = saved.id;
  caseDraft.value.name = "";
  await load();
}

async function runSelectedCase() {
  if (!selectedCaseId.value) return;
  running.value = true;
  try {
    latestExecution.value = await api.apiAutomation.runCase(projectId, selectedCaseId.value, {
      environmentId: selectedEnvironmentId.value || undefined,
    });
    await load();
  } finally {
    running.value = false;
  }
}

function maskedCount(environment: ApiEnvironmentDto) {
  return environment.variables.filter((variable) => variable.masked).length;
}

function statusClass(status: ApiExecutionStatus) {
  return {
    passed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
    error: "bg-amber-100 text-amber-800",
  }[status];
}
</script>
