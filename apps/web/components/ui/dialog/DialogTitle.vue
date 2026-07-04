<script setup lang="ts">
import { DialogTitle, type DialogTitleProps } from "radix-vue";
import { cn } from "~/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes["class"] }>();
</script>

<template>
  <DialogTitle :class="cn('text-base font-semibold text-foreground', props.class)">
    <slot />
  </DialogTitle>
</template>
