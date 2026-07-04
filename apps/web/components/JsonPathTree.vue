<script setup lang="ts">
import { computed, ref } from "vue";

interface Node {
  key: string;
  path: string;
  value: unknown;
  depth: number;
}

const props = defineProps<{ data: unknown; maxDepth?: number }>();

const collapsed = ref(new Set<string>());

const flatNodes = computed<Node[]>(() => collect("$", props.data, 0, []));

function collect(prefix: string, value: unknown, depth: number, acc: Node[]): Node[] {
  if (value === null || value === undefined) {
    acc.push({ key: prefix, path: prefix, value: "null", depth });
    return acc;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      acc.push({ key: `${prefix}[]`, path: prefix, value: "[]", depth });
      return acc;
    }
    value.forEach((item, i) => collect(`${prefix}[${i}]`, item, depth + 1, acc));
    return acc;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      acc.push({ key: `${prefix}{}`, path: prefix, value: "{}", depth });
      return acc;
    }
    for (const [k, v] of entries) {
      const safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? `.${k}` : `["${k}"]`;
      collect(`${prefix}${safeKey}`, v, depth + 1, acc);
    }
    return acc;
  }
  acc.push({ key: prefix, path: prefix, value, depth });
  return acc;
}

function toggle(path: string) {
  if (collapsed.value.has(path)) collapsed.value.delete(path);
  else collapsed.value.add(path);
}

function isHidden(node: Node): boolean {
  if (node.depth === 0) return false;
  // Hide if any ancestor prefix is collapsed. Simple approximation: hide when
  // any prefix substring is in collapsed set.
  for (const c of collapsed.value) {
    if (node.path.startsWith(c + ".")) return true;
    if (node.path.startsWith(c + "[")) return true;
  }
  return false;
}

function copyPath(path: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(path);
  }
}

function valueClass(value: unknown): string {
  if (value === null || value === "null") return "text-slate-500";
  if (typeof value === "string") return "text-emerald-700";
  if (typeof value === "number") return "text-blue-700";
  if (typeof value === "boolean") return "text-amber-700";
  return "text-muted-foreground";
}

function isPrimitive(value: unknown): boolean {
  return value === null || ["string", "number", "boolean", "undefined"].includes(typeof value);
}

function primitiveLabel(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}
</script>

<template>
  <ul class="grid gap-0.5">
    <li
      v-for="node in flatNodes"
      :key="node.path"
      v-show="!isHidden(node)"
      :data-testid="`json-path-${node.path}`"
      class="flex flex-wrap items-start gap-2"
      :style="{ paddingLeft: `${node.depth * 12}px` }"
    >
      <code class="font-mono text-[11px] text-muted-foreground">{{ node.key }}</code>
      <template v-if="isPrimitive(node.value)">
        <span class="font-mono text-[11px]" :class="valueClass(node.value)">{{ primitiveLabel(node.value) }}</span>
      </template>
      <template v-else>
        <span class="text-[11px] text-muted-foreground">{{ Array.isArray(node.value) ? `Array(${(node.value as unknown[]).length})` : `Object(${Object.keys(node.value as object).length})` }}</span>
        <button
          type="button"
          class="text-[10px] text-primary hover:underline"
          @click="toggle(node.path)"
        >
          {{ collapsed.has(node.path) ? "expand" : "collapse" }}
        </button>
      </template>
      <button
        type="button"
        class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/70"
        title="Copy JSON path"
        @click="copyPath(node.path)"
      >
        copy
      </button>
    </li>
  </ul>
</template>
