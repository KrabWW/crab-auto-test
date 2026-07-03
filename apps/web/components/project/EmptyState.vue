<script setup lang="ts">
import { Card } from "~/components/ui/card";

defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <Card
    data-testid="empty-state"
    role="status"
    class="flex flex-col items-center justify-center gap-3 p-8 text-center"
  >
    <div class="text-base font-medium text-foreground">{{ title }}</div>
    <p v-if="description" class="text-sm text-muted-foreground max-w-md">
      {{ description }}
    </p>
    <slot />
  </Card>
</template>
