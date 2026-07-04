<template>
  <div class="space-y-4">
    <h2 class="font-bold">AI Test Generation</h2>
    <p class="text-sm text-muted-foreground">
      Select an approved requirement; AI drafts test cases for review.
    </p>
    <div class="rounded-md border border-dashed p-4 text-sm">
      <div class="font-medium">Requirement-first path</div>
      <p class="mt-1 text-muted-foreground">
        Create, review, and approve a requirement first. Then generate draft cases from that approved version.
      </p>
      <NuxtLink :to="`/projects/${projectId}/requirements`" class="mt-3 inline-block rounded border px-3 py-1.5">
        Go to Requirements
      </NuxtLink>
    </div>
    <form class="space-y-3" @submit.prevent="onGenerate">
      <label class="grid gap-1 text-sm">
        <span class="font-medium">Approved requirement input</span>
        <select v-model="requirementVersionId" class="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Approved requirement">
          <option value="">Fallback: paste requirement text</option>
          <option v-for="version in approvedVersions" :key="version.id" :value="version.id">
            {{ version.title }} / v{{ version.version }}
          </option>
        </select>
      </label>
      <textarea
        v-model="requirement"
        placeholder="Paste a requirement..."
        class="min-h-24 w-full rounded border px-3 py-2"
        :disabled="!!requirementVersionId"
      />
      <button class="rounded bg-primary px-3 py-1.5 text-primary-foreground" :disabled="loading || !canGenerate">
        {{ loading ? "Generating..." : "Generate draft cases" }}
      </button>
    </form>
    <div v-if="run" class="space-y-2 rounded border p-4">
      <div class="text-sm">Status: <span class="font-medium">{{ run.status }}</span></div>
      <div v-if="run.requirementVersionId" class="text-xs text-muted-foreground">
        Linked requirement version: {{ run.requirementVersionId }}
      </div>
      <div v-for="(d, i) in run.draftCases" :key="i" class="border-t pt-2">
        <div class="font-medium">{{ d.title }}</div>
        <div class="text-xs text-muted-foreground">{{ d.priority }} / {{ d.steps.length }} steps</div>
      </div>
      <div v-if="run.status === 'awaiting-approval'" class="flex gap-2 pt-2">
        <button class="rounded bg-primary px-3 py-1.5 text-primary-foreground" @click="approve">Accept & persist</button>
        <button class="rounded border px-3 py-1.5" @click="reject">Reject</button>
      </div>
      <NuxtLink
        v-if="run.status === 'accepted' || run.status === 'completed'"
        :to="`/projects/${projectId}/test-cases`"
        class="inline-block rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
      >
        Open saved test cases
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "~/composables/api";
import type { AiWorkflowRunDto, RequirementVersionDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const requirement = ref("");
const requirementVersionId = ref("");
const approvedVersions = ref<RequirementVersionDto[]>([]);
const run = ref<AiWorkflowRunDto | null>(null);
const loading = ref(false);

const canGenerate = computed(() => !!requirementVersionId.value || requirement.value.trim().length > 0);

onMounted(async () => {
  approvedVersions.value = await api.requirements.approvedVersions(projectId);
  const requestedVersionId = route.query.requirementVersionId;
  if (typeof requestedVersionId === "string" && approvedVersions.value.some((version) => version.id === requestedVersionId)) {
    requirementVersionId.value = requestedVersionId;
  }
});

async function onGenerate() {
  loading.value = true;
  try {
    run.value = await api.ai.start(
      projectId,
      requirementVersionId.value
        ? { requirementVersionId: requirementVersionId.value }
        : { requirementText: requirement.value },
    );
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
