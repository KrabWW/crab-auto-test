<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold">{{ project?.name ?? "Project" }}</h1>
      <p class="text-sm text-muted-foreground">{{ project?.slug }}</p>
    </div>
    <nav class="flex gap-4 border-b">
      <NuxtLink :to="`/projects/${projectId}/test-cases`" class="pb-2">Test Cases</NuxtLink>
      <NuxtLink :to="`/projects/${projectId}/executions`" class="pb-2">Executions</NuxtLink>
      <NuxtLink :to="`/projects/${projectId}/ai-generation`" class="pb-2">AI Generation</NuxtLink>
      <NuxtLink :to="`/projects/${projectId}/knowledge`" class="pb-2">Knowledge</NuxtLink>
      <!-- MUST-3: API automation navigable placeholder route. Full suite = Phase 3. -->
      <NuxtLink :to="`/projects/${projectId}/api-automation`" class="pb-2">API Automation</NuxtLink>
      <NuxtLink :to="`/projects/${projectId}/settings`" class="pb-2">Settings</NuxtLink>
    </nav>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "~/composables/api";
import type { ProjectDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const project = ref<ProjectDto | null>(null);
try {
  project.value = await api.projects.get(projectId);
} catch {
  // 404 / forbidden handled by error page
}
</script>
