<template>
  <div class="space-y-4">
    <h2 class="font-bold">Settings</h2>
    <p class="text-sm text-muted-foreground">Model providers</p>
    <ul class="divide-y border rounded">
      <li v-for="p in providers" :key="p.id" class="p-3">
        <div class="font-medium">{{ p.name }} ({{ p.kind }})</div>
        <div class="text-xs text-muted-foreground">{{ p.baseUrl }} · {{ p.status }}</div>
      </li>
      <li v-if="!providers.length" class="p-3 text-sm text-muted-foreground">No providers configured.</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "~/composables/api";
import type { ModelProviderDto } from "@crab/shared-types";

const providers = ref<ModelProviderDto[]>([]);
onMounted(async () => {
  providers.value = await api.modelProviders.list();
});
</script>
