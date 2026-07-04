<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Reusable Assets</p>
          <h2 class="text-xl font-bold">UI Page Objects</h2>
          <p class="text-sm text-muted-foreground">
            Manage page objects, locators, and ordered steps as reusable UI automation assets.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button :disabled="loading" variant="outline" @click="load">{{ loading ? "Loading..." : "Refresh" }}</Button>
          <Button data-testid="new-page-object" @click="showNew = !showNew">{{ showNew ? "Close" : "New page object" }}</Button>
        </div>
      </div>
    </Card>

    <Card v-if="showNew" class="p-4">
      <h3 class="font-semibold">New page object</h3>
      <div class="mt-4 grid gap-3">
        <Input v-model="draft.name" data-testid="po-name" placeholder="Page name (e.g. Login Page)" />
        <Input v-model="draft.urlPattern" placeholder="URL pattern (e.g. /login)" />
        <Input v-model="draft.description" placeholder="Description (optional)" />
        <Button data-testid="create-po" :disabled="!draft.name.trim()" @click="createPageObject">Create page object</Button>
      </div>
    </Card>

    <div class="grid gap-4 xl:grid-cols-[340px_1fr]">
      <Card class="overflow-hidden">
        <div class="border-b p-4">
          <h3 class="font-semibold">Page library</h3>
          <p class="text-sm text-muted-foreground">{{ pageObjects.length }} page object(s)</p>
        </div>
        <button
          v-for="po in pageObjects"
          :key="po.id"
          type="button"
          class="block w-full p-4 text-left transition hover:bg-muted/40"
          :class="selected?.id === po.id ? 'bg-accent/60' : ''"
          :data-testid="`po-row-${po.id}`"
          @click="selected = po"
        >
          <div class="font-medium">{{ po.name }}</div>
          <div class="mt-1 text-xs text-muted-foreground">
            {{ po.locators.length }} locators / {{ po.steps.length }} steps
          </div>
        </button>
        <div v-if="!pageObjects.length" class="p-4 text-sm text-muted-foreground">
          No page objects yet. Create the first one to start building reusable UI automation assets.
        </div>
      </Card>

      <Card v-if="selected" class="p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-primary">Page detail</p>
            <h3 class="mt-1 text-lg font-semibold">{{ selected.name }}</h3>
            <p v-if="selected.urlPattern" class="text-sm text-muted-foreground">{{ selected.urlPattern }}</p>
          </div>
          <div class="flex gap-2">
            <Button variant="destructive" data-testid="delete-po" @click="deletePageObject">Delete</Button>
          </div>
        </div>

        <div class="mt-4">
          <div class="flex items-center justify-between gap-2">
            <h4 class="font-medium">Locators ({{ selected.locators.length }})</h4>
            <Button variant="outline" size="sm" data-testid="add-locator-toggle" @click="showLocatorForm = !showLocatorForm">
              {{ showLocatorForm ? "Cancel" : "Add locator" }}
            </Button>
          </div>
          <div v-if="showLocatorForm" class="mt-2 grid gap-2 rounded-md border p-3">
            <Input v-model="locatorDraft.name" data-testid="locator-name" placeholder="Locator name (e.g. emailInput)" />
            <select v-model="locatorDraft.strategy" data-testid="locator-strategy" class="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="css">CSS</option>
              <option value="xpath">XPath</option>
              <option value="id">ID</option>
              <option value="data-testid">data-testid</option>
              <option value="text">Text</option>
              <option value="role">Role</option>
            </select>
            <Input v-model="locatorDraft.value" data-testid="locator-value" placeholder="Selector value (e.g. #email)" />
            <Button data-testid="save-locator" :disabled="!locatorDraft.name.trim() || !locatorDraft.value.trim()" @click="addLocator">Save locator</Button>
          </div>
          <div v-if="selected.locators.length" class="mt-2 overflow-hidden rounded-md border">
            <div v-for="loc in selected.locators" :key="loc.id" class="flex items-center justify-between border-t p-2 text-sm first:border-t-0">
              <div class="min-w-0">
                <span class="font-medium">{{ loc.name }}</span>
                <span class="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{{ loc.strategy }}</span>
                <div class="truncate font-mono text-xs text-muted-foreground">{{ loc.value }}</div>
              </div>
              <Button variant="outline" size="sm" @click="removeLocator(loc.id)">Remove</Button>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <div class="flex items-center justify-between gap-2">
            <h4 class="font-medium">Steps ({{ selected.steps.length }})</h4>
            <Button variant="outline" size="sm" data-testid="add-step-toggle" @click="showStepForm = !showStepForm">
              {{ showStepForm ? "Cancel" : "Add step" }}
            </Button>
          </div>
          <div v-if="showStepForm" class="mt-2 grid gap-2 rounded-md border p-3">
            <div class="grid grid-cols-2 gap-2">
              <Input v-model="stepDraft.order" data-testid="step-order" type="number" placeholder="Order" />
              <select v-model="stepDraft.action" data-testid="step-action" class="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="navigate">navigate</option>
                <option value="click">click</option>
                <option value="fill">fill</option>
                <option value="select">select</option>
                <option value="assert">assert</option>
                <option value="wait">wait</option>
                <option value="screenshot">screenshot</option>
              </select>
            </div>
            <select v-if="selected.locators.length" v-model="stepDraft.locatorId" class="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">No locator</option>
              <option v-for="loc in selected.locators" :key="loc.id" :value="loc.id">{{ loc.name }} ({{ loc.strategy }})</option>
            </select>
            <Input v-model="stepDraft.value" placeholder="Value (optional, e.g. text to fill)" />
            <Button data-testid="save-step" :disabled="!stepDraft.order.trim() || !stepDraft.action" @click="addStep">Save step</Button>
          </div>
          <div v-if="selected.steps.length" class="mt-2 overflow-hidden rounded-md border">
            <div
              v-for="step in selected.steps"
              :key="step.id"
              class="flex items-center justify-between border-t p-2 text-sm first:border-t-0"
            >
              <div class="flex items-center gap-3">
                <span class="tabular-nums text-muted-foreground">{{ step.order }}</span>
                <span class="font-medium">{{ step.action }}</span>
                <span v-if="step.locatorId" class="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {{ locatorName(step.locatorId) }}
                </span>
                <span v-if="step.value" class="truncate text-xs text-muted-foreground">{{ step.value }}</span>
              </div>
              <Button variant="outline" size="sm" @click="removeStep(step.id)">Remove</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card v-else class="p-6">
        <div class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          <p class="font-medium text-foreground">No page object selected</p>
          <p class="mt-1">Pick one from the library, or create a new page object to manage locators and steps.</p>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import type {
  CreateUiLocatorRequest,
  CreateUiPageObjectRequest,
  CreateUiPageStepRequest,
  UiLocatorStrategy,
  UiPageObjectDto,
  UiPageStepAction,
} from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const loading = ref(false);
const showNew = ref(false);
const pageObjects = ref<UiPageObjectDto[]>([]);
const selected = ref<UiPageObjectDto | null>(null);

const showLocatorForm = ref(false);
const showStepForm = ref(false);

const draft = ref<{ name: string; urlPattern: string; description: string }>({
  name: "",
  urlPattern: "",
  description: "",
});

const locatorDraft = ref<{ name: string; strategy: UiLocatorStrategy; value: string }>({
  name: "",
  strategy: "css",
  value: "",
});

const stepDraft = ref<{
  order: string;
  action: UiPageStepAction;
  locatorId: string;
  value: string;
}>({
  order: "",
  action: "click",
  locatorId: "",
  value: "",
});

onMounted(load);

async function load() {
  loading.value = true;
  try {
    pageObjects.value = await api.uiAutomation.listPageObjects(projectId);
    if (selected.value) {
      selected.value = pageObjects.value.find((po) => po.id === selected.value?.id) ?? null;
    }
  } finally {
    loading.value = false;
  }
}

async function createPageObject() {
  const req: CreateUiPageObjectRequest = {
    name: draft.value.name.trim(),
    ...(draft.value.urlPattern.trim() ? { urlPattern: draft.value.urlPattern.trim() } : {}),
    ...(draft.value.description.trim() ? { description: draft.value.description.trim() } : {}),
  };
  const created = await api.uiAutomation.createPageObject(projectId, req);
  draft.value = { name: "", urlPattern: "", description: "" };
  showNew.value = false;
  await load();
  selected.value = created;
}

async function deletePageObject() {
  if (!selected.value) return;
  await api.uiAutomation.deletePageObject(projectId, selected.value.id);
  selected.value = null;
  await load();
}

async function addLocator() {
  if (!selected.value) return;
  const req: CreateUiLocatorRequest = {
    name: locatorDraft.value.name.trim(),
    strategy: locatorDraft.value.strategy,
    value: locatorDraft.value.value.trim(),
  };
  await api.uiAutomation.addLocator(projectId, selected.value.id, req);
  locatorDraft.value = { name: "", strategy: "css", value: "" };
  showLocatorForm.value = false;
  selected.value = await api.uiAutomation.getPageObject(projectId, selected.value.id);
}

async function removeLocator(locatorId: string) {
  if (!selected.value) return;
  await api.uiAutomation.removeLocator(projectId, locatorId);
  selected.value = await api.uiAutomation.getPageObject(projectId, selected.value.id);
}

async function addStep() {
  if (!selected.value || !stepDraft.value.order.trim()) return;
  const req: CreateUiPageStepRequest = {
    order: Number(stepDraft.value.order),
    action: stepDraft.value.action,
    ...(stepDraft.value.locatorId ? { locatorId: stepDraft.value.locatorId } : {}),
    ...(stepDraft.value.value.trim() ? { value: stepDraft.value.value.trim() } : {}),
  };
  await api.uiAutomation.addStep(projectId, selected.value.id, req);
  stepDraft.value = { order: "", action: "click", locatorId: "", value: "" };
  showStepForm.value = false;
  selected.value = await api.uiAutomation.getPageObject(projectId, selected.value.id);
}

async function removeStep(stepId: string) {
  if (!selected.value) return;
  await api.uiAutomation.removeStep(projectId, stepId);
  selected.value = await api.uiAutomation.getPageObject(projectId, selected.value.id);
}

function locatorName(locatorId: string): string {
  return selected.value?.locators.find((l) => l.id === locatorId)?.name ?? locatorId;
}
</script>
