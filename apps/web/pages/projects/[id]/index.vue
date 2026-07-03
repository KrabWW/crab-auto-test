<template>
  <div data-testid="project-overview" class="space-y-6">
    <div>
      <h1 data-testid="overview-heading" class="text-xl font-bold">
        {{ project?.name ?? "Project" }}
      </h1>
      <p class="text-sm text-muted-foreground">{{ project?.slug }}</p>
    </div>
    <ProjectOverview :project="project" :project-id="projectId" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "~/composables/api";
import ProjectOverview from "~/components/project/ProjectOverview.vue";
import type { ProjectDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const project = ref<ProjectDto | null>(null);
try {
  project.value = await api.projects.get(projectId);
} catch {
  // 404 / forbidden — ProjectOverview renders the not-found empty state.
}
</script>
