<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Skills Store</p>
          <h2 class="text-xl font-bold">Skills Management</h2>
          <p class="text-sm text-muted-foreground">
            Install project skills, review permissions, control activation, and inspect invocation records.
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

    <div class="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div class="flex flex-col gap-4">
        <Card class="p-4">
          <h3 class="font-semibold">Install skill package</h3>
          <p class="text-sm text-muted-foreground">
            The browser computes the checksum for the submitted payload before install.
          </p>
          <form class="mt-4 grid gap-3" @submit.prevent="installSkill">
            <div class="grid gap-3 sm:grid-cols-2">
              <input data-testid="skills-name" name="name" class="h-10 rounded-md border bg-background px-3 text-sm" placeholder="Name, e.g. case-enricher" />
              <input data-testid="skills-version" name="version" class="h-10 rounded-md border bg-background px-3 text-sm" placeholder="Version, e.g. 1.0.0" />
            </div>
            <input data-testid="skills-description" name="description" class="h-10 rounded-md border bg-background px-3 text-sm" placeholder="Description" />
            <div class="grid gap-3 sm:grid-cols-2">
              <input data-testid="skills-author" name="author" class="h-10 rounded-md border bg-background px-3 text-sm" placeholder="Author" />
              <input data-testid="skills-source" name="source" class="h-10 rounded-md border bg-background px-3 text-sm" placeholder="Source, e.g. local" />
            </div>
            <textarea
              data-testid="skills-permissions"
              name="permissions"
              class="min-h-24 rounded-md border bg-background px-3 py-2 font-mono text-xs"
              placeholder='{ "entryPoints": ["enrich-cases"], "network": ["read"] }'
            />
            <textarea
              data-testid="skills-entry-points"
              name="entryPoints"
              class="min-h-24 rounded-md border bg-background px-3 py-2 font-mono text-xs"
              placeholder='{ "enrich-cases": { "adapter": "langgraph" } }'
            />
            <textarea
              data-testid="skills-payload"
              name="payload"
              class="min-h-20 rounded-md border bg-background px-3 py-2 font-mono text-xs"
              placeholder="Optional package payload; defaults to name@version"
            />
            <button
              type="submit"
              data-testid="skills-install"
              class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              :disabled="loading || !ready"
            >
              Install skill
            </button>
          </form>
        </Card>

        <Card class="overflow-hidden">
          <div class="border-b p-4">
            <h3 class="font-semibold">Project skills</h3>
            <p class="text-sm text-muted-foreground">Installations are scoped to this project.</p>
          </div>
          <button
            v-for="installation in installations"
            :key="installation.id"
            class="block w-full p-4 text-left transition hover:bg-muted/40"
            :class="selectedId === installation.id ? 'bg-accent/60' : ''"
            @click="selectInstallation(installation.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ installation.skill.name }}</span>
              <span class="rounded-full px-2 py-1 text-xs" :class="stateClass(installation.state)">
                {{ installation.state }}
              </span>
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              v{{ installation.skill.version }} / {{ installation.skill.validationStatus }} / {{ installation.invocationCount }} calls
            </div>
            <div class="mt-1 truncate text-xs text-muted-foreground">{{ installation.skill.source }}</div>
          </button>
          <div v-if="!installations.length" class="p-4 text-sm text-muted-foreground">No skills installed yet.</div>
        </Card>
      </div>

      <Card class="p-4">
        <div v-if="selected" class="grid gap-4" data-testid="skills-detail">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold">{{ selected.skill.name }}</h3>
              <p class="text-sm text-muted-foreground">
                {{ selected.skill.description }} / v{{ selected.skill.version }} by {{ selected.skill.author }}
              </p>
              <span data-testid="skills-state" class="mt-2 inline-flex rounded-full px-2 py-1 text-xs" :class="stateClass(selected.state)">
                {{ selected.state }}
              </span>
              <p class="mt-1 break-all text-xs text-muted-foreground">Checksum: {{ selected.installedChecksum }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                data-testid="skills-enable"
                :disabled="selected.state === 'installed' || loading"
                @click="enableSelected"
              >
                Enable
              </Button>
              <Button
                variant="outline"
                data-testid="skills-disable"
                :disabled="selected.state !== 'installed' || loading"
                @click="disableSelected"
              >
                Disable
              </Button>
              <Button
                variant="outline"
                data-testid="skills-uninstall"
                :disabled="selected.state === 'uninstalled' || loading"
                @click="uninstallSelected"
              >
                Uninstall
              </Button>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Requested permissions</h4>
              <pre data-testid="skills-requested-permissions" class="mt-3 max-h-64 overflow-auto rounded bg-muted/40 p-3 text-xs">{{ pretty(selected.skill.permissions) }}</pre>
            </div>
            <div class="rounded-md border p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="font-medium">Activated permissions</h4>
                <Button data-testid="skills-approve-permissions" size="sm" :disabled="loading" @click="approvePermissions">
                  Approve permissions
                </Button>
              </div>
              <textarea
                v-model="approvalText"
                data-testid="skills-permissions-editor"
                class="mt-3 min-h-40 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Entry points</h4>
              <pre class="mt-3 max-h-56 overflow-auto rounded bg-muted/40 p-3 text-xs">{{ pretty(selected.skill.entryPoints) }}</pre>
            </div>
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Compatibility</h4>
              <pre class="mt-3 max-h-56 overflow-auto rounded bg-muted/40 p-3 text-xs">{{ pretty(selected.skill.compatibility) }}</pre>
            </div>
          </div>

          <div class="rounded-md border p-3" data-testid="skills-invocations">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 class="font-medium">Invocation records</h4>
                <p class="text-sm text-muted-foreground">Redacted adapter calls for this installation.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" :disabled="loading" @click="testInvokeSelected">Run test invocation</Button>
                <Button size="sm" variant="outline" :disabled="loading" @click="loadInvocations">Refresh records</Button>
              </div>
            </div>
            <div v-if="!invocations.length" class="mt-3 text-sm text-muted-foreground">No invocations yet.</div>
            <div v-for="invocation in invocations" :key="invocation.id" class="mt-3 rounded-md bg-muted/40 p-3 text-sm">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-medium">{{ invocation.adapter }} / {{ invocation.status }}</span>
                <span class="text-xs text-muted-foreground">{{ new Date(invocation.invokedAt).toLocaleString() }}</span>
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                run={{ invocation.runId ?? "-" }} / worker={{ invocation.workerJobRef ?? "-" }}
              </div>
              <pre class="mt-2 max-h-36 overflow-auto text-xs">{{ pretty({ permissionsUsed: invocation.permissionsUsed, args: invocation.argsRedacted, result: invocation.resultMeta }) }}</pre>
            </div>
          </div>
        </div>

        <div v-else class="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          Select or install a Skill to review permissions, control activation, and inspect invocation records.
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
import type { SkillInstallationDto, SkillInvocationDto, SkillInstallationState } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;

const loading = ref(false);
const ready = ref(false);
const error = ref("");
const notice = ref("");
const installations = ref<SkillInstallationDto[]>([]);
const selectedId = ref("");
const invocations = ref<SkillInvocationDto[]>([]);
const approvalText = ref("{}");

const selected = computed(() => installations.value.find((installation) => installation.id === selectedId.value) ?? null);
const stats = computed(() => [
  { label: "Installed", value: countState("installed"), detail: "Active skills" },
  { label: "Disabled", value: countState("disabled"), detail: "Paused skills" },
  { label: "Uninstalled", value: countState("uninstalled"), detail: "Removed from active use" },
  { label: "Invocations", value: installations.value.reduce((sum, item) => sum + item.invocationCount, 0), detail: "Recorded calls" },
]);

onMounted(() => {
  ready.value = true;
  void load();
});

async function load() {
  await run(async () => {
    installations.value = await api.skills.list(projectId);
    if (!installations.value.some((installation) => installation.id === selectedId.value)) {
      selectedId.value = installations.value[0]?.id ?? "";
    }
    syncApprovalText();
    await loadInvocations();
  });
}

async function selectInstallation(id: string) {
  selectedId.value = id;
  syncApprovalText();
  await loadInvocations();
}

async function installSkill(event: Event) {
  if (!(event.currentTarget instanceof HTMLFormElement)) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const name = field(formData, "name");
  const version = field(formData, "version");
  const payload = field(formData, "payload") || `${name}@${version}`;
  await run(async () => {
    const installed = await api.skills.install(projectId, {
      name,
      version,
      description: field(formData, "description"),
      author: field(formData, "author"),
      source: field(formData, "source") || "local",
      compatibility: {},
      permissions: parseJsonField(formData, "permissions"),
      entryPoints: parseJsonField(formData, "entryPoints"),
      payload,
      checksum: await sha256Hex(payload),
    });
    form.reset();
    selectedId.value = installed.id;
    notice.value = "Skill installed.";
    installations.value = await api.skills.list(projectId);
    syncApprovalText();
    await loadInvocations();
  });
}

async function approvePermissions() {
  if (!selected.value) return;
  await mutateSelected(
    () => api.skills.approvePermissions(projectId, selected.value!.id, { permissions: parseJson(approvalText.value) }),
    "Permissions approved.",
  );
}

async function enableSelected() {
  if (!selected.value) return;
  await mutateSelected(() => api.skills.enable(projectId, selected.value!.id), "Skill enabled.");
}

async function disableSelected() {
  if (!selected.value) return;
  await mutateSelected(() => api.skills.disable(projectId, selected.value!.id), "Skill disabled.");
}

async function uninstallSelected() {
  if (!selected.value) return;
  await mutateSelected(() => api.skills.uninstall(projectId, selected.value!.id), "Skill uninstalled.");
}

async function mutateSelected(fn: () => Promise<SkillInstallationDto>, message: string) {
  await run(async () => {
    const updated = await fn();
    selectedId.value = updated.id;
    notice.value = message;
    installations.value = await api.skills.list(projectId);
    syncApprovalText();
    await loadInvocations();
  });
}

async function loadInvocations() {
  invocations.value = selectedId.value ? await api.skills.invocations(projectId, selectedId.value) : [];
}

async function testInvokeSelected() {
  if (!selected.value) return;
  await run(async () => {
    invocations.value = await api.skills.testInvoke(projectId, selected.value!.id, {
      args: { source: "skills-management-ui", skillName: selected.value!.skill.name },
    });
    installations.value = await api.skills.list(projectId);
    notice.value = "Test invocation recorded.";
  });
}

async function run(fn: () => Promise<void>) {
  loading.value = true;
  error.value = "";
  notice.value = "";
  try {
    await fn();
  } catch (err) {
    error.value = (err as Error).message || "Skill operation failed";
  } finally {
    loading.value = false;
  }
}

function syncApprovalText() {
  const value = selected.value?.activatedPermissions ?? defaultApproval(selected.value);
  approvalText.value = JSON.stringify(value, null, 2);
}

function defaultApproval(installation: SkillInstallationDto | null): Record<string, unknown> {
  if (!installation) return {};
  const entryPoints = Object.keys(installation.skill.entryPoints);
  return { ...installation.skill.permissions, entryPoints };
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseJsonField(formData: FormData, name: string): Record<string, unknown> {
  const raw = field(formData, name);
  return raw ? parseJson(raw) : {};
}

function parseJson(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
  return parsed as Record<string, unknown>;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function countState(state: SkillInstallationState) {
  return installations.value.filter((installation) => installation.state === state).length;
}

function stateClass(state: SkillInstallationState) {
  return {
    installed: "bg-emerald-100 text-emerald-700",
    disabled: "bg-amber-100 text-amber-700",
    uninstalled: "bg-slate-100 text-slate-700",
  }[state];
}
</script>
