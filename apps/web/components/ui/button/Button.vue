<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "radix-vue";
import { cn } from "~/lib/utils";
import { buttonVariants, type ButtonVariants } from ".";
import type { HTMLAttributes } from "vue";

const props = withDefaults(
  defineProps<PrimitiveProps & {
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    class?: HTMLAttributes["class"];
  }>(),
  { as: "button" },
);
</script>

<template>
  <Primitive :as="as" :as-child="asChild" :class="cn(buttonVariants({ variant, size }), props.class)">
    <slot />
  </Primitive>
</template>
