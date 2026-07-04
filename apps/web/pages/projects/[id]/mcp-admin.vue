<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Tool Governance</p>
          <h2 class="text-xl font-bold">MCP Admin</h2>
          <p class="text-sm text-muted-foreground">
            Register project-scoped MCP tools, review approvals, test calls, and inspect redacted call logs.
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

    <div v-if="error" class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {{ error }}
    </div>
    <div v-if="notice" class="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
      {{ notice }}
    </div>

    <div class="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div class="flex flex-col gap-4">
        <Card class="p-4">
          <h3 class="font-semibold">Register tool candidate</h3>
          <p class="text-sm text-muted-foreground">
            Candidates are scoped to this project and require owner review before they become callable.
          </p>
          <form class="mt-4 grid gap-3" @submit.prevent="createTool">
            <input
              name="toolName"
              data-testid="mcp-tool-name-input"
              class="h-10 rounded-md border bg-background px-3 text-sm"
              placeholder="Tool name, e.g. search_docs"
            />
            <input
              name="serverRef"
              data-testid="mcp-server-ref-input"
              class="h-10 rounded-md border bg-background px-3 text-sm"
              placeholder="MCP HTTP endpoint, e.g. http://localhost:9000/mcp"
            />
            <textarea
              name="description"
              class="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="What this tool may do for the project"
            />
            <Button data-testid="mcp-create-tool" :disabled="loading">Register candidate</Button>
          </form>
        </Card>

        <Card class="overflow-hidden">
          <div class="border-b p-4">
            <h3 class="font-semibold">Project tools</h3>
            <p class="text-sm text-muted-foreground">Allowlist state is derived from backend policy.</p>
          </div>
          <button
            v-for="tool in tools"
            :key="tool.id"
            class="block w-full p-4 text-left transition hover:bg-muted/40"
            :class="selectedId === tool.id ? 'bg-accent/60' : ''"
            @click="selectTool(tool.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ tool.toolName }}</span>
              <span class="rounded-full px-2 py-1 text-xs" :class="statusClass(tool.status)">
                {{ tool.status }}
              </span>
            </div>
            <div class="mt-1 truncate text-xs text-muted-foreground">{{ tool.serverRef }}</div>
            <div class="mt-2 text-xs" :class="tool.allowlisted ? 'text-emerald-700' : 'text-muted-foreground'">
              {{ tool.allowlisted ? "Allowlisted" : "Not allowlisted" }}
            </div>
          </button>
          <div v-if="!tools.length" class="p-4 text-sm text-muted-foreground">No MCP tools registered yet.</div>
        </Card>
      </div>

      <Card class="p-4">
        <div v-if="selected" class="grid gap-4" data-testid="mcp-tool-detail">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold">{{ selected.toolName }}</h3>
              <p class="break-all text-sm text-muted-foreground">{{ selected.serverRef }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                data-testid="mcp-review-tool"
                :disabled="selected.status !== 'proposed' || loading"
                @click="reviewTool"
              >
                Mark reviewed
              </Button>
              <Button
                data-testid="mcp-approve-tool"
                :disabled="selected.status !== 'reviewed' || loading"
                @click="approveTool"
              >
                Approve
              </Button>
              <Button
                variant="outline"
                data-testid="mcp-revoke-tool"
                :disabled="selected.status === 'revoked' || loading"
                @click="revokeTool"
              >
                Revoke
              </Button>
            </div>
          </div>

          <div class="grid gap-3 rounded-md border p-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 class="font-medium">Test call</h4>
                <p class="text-sm text-muted-foreground">
                  Uses the same allowlist predicate as production orchestration.
                </p>
              </div>
              <Button data-testid="mcp-test-call" :disabled="loading" @click="testCall">Run test call</Button>
            </div>
            <textarea
              v-model="argsText"
              class="min-h-28 rounded-md border bg-background px-3 py-2 font-mono text-xs"
              placeholder='{ "query": "smoke" }'
            />
            <div v-if="lastCall" data-testid="mcp-call-status" class="rounded-md bg-muted/50 p-3 text-sm">
              <div class="font-medium">Result: {{ lastCall.status }} / approved={{ lastCall.approved }}</div>
              <pre class="mt-2 overflow-auto text-xs">{{ JSON.stringify(lastCall.resultMeta, null, 2) }}</pre>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2" data-testid="mcp-history">
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Admin actions</h4>
              <div v-if="!history?.actions.length" class="mt-3 text-sm text-muted-foreground">No actions yet.</div>
              <div v-for="action in history?.actions ?? []" :key="action.id" class="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                <div class="font-medium">{{ action.action }} -> {{ action.toStatus }}</div>
                <div class="text-xs text-muted-foreground">
                  {{ new Date(action.createdAt).toLocaleString() }} / {{ action.actorId }}
                </div>
              </div>
            </div>
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Tool-call log</h4>
              <div v-if="!history?.calls.length" class="mt-3 text-sm text-muted-foreground">No calls yet.</div>
              <div v-for="call in history?.calls ?? []" :key="call.id" class="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium">{{ call.status }}</span>
                  <span class="text-xs text-muted-foreground">approved={{ call.approved }}</span>
                </div>
                <div class="text-xs text-muted-foreground">{{ new Date(call.startedAt).toLocaleString() }}</div>
                <pre class="mt-2 max-h-32 overflow-auto text-xs">{{ JSON.stringify(call.argsRedacted ?? {}, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          Select or register an MCP tool to review approval state, run a test call, and inspect history.
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type {
  McpToolCallResultDto,
  McpToolDto,
  McpToolHistoryDto,
  McpToolStatus,
} from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;

const loading = ref(false);
const error = ref("");
const notice = ref("");
const tools = ref<McpToolDto[]>([]);
const selectedId = ref("");
const history = ref<McpToolHistoryDto | null>(null);
const lastCall = ref<McpToolCallResultDto | null>(null);
const argsText = ref('{\n  "query": "smoke"\n}');

const selected = computed(() => tools.value.find((tool) => tool.id === selectedId.value) ?? null);
const stats = computed(() => [
  { label: "Tools", value: tools.value.length, detail: "Registered candidates" },
  { label: "Reviewed", value: countStatus("reviewed"), detail: "Ready for approval" },
  { label: "Approved", value: countStatus("approved"), detail: "Allowlist enabled" },
  { label: "Revoked", value: countStatus("revoked"), detail: "Blocked by policy" },
]);

onMounted(load);

async function load() {
  await run(async () => {
    tools.value = await api.mcp.listTools(projectId);
    if (!tools.value.some((tool) => tool.id === selectedId.value)) selectedId.value = tools.value[0]?.id ?? "";
    await loadHistory();
  });
}

async function selectTool(id: string) {
  selectedId.value = id;
  lastCall.value = null;
  await loadHistory();
}

async function createTool(event: Event) {
  if (!(event.currentTarget instanceof HTMLFormElement)) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const toolName = String(formData.get("toolName") ?? "").trim();
  const serverRef = String(formData.get("serverRef") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  await run(async () => {
    const created = await api.mcp.createTool(projectId, {
      toolName,
      serverRef,
      description: description || undefined,
    });
    form?.reset();
    selectedId.value = created.id;
    notice.value = "Tool candidate registered.";
    tools.value = await api.mcp.listTools(projectId);
    await loadHistory();
  });
}

async function reviewTool() {
  if (!selected.value) return;
  await mutateSelected(() => api.mcp.reviewTool(projectId, selected.value!.id), "Tool marked reviewed.");
}

async function approveTool() {
  if (!selected.value) return;
  await mutateSelected(() => api.mcp.approveTool(projectId, selected.value!.id), "Tool approved and allowlisted.");
}

async function revokeTool() {
  if (!selected.value) return;
  await mutateSelected(() => api.mcp.revokeTool(projectId, selected.value!.id), "Tool revoked and removed from allowlist.");
}

async function testCall() {
  if (!selected.value) return;
  await run(async () => {
    const parsed = parseArgs();
    lastCall.value = await api.mcp.testTool(projectId, selected.value!.id, { args: parsed });
    notice.value = `Test call finished: ${lastCall.value.status}.`;
    await loadHistory();
  });
}

async function mutateSelected(fn: () => Promise<McpToolDto>, message: string) {
  await run(async () => {
    const updated = await fn();
    selectedId.value = updated.id;
    notice.value = message;
    tools.value = await api.mcp.listTools(projectId);
    await loadHistory();
  });
}

async function loadHistory() {
  history.value = selectedId.value ? await api.mcp.history(projectId, selectedId.value) : null;
}

async function run(fn: () => Promise<void>) {
  loading.value = true;
  error.value = "";
  notice.value = "";
  try {
    await fn();
  } catch (err) {
    error.value = (err as Error).message || "MCP operation failed";
  } finally {
    loading.value = false;
  }
}

function parseArgs(): Record<string, unknown> {
  try {
    const parsed = argsText.value.trim() ? JSON.parse(argsText.value) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Test-call args must be a JSON object");
  }
}

function countStatus(status: McpToolStatus) {
  return tools.value.filter((tool) => tool.status === status).length;
}

function statusClass(status: McpToolStatus) {
  return {
    proposed: "bg-slate-100 text-slate-700",
    reviewed: "bg-blue-100 text-blue-700",
    approved: "bg-emerald-100 text-emerald-700",
    revoked: "bg-rose-100 text-rose-700",
  }[status];
}
</script>
