<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-bold">Settings</h2>
      <p class="text-sm text-muted-foreground">Model providers and project API keys.</p>
    </div>

    <Card class="p-4">
      <h3 class="font-semibold">Model providers</h3>
      <ul class="mt-3 divide-y border rounded">
        <li v-for="p in providers" :key="p.id" class="p-3">
          <div class="font-medium">{{ p.name }} ({{ p.kind }})</div>
          <div class="text-xs text-muted-foreground">{{ p.baseUrl }} · {{ p.status }}</div>
        </li>
        <li v-if="!providers.length" class="p-3 text-sm text-muted-foreground">No providers configured.</li>
      </ul>
    </Card>

    <Card class="p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">API Keys</h3>
          <p class="text-sm text-muted-foreground">
            Project-scoped keys for external programmatic access. Keys are shown only once at creation.
          </p>
        </div>
        <Button data-testid="new-api-key" @click="showKeyForm = !showKeyForm">
          {{ showKeyForm ? "Close" : "New key" }}
        </Button>
      </div>

      <div v-if="newKey" class="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4" data-testid="api-key-created">
        <div class="font-medium text-emerald-800">Key created — copy it now, it won't be shown again.</div>
        <code class="mt-2 block break-all rounded bg-white p-2 text-sm font-mono">{{ newKey }}</code>
        <Button class="mt-2" variant="outline" size="sm" @click="newKey = ''">Dismiss</Button>
      </div>

      <div v-if="showKeyForm" class="mt-4 grid gap-3 rounded-md border p-4">
        <Input v-model="keyDraft.name" data-testid="api-key-name" placeholder="Key name (e.g. CI Runner)" />
        <Button data-testid="create-api-key" :disabled="!keyDraft.name.trim()" @click="createKey">Create key</Button>
      </div>

      <div class="mt-4 overflow-hidden rounded-md border">
        <div class="grid grid-cols-[1fr_160px_140px_100px] bg-muted/60 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div>Name</div>
          <div>Prefix</div>
          <div>Last used</div>
          <div>Actions</div>
        </div>
        <div
          v-for="key in apiKeys"
          :key="key.id"
          class="grid grid-cols-[1fr_160px_140px_100px] items-center border-t px-3 py-3 text-sm"
        >
          <div class="font-medium">{{ key.name }}</div>
          <div class="font-mono text-xs text-muted-foreground">{{ key.keyPrefix }}…</div>
          <div class="text-xs text-muted-foreground">{{ key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "never" }}</div>
          <div>
            <Button variant="outline" size="sm" @click="revokeKey(key.id)">Revoke</Button>
          </div>
        </div>
        <div v-if="!apiKeys.length" class="p-4 text-sm text-muted-foreground">
          No API keys yet. Create one to enable external access to this project's API.
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import type { ModelProviderDto, ProjectApiKeyDto, ProjectApiKeyCreatedDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const providers = ref<ModelProviderDto[]>([]);
const apiKeys = ref<ProjectApiKeyDto[]>([]);
const showKeyForm = ref(false);
const keyDraft = ref({ name: "" });
const newKey = ref("");

onMounted(async () => {
  await loadProviders();
  await loadKeys();
});

async function loadProviders() {
  try {
    providers.value = await api.modelProviders.list(projectId);
  } catch {
    providers.value = [];
  }
}

async function loadKeys() {
  try {
    const result = await fetch(`${apiBase()}/projects/${projectId}/api-keys`, {
      headers: authHeaders(),
    });
    if (result.ok) {
      apiKeys.value = ((await result.json()) as ProjectApiKeyDto[]);
    }
  } catch {
    apiKeys.value = [];
  }
}

async function createKey() {
  const result = await fetch(`${apiBase()}/projects/${projectId}/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name: keyDraft.value.name.trim() }),
  });
  if (!result.ok) return;
  const created = (await result.json()) as ProjectApiKeyCreatedDto;
  newKey.value = created.plaintextKey;
  keyDraft.value = { name: "" };
  showKeyForm.value = false;
  await loadKeys();
}

async function revokeKey(keyId: string) {
  await fetch(`${apiBase()}/projects/${projectId}/api-keys/${keyId}/revoke`, {
    method: "POST",
    headers: authHeaders(),
  });
  await loadKeys();
}

function apiBase(): string {
  const viteBase = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.NUXT_PUBLIC_API_BASE;
  return viteBase ?? "http://localhost:3000/api/v1";
}

function authHeaders(): Record<string, string> {
  if (!import.meta.client) return {};
  const token = localStorage.getItem("crab.token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}
</script>
