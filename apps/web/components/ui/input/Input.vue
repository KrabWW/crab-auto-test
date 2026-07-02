<script setup lang="ts">
import { cn } from "~/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<{ class?: HTMLAttributes["class"]; type?: string; placeholder?: string; modelValue?: string }>();
const emits = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <input
    :type="props.type ?? 'text'"
    :placeholder="placeholder"
    :value="modelValue"
    @input="emits('update:modelValue', ($event.target as HTMLInputElement).value)"
    :class="cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', props.class)"
  />
</template>
