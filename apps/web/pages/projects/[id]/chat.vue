<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Project AI</p>
          <h2 class="text-xl font-bold">AI Chat</h2>
          <p class="text-sm text-muted-foreground">
            Backend-owned chat with selected project context, optional knowledge retrieval, visible activity records, and persisted outputs.
          </p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" :disabled="loading" @click="load">Refresh</Button>
          <Button data-testid="new-chat" :disabled="!chatProviders.length" @click="createSession">New chat</Button>
        </div>
      </div>
      <p v-if="!chatProviders.length" class="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Configure and validate a chat model provider in Settings before starting chat.
      </p>
    </Card>

    <div class="grid gap-4 xl:grid-cols-[320px_1fr_320px]">
      <Card class="overflow-hidden">
        <div class="border-b p-4">
          <h3 class="font-semibold">Sessions</h3>
          <p class="text-sm text-muted-foreground">Persisted project conversations.</p>
        </div>
        <button
          v-for="session in sessions"
          :key="session.id"
          class="block w-full border-b p-4 text-left transition hover:bg-muted/40"
          :class="session.id === selectedSessionId ? 'bg-accent/60' : ''"
          @click="selectSession(session.id)"
        >
          <div class="font-medium">{{ session.title }}</div>
          <div class="mt-1 text-xs text-muted-foreground">{{ session.messages.length }} messages</div>
        </button>
        <div v-if="!sessions.length" class="p-4 text-sm text-muted-foreground">No chat sessions yet.</div>
      </Card>

      <Card class="flex min-h-[620px] flex-col">
        <div class="border-b p-4">
          <div class="grid gap-3 md:grid-cols-2">
            <label class="grid gap-1 text-sm">
              <span class="font-medium">Provider</span>
              <select v-model="providerId" data-testid="chat-provider" class="h-10 rounded-md border bg-background px-3">
                <option v-for="provider in chatProviders" :key="provider.id" :value="provider.id">
                  {{ provider.name }} / {{ provider.modelName }}
                </option>
              </select>
            </label>
            <label class="flex items-end gap-2 text-sm">
              <input v-model="ragEnabled" data-testid="chat-rag-toggle" type="checkbox" class="h-4 w-4" />
              <span>Use knowledge retrieval for this message</span>
            </label>
          </div>
          <div class="mt-3">
            <div class="mb-2 text-sm font-medium">Context</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in contextOptions"
                :key="`${option.kind}:${option.id}`"
                type="button"
                class="rounded-full border px-3 py-1 text-xs transition"
                :class="isContextSelected(option) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'"
                @click="toggleContext(option)"
              >
                {{ option.label }}
              </button>
              <span v-if="!contextOptions.length" class="text-xs text-muted-foreground">Approved requirements and test cases appear here.</span>
            </div>
          </div>
        </div>

        <div class="flex-1 space-y-3 overflow-auto p-4" data-testid="chat-messages">
          <div
            v-for="message in selectedSession?.messages ?? []"
            :key="message.id"
            class="rounded-lg border p-3"
            :class="message.role === 'assistant' ? 'bg-muted/40' : 'bg-background'"
          >
            <div class="mb-1 text-xs font-semibold uppercase text-muted-foreground">{{ message.role }}</div>
            <p class="whitespace-pre-wrap text-sm">{{ message.content }}</p>
            <div v-if="message.sourceAttribution.length" class="mt-2 text-xs text-muted-foreground">
              Sources:
              <span v-for="source in message.sourceAttribution" :key="source.chunkId" class="mr-2">
                {{ source.filename ?? source.chunkId }}
              </span>
            </div>
          </div>
          <div v-if="!selectedSession" class="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Create or select a chat session to begin.
          </div>
        </div>

        <form class="border-t p-4" @submit.prevent="sendMessage">
          <textarea
            v-model="draft"
            data-testid="chat-input"
            class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Ask about this project's requirements, tests, or knowledge..."
          />
          <div class="mt-2 flex justify-end">
            <Button data-testid="send-chat" :disabled="!canSend">Send</Button>
          </div>
        </form>
      </Card>

      <div class="flex flex-col gap-4">
        <Card class="p-4">
          <h3 class="font-semibold">Activity records</h3>
          <div data-testid="chat-activities" class="mt-3 space-y-2">
            <div v-for="activity in selectedSession?.activities ?? []" :key="activity.id" class="rounded-md border p-2 text-sm">
              <div class="font-medium">{{ activity.name }}</div>
              <div class="text-xs text-muted-foreground">{{ activity.type }} / {{ activity.status }}</div>
            </div>
            <div v-if="!(selectedSession?.activities.length)" class="text-sm text-muted-foreground">No activity yet.</div>
          </div>
        </Card>

        <Card class="p-4">
          <h3 class="font-semibold">Generated artifacts</h3>
          <div data-testid="chat-artifacts" class="mt-3 space-y-2">
            <div v-for="artifact in selectedSession?.artifacts ?? []" :key="artifact.id" class="rounded-md border p-2 text-sm">
              <div class="font-medium">{{ artifact.title }}</div>
              <div class="line-clamp-3 text-xs text-muted-foreground">{{ artifact.content }}</div>
            </div>
            <div v-if="!(selectedSession?.artifacts.length)" class="text-sm text-muted-foreground">Assistant outputs persist here.</div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { ChatContextOptionDto, ChatContextRef, ChatSessionDto, ModelProviderDto } from "@crab/shared-types";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

const route = useRoute();
const projectId = route.params.id as string;

const loading = ref(false);
const sessions = ref<ChatSessionDto[]>([]);
const providers = ref<ModelProviderDto[]>([]);
const contextOptions = ref<ChatContextOptionDto[]>([]);
const selectedSessionId = ref("");
const providerId = ref("");
const ragEnabled = ref(false);
const draft = ref("");
const selectedContext = ref<ChatContextRef[]>([]);

const chatProviders = computed(() => providers.value.filter((provider) => provider.kind === "chat" && provider.status === "valid"));
const selectedSession = computed(() => sessions.value.find((session) => session.id === selectedSessionId.value) ?? null);
const canSend = computed(() => Boolean(selectedSession.value && draft.value.trim() && providerId.value));

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const [sessionList, providerList, contextList] = await Promise.all([
      api.chat.listSessions(projectId),
      api.modelProviders.list(projectId),
      api.chat.contextOptions(projectId),
    ]);
    sessions.value = sessionList;
    providers.value = providerList;
    contextOptions.value = contextList;
    if (!providerId.value) providerId.value = chatProviders.value[0]?.id ?? "";
    if (!selectedSessionId.value) selectedSessionId.value = sessions.value[0]?.id ?? "";
  } finally {
    loading.value = false;
  }
}

function selectSession(id: string) {
  selectedSessionId.value = id;
  const session = selectedSession.value;
  if (session) providerId.value = session.providerId;
}

async function createSession() {
  const session = await api.chat.createSession(projectId, { providerId: providerId.value || undefined });
  sessions.value = [session, ...sessions.value.filter((item) => item.id !== session.id)];
  selectedSessionId.value = session.id;
  providerId.value = session.providerId;
}

async function sendMessage() {
  if (!selectedSession.value) return;
  const updated = await api.chat.sendMessage(projectId, selectedSession.value.id, {
    content: draft.value,
    providerId: providerId.value,
    ragEnabled: ragEnabled.value,
    contextRefs: selectedContext.value,
  });
  sessions.value = [updated, ...sessions.value.filter((item) => item.id !== updated.id)];
  selectedSessionId.value = updated.id;
  draft.value = "";
}

function isContextSelected(option: ChatContextOptionDto) {
  return selectedContext.value.some((item) => item.kind === option.kind && item.id === option.id);
}

function toggleContext(option: ChatContextOptionDto) {
  if (isContextSelected(option)) {
    selectedContext.value = selectedContext.value.filter((item) => !(item.kind === option.kind && item.id === option.id));
    return;
  }
  selectedContext.value = [...selectedContext.value, { kind: option.kind, id: option.id }];
}
</script>
