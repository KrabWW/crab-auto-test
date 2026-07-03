<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "radix-vue";
import { cn } from "~/lib/utils";
import { buttonVariants, type ButtonVariants } from ".";
import type { HTMLAttributes } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<PrimitiveProps & {
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    class?: HTMLAttributes["class"];
  }>(),
  { as: "button" },
);

const attrs = useAttrs();
</script>

<template>
  <Primitive v-bind="attrs" :as="as" :as-child="asChild" :class="cn(buttonVariants({ variant, size }), props.class)">
    <slot />
  </Primitive>
</template>
