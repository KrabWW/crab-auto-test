<template>
  <div class="space-y-4">
    <h2 class="font-bold">AI Test Generation</h2>
    <p class="text-sm text-muted-foreground">
      Submit a requirement; AI drafts test cases. You review before they become canonical.
    </p>
    <form class="space-y-2" @submit.prevent="onGenerate">
      <textarea v-model="requirement" placeholder="Paste a requirement..." class="w-full px-3 py-2 border rounded min-h-24" />
      <button class="px-3 py-1.5 rounded bg-primary text-primary-foreground" :disabled="loading">
        {{ loading ? "Generating..." : "Generate draft cases" }}
      </button>
    </form>
    <div v-if="run" class="border rounded p-4 space-y-2">
      <div class="text-sm">Status: <span class="font-medium">{{ run.status }}</span></div>
      <div v-for="(d, i) in run.draftCases" :key="i" class="border-t pt-2">
        <div class="font-medium">{{ d.title }}</div>
        <div class="text-xs text-muted-foreground">{{ d.priority }} · {{ d.steps.length }} steps</div>
      </div>
      <div v-if="run.status === 'awaiting-approval'" class="flex gap-2 pt-2">
        <button class="px-3 py-1.5 rounded bg-primary text-primary-foreground" @click="approve">Accept & persist</button>
        <button class="px-3 py-1.5 rounded border" @click="reject">Reject</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "~/composables/api";
import type { AiWorkflowRunDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const requirement = ref("");
const run = ref<AiWorkflowRunDto | null>(null);
const loading = ref(false);

async function onGenerate() {
  loading.value = true;
  try {
    run.value = await api.ai.start(projectId, { requirementText: requirement.value });
  } finally {
    loading.value = false;
  }
}
async function approve() {
  if (!run.value) return;
  run.value = await api.ai.approve(projectId, run.value.id);
}
async function reject() {
  if (!run.value) return;
  run.value = await api.ai.reject(projectId, run.value.id);
}
</script>
