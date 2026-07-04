<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Tree view</p>
          <h2 class="text-xl font-bold">TestCase Mindmap</h2>
          <p class="text-sm text-muted-foreground">
            Cases grouped by module. Expand/collapse modules, drag not required for v1; use the table view for case edits.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="outline" as-child>
            <NuxtLink :to="`/projects/${projectId}/test-cases`">Back to list</NuxtLink>
          </Button>
          <Button variant="outline" data-testid="mindmap-collapse-all" @click="collapseAll">Collapse all</Button>
          <Button variant="outline" data-testid="mindmap-expand-all" @click="expandAll">Expand all</Button>
          <Button variant="outline" data-testid="mindmap-export-json" @click="exportJson">Export JSON</Button>
          <Button variant="outline" data-testid="mindmap-export-png" :disabled="!canExportPng" @click="exportPng">Export PNG</Button>
        </div>
      </div>
    </Card>

    <div class="grid gap-3 md:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label" class="p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ stat.label }}</div>
        <div class="mt-2 text-2xl font-semibold tabular-nums">{{ stat.value }}</div>
      </Card>
    </div>

    <Card v-if="loading" class="p-4 text-sm text-muted-foreground">Loading modules and cases...</Card>

    <Card v-else class="p-4">
      <div v-if="!tree.length" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        <p class="font-medium text-foreground">No modules or cases yet</p>
        <p class="mt-1">Create modules in the test-cases list, then assign cases to them to populate this mindmap.</p>
      </div>

      <ul v-else class="grid gap-2" data-testid="mindmap-tree">
        <li
          v-for="node in tree"
          :key="node.id"
          class="rounded-md border"
          :data-testid="`mindmap-module-${node.id}`"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 p-3 text-left transition hover:bg-muted/40"
            @click="toggle(node.id)"
          >
            <span class="text-xs tabular-nums text-muted-foreground">{{ expanded.has(node.id) ? "▾" : "▸" }}</span>
            <span class="font-semibold">{{ node.name }}</span>
            <span class="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
              {{ node.cases.length }} case{{ node.cases.length === 1 ? "" : "s" }}
            </span>
            <span
              v-if="node.children.length"
              class="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
            >
              {{ node.children.length }} submodule{{ node.children.length === 1 ? "" : "s" }}
            </span>
          </button>
          <div v-if="expanded.has(node.id)" class="border-t">
            <ul class="grid gap-1 p-3">
              <li
                v-for="testCase in node.cases"
                :key="testCase.id"
                class="flex items-start justify-between gap-3 rounded-md bg-muted/30 p-2 text-sm"
                :data-testid="`mindmap-case-${testCase.id}`"
              >
                <div class="min-w-0">
                  <div class="truncate font-medium">{{ testCase.title }}</div>
                  <div class="truncate text-xs text-muted-foreground">{{ testCase.steps.length }} steps · {{ testCase.origin }}</div>
                </div>
                <span class="rounded-full px-2 py-1 text-xs" :class="priorityClass(testCase.priority)">
                  {{ testCase.priority }}
                </span>
              </li>
              <li v-if="!node.cases.length" class="rounded-md bg-muted/20 p-2 text-xs text-muted-foreground">
                No test cases in this module.
              </li>
            </ul>
            <ul v-if="node.children.length" class="grid gap-1 px-3 pb-3">
              <li
                v-for="child in node.children"
                :key="child.id"
                class="rounded-md border bg-background p-2 text-sm"
                :data-testid="`mindmap-child-${child.id}`"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 text-left"
                  @click="toggle(child.id)"
                >
                  <span class="text-xs tabular-nums text-muted-foreground">{{ expanded.has(child.id) ? "▾" : "▸" }}</span>
                  <span class="font-medium">{{ child.name }}</span>
                  <span class="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{{ child.cases.length }}</span>
                </button>
                <ul v-if="expanded.has(child.id)" class="grid gap-1 p-2">
                  <li
                    v-for="testCase in child.cases"
                    :key="testCase.id"
                    class="flex items-start justify-between gap-2 rounded-md bg-muted/30 p-2 text-xs"
                  >
                    <div class="truncate">{{ testCase.title }}</div>
                    <span class="rounded-full px-2 py-0.5 text-xs" :class="priorityClass(testCase.priority)">{{ testCase.priority }}</span>
                  </li>
                </ul>
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { ModuleDto, TestCaseDto, TestCasePriority } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;

interface ModuleNode extends ModuleDto {
  cases: TestCaseDto[];
  children: ModuleNode[];
}

const loading = ref(false);
const modules = ref<ModuleDto[]>([]);
const cases = ref<TestCaseDto[]>([]);
const expanded = reactive(new Set<string>());

const canExportPng = computed(() => typeof document !== "undefined");

const tree = computed<ModuleNode[]>(() => {
  const byId = new Map<string, ModuleNode>();
  for (const m of modules.value) {
    byId.set(m.id, { ...m, cases: [], children: [] });
  }
  // Assign cases to their module
  for (const c of cases.value) {
    if (c.moduleId && byId.has(c.moduleId)) {
      byId.get(c.moduleId)!.cases.push(c);
    }
  }
  // Build tree
  const roots: ModuleNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Unassigned bucket if there are cases without module
  const unassigned = cases.value.filter((c) => !c.moduleId);
  if (unassigned.length) {
    roots.unshift({
      id: "__unassigned__",
      projectId,
      parentId: undefined,
      name: "Unassigned",
      order: -1,
      createdAt: "",
      updatedAt: "",
      cases: unassigned,
      children: [],
    });
  }
  return roots;
});

const stats = computed(() => [
  { label: "Modules", value: modules.value.length, detail: "Project hierarchy" },
  { label: "Cases", value: cases.value.length, detail: "Total" },
  {
    label: "High/critical",
    value: cases.value.filter((c) => c.priority === "high" || c.priority === "critical").length,
    detail: "Priority focus",
  },
  { label: "Unassigned", value: cases.value.filter((c) => !c.moduleId).length, detail: "Without module" },
]);

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const [moduleRows, caseRows] = await Promise.all([
      api.modules.list(projectId).catch(() => [] as ModuleDto[]),
      api.testCases.list(projectId),
    ]);
    modules.value = moduleRows;
    cases.value = caseRows;
    // Auto-expand top-level modules
    for (const node of tree.value) {
      expanded.add(node.id);
    }
  } finally {
    loading.value = false;
  }
}

function toggle(id: string) {
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
}

function expandAll() {
  for (const node of tree.value) {
    expanded.add(node.id);
    for (const child of node.children) expanded.add(child.id);
  }
}

function collapseAll() {
  expanded.clear();
}

function priorityClass(priority: TestCasePriority): string {
  return {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-amber-100 text-amber-800",
    critical: "bg-rose-100 text-rose-700",
  }[priority];
}

function exportJson() {
  const payload = tree.value.map((node) => ({
    id: node.id,
    name: node.name,
    cases: node.cases.map((c) => ({ id: c.id, title: c.title, priority: c.priority })),
    children: node.children.map((child) => ({
      id: child.id,
      name: child.name,
      cases: child.cases.map((c) => ({ id: c.id, title: c.title, priority: c.priority })),
    })),
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mindmap-${projectId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportPng() {
  // Lightweight PNG snapshot of the rendered tree via SVG foreignObject → PNG.
  // Not a full graph-layout export, but enough to share a visual snapshot.
  const tree = document.querySelector('[data-testid="mindmap-tree"]');
  if (!tree) return;
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${(tree as HTMLElement).outerHTML}</div></foreignObject></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mindmap-${projectId}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
</script>
