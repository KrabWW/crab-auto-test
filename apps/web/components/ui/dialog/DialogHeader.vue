<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "~/lib/utils";
</script>

<template>
  <div :class="cn('flex flex-col gap-2 text-center sm:text-left', $attrs.class as HTMLAttributes['class'])">
    <slot />
  </div>
</template>
