<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold">{{ project?.name ?? "Project" }}</h1>
        <p class="text-sm text-muted-foreground">{{ project?.slug }}</p>
      </div>
      <!-- Overview entry: renders the [id]/index.vue overview home. -->
      <NuxtLink
        :to="`/projects/${projectId}`"
        data-testid="nav-overview"
        class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        :class="{ 'text-foreground underline underline-offset-4': isOverviewActive }"
        aria-label="Project overview"
      >
        Overview
      </NuxtLink>
    </div>
    <ProjectWorkspaceNav :project-id="projectId" />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "~/composables/api";
import ProjectWorkspaceNav from "~/components/project/ProjectWorkspaceNav.vue";
import type { ProjectDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const isOverviewActive = computed(
  () => route.path.replace(/\/+$/, "") === `/projects/${projectId}`,
);
const project = ref<ProjectDto | null>(null);
try {
  project.value = await api.projects.get(projectId);
} catch {
  // 404 / forbidden handled by error page
}
</script>
