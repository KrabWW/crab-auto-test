<template>
  <div class="space-y-4">
    <h2 class="font-bold">Executions</h2>
    <ul class="divide-y border rounded">
      <li v-for="e in executions" :key="e.id" class="p-3">
        <div class="font-medium">{{ e.environment }} · {{ e.status }}</div>
        <div class="text-xs text-muted-foreground">{{ e.startedAt }} · {{ e.artifacts.length }} artifacts</div>
      </li>
      <li v-if="!executions.length" class="p-3 text-sm text-muted-foreground">No executions yet.</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "~/composables/api";
import type { ExecutionDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const executions = ref<ExecutionDto[]>([]);
onMounted(async () => {
  executions.value = await api.executions.list(projectId);
});
</script>
