<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Requirement Review</p>
          <h2 class="text-xl font-bold">Requirements</h2>
          <p class="text-sm text-muted-foreground">
            Capture project requirements, review them with simple owner/member roles, and use approved versions for AI generation.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Input
            v-model="search"
            data-testid="requirement-search"
            placeholder="Search requirements"
            class="h-9 w-56"
          />
          <Button :disabled="loading" variant="outline" @click="load">Refresh</Button>
        </div>
      </div>
    </Card>

    <div class="grid gap-3 md:grid-cols-5">
      <Card v-for="stat in stats" :key="stat.label" class="p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ stat.label }}</div>
        <div class="mt-2 text-2xl font-semibold tabular-nums">{{ stat.value }}</div>
        <div class="mt-1 text-xs text-muted-foreground">{{ stat.detail }}</div>
      </Card>
    </div>

    <div class="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div class="flex flex-col gap-4">
        <Card class="p-4">
          <h3 class="font-semibold">New requirement</h3>
          <p class="text-sm text-muted-foreground">New items start as draft version 1.</p>
          <form class="mt-4 grid gap-3" @submit.prevent="createRequirement">
            <input
              v-model="createTitle"
              data-testid="requirement-title-input"
              class="h-10 rounded-md border bg-background px-3 text-sm"
              placeholder="Requirement title"
            />
            <textarea
              v-model="createContent"
              data-testid="requirement-content-input"
              class="min-h-32 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Requirement content"
            />
            <Button data-testid="create-requirement" :disabled="!canCreate">Create draft</Button>
          </form>
        </Card>

        <Card class="overflow-hidden">
          <div class="border-b p-4">
            <h3 class="font-semibold">Requirement list</h3>
            <p class="text-sm text-muted-foreground">Project-scoped drafts, reviews, and approvals.</p>
          </div>
          <button
            v-for="requirement in filteredRequirements"
            :key="requirement.id"
            class="block w-full p-4 text-left transition hover:bg-muted/40"
            :class="selectedId === requirement.id ? 'bg-accent/60' : ''"
            @click="selectRequirement(requirement.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ requirement.title }}</span>
              <span class="rounded-full px-2 py-1 text-xs" :class="statusClass(requirement.status)">
                {{ requirement.status }} v{{ requirement.version }}
              </span>
            </div>
            <div class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ requirement.content }}</div>
          </button>
          <div v-if="!filteredRequirements.length" class="p-4 text-sm text-muted-foreground">
            <p>No requirements match the current filter.</p>
            <p class="mt-1">Next step: capture the first requirement on the left.</p>
          </div>
        </Card>
      </div>

      <Card class="p-4">
        <div v-if="selected" class="grid gap-4" data-testid="requirement-detail">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold">{{ selected.title }}</h3>
              <p class="text-sm text-muted-foreground">Version {{ selected.version }} / {{ selected.status }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                :disabled="selected.status !== 'draft'"
                data-testid="submit-review"
                @click="submitReview"
              >
                Submit review
              </Button>
              <Button
                :disabled="selected.status !== 'in-review'"
                data-testid="approve"
                @click="approveRequirement"
              >
                Approve
              </Button>
              <Button
                variant="outline"
                :disabled="selected.status !== 'in-review'"
                data-testid="reject"
                @click="confirmReject"
              >
                Reject
              </Button>
              <Button
                variant="outline"
                :disabled="selected.status === 'archived' || selected.status === 'approved'"
                data-testid="archive"
                @click="confirmArchive"
              >
                Archive
              </Button>
              <Button
                v-if="selectedApprovedVersion"
                as-child
                data-testid="generate-cases"
              >
                <NuxtLink
                  :to="{
                    path: `/projects/${projectId}/ai-generation`,
                    query: { requirementVersionId: selectedApprovedVersion.id },
                  }"
                >
                  Generate cases
                </NuxtLink>
              </Button>
              <Button
                v-if="canDelete"
                variant="destructive"
                data-testid="delete"
                @click="confirmDelete"
              >
                Delete
              </Button>
            </div>
          </div>

          <div class="grid gap-3">
            <input
              v-model="editDraft.title"
              class="h-10 rounded-md border bg-background px-3 text-sm"
              placeholder="Requirement title"
            />
            <textarea
              v-model="editDraft.content"
              data-testid="requirement-edit-content"
              class="min-h-36 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Requirement content"
            />
            <div class="flex items-center gap-2">
              <Button variant="outline" :disabled="!canUpdate" @click="updateRequirement">Save changes</Button>
              <span class="text-xs text-muted-foreground">
                Reviewed edits return to draft; approved edits create a new draft version.
              </span>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Version history</h4>
              <div v-for="version in selected.versions" :key="version.id" class="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                <div class="font-medium">v{{ version.version }} — {{ version.status }}</div>
                <div class="mt-1 line-clamp-2 text-muted-foreground">{{ version.content }}</div>
              </div>
            </div>
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Approval history</h4>
              <div v-for="event in selected.reviewEvents" :key="event.id" class="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                <div class="font-medium">{{ event.action }} → {{ event.toStatus }}</div>
                <div class="text-muted-foreground">{{ new Date(event.createdAt).toLocaleString() }}</div>
              </div>
              <div v-if="!selected.reviewEvents.length" class="mt-3 text-sm text-muted-foreground">
                No review events yet. Submit the draft for review to start the approval flow.
              </div>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Related test cases</h4>
              <div v-if="relatedCases.length" class="mt-3 grid gap-2">
                <div
                  v-for="testCase in relatedCases"
                  :key="testCase.id"
                  class="rounded-md bg-muted/40 p-3 text-sm"
                >
                  <div class="font-medium">{{ testCase.title }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ testCase.priority }} · {{ testCase.origin }} · {{ testCase.steps.length }} steps
                  </div>
                </div>
              </div>
              <div v-else class="mt-3 text-sm text-muted-foreground">
                No test cases linked yet. Approve this requirement and click "Generate cases" to start.
              </div>
            </div>
            <div class="rounded-md border p-3">
              <h4 class="font-medium">Recent AI generation runs</h4>
              <div v-if="recentAiRuns.length" class="mt-3 grid gap-2">
                <div
                  v-for="run in recentAiRuns"
                  :key="run.id"
                  class="rounded-md bg-muted/40 p-3 text-sm"
                >
                  <div class="font-medium">{{ run.status }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ new Date(run.startedAt).toLocaleString() }} · {{ run.draftCases.length }} drafts
                  </div>
                </div>
              </div>
              <div v-else class="mt-3 text-sm text-muted-foreground">
                No AI generation runs yet. Approved requirements become eligible for "Generate cases".
              </div>
            </div>
          </div>
        </div>

        <div v-else class="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          <p class="font-medium">No requirement selected</p>
          <p class="mt-1">Select one from the list, or create a new draft to begin the review → approve → generate flow.</p>
        </div>
      </Card>
    </div>

    <Dialog v-model:open="confirmOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ confirmTitle }}</DialogTitle>
          <DialogDescription>{{ confirmDescription }}</DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="confirmOpen = false">Cancel</Button>
          <Button :variant="confirmVariant" data-testid="confirm-action" @click="runConfirmed">Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type {
  AiWorkflowRunDto,
  RequirementDto,
  RequirementStatus,
  TestCaseDto,
} from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const loading = ref(false);
const requirements = ref<RequirementDto[]>([]);
const selectedId = ref("");
const search = ref("");

const createTitle = ref("");
const createContent = ref("");
const editDraft = ref({ title: "", content: "" });

const relatedCases = ref<TestCaseDto[]>([]);
const recentAiRuns = ref<AiWorkflowRunDto[]>([]);

const confirmOpen = ref(false);
const confirmTitle = ref("");
const confirmDescription = ref("");
const confirmVariant = ref<"default" | "destructive">("default");
const confirmAction = ref<null | "reject" | "archive" | "delete">(null);

const selected = computed(() => requirements.value.find((item) => item.id === selectedId.value) ?? null);
const selectedApprovedVersion = computed(() => {
  if (selected.value?.status !== "approved") return null;
  return [...selected.value.versions].reverse().find((version) => version.status === "approved") ?? null;
});
const canDelete = computed(() => {
  const status = selected.value?.status;
  return status === "draft" || status === "rejected" || status === "archived";
});
const filteredRequirements = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return requirements.value;
  return requirements.value.filter(
    (r) => r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q),
  );
});
const stats = computed(() => [
  { label: "Total", value: requirements.value.length, detail: "Managed requirements" },
  { label: "Draft", value: countStatus("draft"), detail: "Needs refinement" },
  { label: "In review", value: countStatus("in-review"), detail: "Awaiting owner decision" },
  { label: "Approved", value: countStatus("approved"), detail: "Eligible for AI generation" },
  { label: "Rejected", value: countStatus("rejected"), detail: "Revise and resubmit" },
]);
const canCreate = computed(() => createTitle.value.trim().length > 0 && createContent.value.trim().length > 0);
const canUpdate = computed(
  () =>
    !!selected.value &&
    (selected.value.status === "draft" ||
      selected.value.status === "in-review" ||
      selected.value.status === "rejected" ||
      selected.value.status === "approved") &&
    editDraft.value.title.trim().length > 0 &&
    editDraft.value.content.trim().length > 0 &&
    (editDraft.value.title !== selected.value.title || editDraft.value.content !== selected.value.content),
);

onMounted(load);

async function load() {
  loading.value = true;
  try {
    requirements.value = await api.requirements.list(projectId);
    if (!selectedId.value) selectedId.value = requirements.value[0]?.id ?? "";
    syncEditDraft();
    await loadRelated();
  } finally {
    loading.value = false;
  }
}

async function loadRelated() {
  if (!selected.value) {
    relatedCases.value = [];
    recentAiRuns.value = [];
    return;
  }
  const approvedVersion = [...selected.value.versions]
    .reverse()
    .find((version) => version.status === "approved");
  const allCases = await api.testCases.list(projectId);
  relatedCases.value = approvedVersion
    ? allCases.filter((c) => c.requirementVersionId === approvedVersion.id)
    : [];
  try {
    const runs = await api.ai.list(projectId);
    recentAiRuns.value = approvedVersion
      ? runs
          .filter((r) => r.requirementVersionId === approvedVersion.id)
          .slice(0, 5)
      : [];
  } catch {
    recentAiRuns.value = [];
  }
}

function countStatus(status: RequirementStatus) {
  return requirements.value.filter((requirement) => requirement.status === status).length;
}

function selectRequirement(id: string) {
  selectedId.value = id;
  syncEditDraft();
  loadRelated();
}

function syncEditDraft() {
  if (!selected.value) return;
  editDraft.value = { title: selected.value.title, content: selected.value.content };
}

async function createRequirement() {
  const created = await api.requirements.create(projectId, {
    title: createTitle.value,
    content: createContent.value,
  });
  createTitle.value = "";
  createContent.value = "";
  selectedId.value = created.id;
  await load();
}

async function updateRequirement() {
  if (!selected.value) return;
  const updated = await api.requirements.update(projectId, selected.value.id, editDraft.value);
  selectedId.value = updated.id;
  await load();
}

async function submitReview() {
  if (!selected.value) return;
  const updated = await api.requirements.submitReview(projectId, selected.value.id);
  selectedId.value = updated.id;
  await load();
}

async function approveRequirement() {
  if (!selected.value) return;
  const updated = await api.requirements.approve(projectId, selected.value.id);
  selectedId.value = updated.id;
  await load();
}

function confirmReject() {
  confirmAction.value = "reject";
  confirmTitle.value = "Reject requirement";
  confirmDescription.value =
    "Rejection returns the requirement to the author for revision. The current version becomes rejected and can be edited back to draft.";
  confirmVariant.value = "default";
  confirmOpen.value = true;
}

function confirmArchive() {
  confirmAction.value = "archive";
  confirmTitle.value = "Archive requirement";
  confirmDescription.value =
    "Archiving removes the requirement from active lists without deleting history. Archived items can be deleted later.";
  confirmVariant.value = "default";
  confirmOpen.value = true;
}

function confirmDelete() {
  confirmAction.value = "delete";
  confirmTitle.value = "Delete requirement";
  confirmDescription.value =
    "Deletion is permanent and removes all version history and review events. Only draft, rejected, or archived requirements can be deleted.";
  confirmVariant.value = "destructive";
  confirmOpen.value = true;
}

async function runConfirmed() {
  if (!selected.value || !confirmAction.value) return;
  const action = confirmAction.value;
  confirmOpen.value = false;
  confirmAction.value = null;
  if (action === "reject") {
    const updated = await api.requirements.reject(projectId, selected.value.id);
    selectedId.value = updated.id;
  } else if (action === "archive") {
    const updated = await api.requirements.archive(projectId, selected.value.id);
    selectedId.value = updated.id;
  } else if (action === "delete") {
    await api.requirements.remove(projectId, selected.value.id);
    selectedId.value = "";
  }
  await load();
}

function statusClass(status: RequirementStatus) {
  return {
    draft: "bg-slate-100 text-slate-700",
    "in-review": "bg-blue-100 text-blue-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    archived: "bg-zinc-200 text-zinc-700",
  }[status];
}
</script>
