<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-primary">Testing workspaces</p>
        <h1 class="text-2xl font-bold">Projects</h1>
        <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
          First step: choose a workspace, capture a requirement, review and approve it, then generate cases.
        </p>
      </div>
      <Button @click="showNew = !showNew">{{ showNew ? "Close" : "New project" }}</Button>
    </div>

    <Card v-if="demoProject" class="motion-card border-primary/30 bg-primary/5 p-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold">WhartTest Demo Workspace</h2>
            <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Pinned demo</span>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            Complete demo data: provider, approved requirement, generated cases, suite run, execution record,
            and report entry. Use it for acceptance before opening noisy E2E projects.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button as-child>
            <NuxtLink :to="`/projects/${demoProject.id}/requirements`">Open requirements</NuxtLink>
          </Button>
          <Button as-child variant="outline">
            <NuxtLink :to="`/projects/${demoProject.id}`">View workspace</NuxtLink>
          </Button>
        </div>
      </div>
    </Card>

    <Card v-if="!projects.length && !showNew && !loading" class="border-dashed p-4">
      <div class="font-medium">First step</div>
      <p class="mt-1 text-sm text-muted-foreground">
        Create a project for the app or site you want to test. New projects open directly in Requirements.
      </p>
      <Button class="mt-3" @click="showNew = true">Create first project</Button>
    </Card>

    <Card v-if="showNew" class="space-y-3 p-4">
      <div>
        <h2 class="font-semibold">Create a requirement-first project</h2>
        <p class="text-sm text-muted-foreground">After creation, you will land on Requirements to capture scope.</p>
      </div>
      <Input v-model="newName" placeholder="Project name, e.g. Crab Web" />
      <Input v-model="newSlug" placeholder="Slug (optional, auto-filled from name)" />
      <Input v-model="newDesc" placeholder="Description (optional)" />
      <div class="flex flex-wrap items-center gap-2">
        <Button :disabled="!newName.trim() || creating" @click="createProject">
          {{ creating ? "Creating..." : "Create project" }}
        </Button>
        <span v-if="notice" class="text-sm text-muted-foreground">{{ notice }}</span>
      </div>
    </Card>

    <Card class="p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="font-semibold">Workspace directory</h2>
          <p class="text-sm text-muted-foreground">Demo workspace stays first; E2E noise is moved out of the main path.</p>
        </div>
        <Input v-model="query" class="md:w-80" placeholder="Search projects by name or slug" />
      </div>
    </Card>

    <Card v-if="error" class="border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
      <div class="font-medium">Could not load projects</div>
      <div class="mt-1">{{ error }}</div>
      <Button class="mt-3" variant="outline" size="sm" @click="load">Retry</Button>
    </Card>

    <Card v-if="loading" class="p-4 text-sm text-muted-foreground">Loading projects...</Card>

    <div v-if="!loading" class="grid gap-3 lg:grid-cols-2">
      <NuxtLink
        v-for="p in primaryProjects"
        :key="p.id"
        :to="`/projects/${p.id}/requirements`"
        data-testid="project-card"
        class="block"
      >
        <Card class="motion-card h-full p-4 hover:border-primary/30 hover:bg-muted/30">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate font-semibold">{{ p.name }}</h3>
                <span v-if="isDemo(p)" class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Demo
                </span>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">{{ p.slug }} -> open requirements</p>
              <p class="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {{ p.description || "No description yet. Capture the first requirement to define testing scope." }}
              </p>
            </div>
            <span class="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Requirements first
            </span>
          </div>
        </Card>
      </NuxtLink>
    </div>

    <Card v-if="!loading && !primaryProjects.length" class="border-dashed p-5 text-sm text-muted-foreground">
      No matching workspaces. Create a project, then capture its first requirement instead of starting from AI generation.
    </Card>

    <details v-if="!loading && quietProjects.length" class="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
      <summary class="cursor-pointer font-medium text-foreground">
        {{ quietProjects.length }} E2E or test-noise project{{ quietProjects.length === 1 ? "" : "s" }} hidden from main acceptance path
      </summary>
      <div class="mt-3 grid gap-2 md:grid-cols-2">
        <NuxtLink
          v-for="p in quietProjects"
          :key="p.id"
          :to="`/projects/${p.id}/requirements`"
          class="rounded-md border bg-background p-3 hover:bg-muted/40"
        >
          <div class="font-medium">{{ p.name }}</div>
          <div class="text-xs">{{ p.slug }}</div>
        </NuxtLink>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";
import type { ProjectDto } from "@crab/shared-types";

const DEMO_WORKSPACE_NAME = "WhartTest Demo Workspace";

const projects = ref<ProjectDto[]>([]);
const loading = ref(true);
const creating = ref(false);
const error = ref("");
const notice = ref("");
const query = ref("");
const showNew = ref(false);
const newName = ref("");
const newSlug = ref("");
const newDesc = ref("");
const router = useRouter();

const demoProject = computed(() => projects.value.find(isDemo) ?? null);
const filteredProjects = computed(() => {
  const term = query.value.trim().toLowerCase();
  if (!term) return projects.value;
  return projects.value.filter((project) =>
    `${project.name} ${project.slug} ${project.description ?? ""}`.toLowerCase().includes(term),
  );
});
const primaryProjects = computed(() =>
  filteredProjects.value
    .filter((project) => !isNoiseProject(project))
    .sort(projectSort),
);
const quietProjects = computed(() =>
  filteredProjects.value
    .filter(isNoiseProject)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
);

onMounted(load);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    projects.value = await api.projects.list();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function createProject() {
  if (!newName.value.trim()) return;
  creating.value = true;
  error.value = "";
  notice.value = "Creating project and opening Requirements...";
  try {
    const project = await api.projects.create({
      name: newName.value.trim(),
      slug: newSlug.value.trim() || slugify(newName.value),
      description: newDesc.value.trim() || undefined,
    });
    newName.value = "";
    newSlug.value = "";
    newDesc.value = "";
    showNew.value = false;
    await router.push(`/projects/${project.id}/requirements`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    notice.value = "";
  } finally {
    creating.value = false;
  }
}

function isDemo(project: ProjectDto) {
  return project.name === DEMO_WORKSPACE_NAME || project.slug === "wharttest-demo-workspace";
}

function isNoiseProject(project: ProjectDto) {
  if (isDemo(project)) return false;
  const value = `${project.slug} ${project.name}`.toLowerCase();
  return /(^|\b)(e2e|playwright|spec|route-empty|workspace-empty|ws-e2e|ws e2e)(\b|-)/.test(value);
}

function projectSort(a: ProjectDto, b: ProjectDto) {
  if (isDemo(a) && !isDemo(b)) return -1;
  if (!isDemo(a) && isDemo(b)) return 1;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `project-${Date.now()}`
  );
}
</script>
