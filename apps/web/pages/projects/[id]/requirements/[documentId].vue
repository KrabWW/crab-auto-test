<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Requirement document</p>
          <h2 class="text-xl font-bold">{{ document?.filename ?? "Loading..." }}</h2>
          <p class="text-sm text-muted-foreground" v-if="document">
            {{ document.mimeType }} · {{ formatBytes(document.sizeBytes) }} ·
            <span :class="statusClass(document.status)">{{ document.status }}</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" @click="load">Refresh</Button>
          <Button variant="outline" :disabled="!document || document.status !== 'extracted'" @click="reExtract">
            Re-extract text
          </Button>
        </div>
      </div>
    </Card>

    <Card v-if="error" class="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {{ error }}
    </Card>

    <Card v-if="loading && !document" class="p-4">
      <div class="h-4 w-1/3 animate-pulse rounded bg-muted"></div>
      <div class="mt-3 h-32 w-full animate-pulse rounded bg-muted/70"></div>
    </Card>

    <Card v-if="document" class="p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">Extracted text</h3>
          <p class="text-sm text-muted-foreground">
            Plain text used as input for AI module splitting and review.
          </p>
        </div>
        <Button variant="ghost" size="sm" @click="showText = !showText">
          {{ showText ? "Hide" : "Show" }}
        </Button>
      </div>
      <pre v-if="showText && document.parsedText" class="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">{{ document.parsedText }}</pre>
      <div v-else-if="document.parseError" class="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {{ document.parseError }}
      </div>
      <div v-else-if="document.status !== 'extracted'" class="mt-3 text-sm text-muted-foreground">
        Text extraction has not completed yet.
      </div>
    </Card>

    <Card class="p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">Functional modules</h3>
          <p class="text-sm text-muted-foreground">
            AI splits the document into testable modules. Adjust titles, content, or order; promote a module to start the requirement review flow.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" :disabled="!canSplit || splitting" data-testid="split-modules" @click="autoSplit">
            {{ splitting ? "Splitting..." : "Auto-split modules" }}
          </Button>
          <Button variant="outline" :disabled="!editableModules.length || savingModules" data-testid="save-modules" @click="saveModules">
            {{ savingModules ? "Saving..." : "Save modules" }}
          </Button>
        </div>
      </div>
      <div v-if="splitError" class="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {{ splitError }}
      </div>
      <div class="mt-4 overflow-hidden rounded-md border">
        <div class="grid grid-cols-[56px_1fr_120px_140px] bg-muted/60 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div>Order</div>
          <div>Module</div>
          <div>Confidence</div>
          <div>Controls</div>
        </div>
        <div
          v-for="(item, index) in editableModules"
          :key="item.localId"
          class="grid grid-cols-[56px_1fr_120px_140px] items-start border-t px-3 py-3 text-sm"
        >
          <div class="flex flex-col gap-1">
            <span class="tabular-nums">{{ index + 1 }}</span>
            <div class="flex gap-1">
              <Button variant="outline" size="sm" :disabled="index === 0" @click="moveModule(index, -1)">Up</Button>
              <Button variant="outline" size="sm" :disabled="index === editableModules.length - 1" @click="moveModule(index, 1)">Down</Button>
            </div>
          </div>
          <div class="grid min-w-0 gap-2">
            <Input v-model="item.title" :data-testid="`module-title-${index}`" placeholder="Module title" />
            <textarea
              v-model="item.content"
              :data-testid="`module-content-${index}`"
              class="min-h-24 rounded-md border bg-background px-3 py-2 text-xs"
              placeholder="Module requirement text"
            />
          </div>
          <div>
            <span v-if="item.confidenceScore !== undefined" class="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary tabular-nums">
              {{ Math.round(item.confidenceScore * 100) }}%
            </span>
            <span v-else class="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Manual</span>
          </div>
          <div class="flex flex-col gap-1">
            <Button variant="outline" size="sm" :data-testid="`promote-module-${index}`" @click="promote(index, item.id)">
              Promote
            </Button>
            <Button variant="outline" size="sm" @click="removeModule(index)">Delete</Button>
          </div>
        </div>
        <div v-if="!editableModules.length" class="p-4 text-sm text-muted-foreground">
          No modules yet. Click "Auto-split modules" to let AI propose boundaries, then refine and promote the ones you want to turn into requirements.
        </div>
      </div>
    </Card>

    <Card class="p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="font-semibold">AI review report</h3>
          <p class="text-sm text-muted-foreground">
            4-dimension review: clarity · completeness · testability · boundaries. Issues list and improvement suggestions are produced by the configured generation model.
          </p>
        </div>
        <Button variant="outline" :disabled="!canReview || reviewing" data-testid="start-review" @click="startReview">
          {{ reviewing ? "Reviewing..." : "Run AI review" }}
        </Button>
      </div>
      <div v-if="reviewError" class="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {{ reviewError }}
      </div>
      <div v-if="review" class="mt-4 grid gap-4">
        <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card class="p-3">
            <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall</div>
            <div class="mt-2 text-2xl font-semibold tabular-nums" :class="scoreClass(review.overallScore)">{{ review.overallScore ?? "—" }}</div>
          </Card>
          <Card class="p-3">
            <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clarity</div>
            <div class="mt-2 text-xl font-semibold tabular-nums" :class="scoreClass(review.clarityScore)">{{ review.clarityScore ?? "—" }}</div>
          </Card>
          <Card class="p-3">
            <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completeness</div>
            <div class="mt-2 text-xl font-semibold tabular-nums" :class="scoreClass(review.completenessScore)">{{ review.completenessScore ?? "—" }}</div>
          </Card>
          <Card class="p-3">
            <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Testability</div>
            <div class="mt-2 text-xl font-semibold tabular-nums" :class="scoreClass(review.testabilityScore)">{{ review.testabilityScore ?? "—" }}</div>
          </Card>
          <Card class="p-3">
            <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Boundaries</div>
            <div class="mt-2 text-xl font-semibold tabular-nums" :class="scoreClass(review.boundariesScore)">{{ review.boundariesScore ?? "—" }}</div>
          </Card>
        </div>

        <div v-if="review.status === 'failed'" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Review failed: {{ review.failureReason ?? "Unknown reason" }}
        </div>

        <div v-if="review.issues && review.issues.length" class="grid gap-2">
          <h4 class="text-sm font-semibold">Issues ({{ review.issues.length }})</h4>
          <div
            v-for="(issue, idx) in review.issues"
            :key="`issue-${idx}`"
            class="rounded-md border p-3 text-sm"
            :class="issueBorderClass(issue.severity)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="font-medium">{{ issue.message }}</div>
              <span class="rounded-full px-2 py-1 text-xs" :class="issueBadgeClass(issue.severity)">{{ issue.severity }}</span>
            </div>
            <div v-if="issue.suggestion" class="mt-1 text-xs text-muted-foreground">{{ issue.suggestion }}</div>
          </div>
        </div>

        <div v-if="review.improvements && review.improvements.length" class="grid gap-2">
          <h4 class="text-sm font-semibold">Improvement suggestions</h4>
          <ul class="grid gap-1 text-sm">
            <li v-for="(tip, idx) in review.improvements" :key="`tip-${idx}`" class="flex items-start gap-2">
              <span class="mt-1 inline-block h-1 w-1 rounded-full bg-primary"></span>
              <span>{{ tip }}</span>
            </li>
          </ul>
        </div>
      </div>
      <div v-else-if="reports.length" class="mt-4 overflow-hidden rounded-md border">
        <div class="grid grid-cols-[140px_1fr_120px] bg-muted/60 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div>Status</div>
          <div>Started</div>
          <div>Score</div>
        </div>
        <button
          v-for="r in reports"
          :key="r.id"
          type="button"
          class="grid w-full grid-cols-[140px_1fr_120px] items-center border-t px-3 py-3 text-left text-sm hover:bg-muted/30"
          @click="review = r"
        >
          <div>
            <span class="rounded-full px-2 py-1 text-xs" :class="reviewStatusBadgeClass(r.status)">{{ r.status }}</span>
          </div>
          <div class="text-xs text-muted-foreground">{{ r.startedAt ? new Date(r.startedAt).toLocaleString() : "—" }}</div>
          <div class="tabular-nums" :class="scoreClass(r.overallScore)">{{ r.overallScore ?? "—" }}</div>
        </button>
      </div>
      <div v-else class="mt-4 text-sm text-muted-foreground">
        No review reports yet. Run an AI review to score the document across clarity, completeness, testability, and boundaries.
      </div>
    </Card>

    <Dialog v-model:open="promoteOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Promote module to requirement</DialogTitle>
          <DialogDescription>
            Creates a draft requirement (version 1) from this module. Continue in the Requirements tab to submit it for review.
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="promoteOpen = false">Cancel</Button>
          <Button data-testid="promote-confirm" :disabled="promoting" @click="confirmPromote">
            {{ promoting ? "Promoting..." : "Promote" }}
          </Button>
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
  RequirementDocumentDto,
  RequirementDocumentStatus,
  RequirementModuleDto,
  RequirementReviewReportDto,
  RequirementReviewSeverity,
  RequirementReviewStatus,
} from "@crab/shared-types";

interface EditableModule {
  localId: string;
  id?: string;
  title: string;
  content: string;
  order: number;
  confidenceScore?: number;
  isAutoGenerated: boolean;
}

const route = useRoute();
const projectId = route.params.id as string;
const documentId = route.params.documentId as string;

const document = ref<RequirementDocumentDto | null>(null);
const modules = ref<RequirementModuleDto[]>([]);
const editableModules = ref<EditableModule[]>([]);
const loading = ref(false);
const error = ref("");
const showText = ref(false);

const splitting = ref(false);
const splitError = ref("");
const savingModules = ref(false);

const reports = ref<RequirementReviewReportDto[]>([]);
const review = ref<RequirementReviewReportDto | null>(null);
const reviewing = ref(false);
const reviewError = ref("");

const promoteOpen = ref(false);
const promoting = ref(false);
const pendingPromoteId = ref<string | null>(null);

const canSplit = computed(() => document.value?.status === "extracted");
const canReview = computed(() => document.value?.status === "extracted");

onMounted(load);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [doc, mods, reps] = await Promise.all([
      api.requirementDocuments.get(projectId, documentId),
      api.requirementModules.list(projectId, documentId).catch(() => [] as RequirementModuleDto[]),
      api.requirementReviews.list(projectId, documentId).catch(() => [] as RequirementReviewReportDto[]),
    ]);
    document.value = doc;
    modules.value = mods;
    reports.value = reps;
    review.value = reps.find((r) => r.status === "completed") ?? null;
    syncEditable();
    showText.value = mods.length === 0;
  } catch (err) {
    error.value = (err as Error).message ?? "Failed to load document";
  } finally {
    loading.value = false;
  }
}

function syncEditable() {
  editableModules.value = modules.value.map((m, index) => ({
    localId: m.id ?? `mod-${index}`,
    id: m.id,
    title: m.title,
    content: m.content,
    order: m.order,
    ...(m.confidenceScore !== undefined ? { confidenceScore: m.confidenceScore } : {}),
    isAutoGenerated: m.isAutoGenerated,
  }));
}

async function reExtract() {
  if (!document.value) return;
  try {
    document.value = await api.requirementDocuments.extract(projectId, documentId);
  } catch (err) {
    error.value = (err as Error).message ?? "Re-extract failed";
  }
}

async function autoSplit() {
  if (!document.value) return;
  splitting.value = true;
  splitError.value = "";
  try {
    modules.value = await api.requirementModules.split(projectId, documentId);
    syncEditable();
  } catch (err) {
    splitError.value = (err as Error).message ?? "AI split failed";
  } finally {
    splitting.value = false;
  }
}

async function saveModules() {
  if (!editableModules.value.length) return;
  savingModules.value = true;
  splitError.value = "";
  try {
    modules.value = await api.requirementModules.update(
      projectId,
      documentId,
      editableModules.value.map((m, index) => ({
        title: m.title,
        content: m.content,
        order: index + 1,
      })),
    );
    syncEditable();
  } catch (err) {
    splitError.value = (err as Error).message ?? "Save failed";
  } finally {
    savingModules.value = false;
  }
}

function moveModule(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= editableModules.value.length) return;
  const list = editableModules.value;
  [list[index], list[target]] = [list[target]!, list[index]!];
  list.forEach((m, i) => (m.order = i + 1));
}

function removeModule(index: number) {
  editableModules.value.splice(index, 1);
  editableModules.value.forEach((m, i) => (m.order = i + 1));
}

function promote(index: number, moduleId: string | undefined) {
  if (!moduleId) {
    splitError.value = "Save modules first; only persisted modules can be promoted.";
    return;
  }
  pendingPromoteId.value = moduleId;
  promoteOpen.value = true;
}

async function confirmPromote() {
  if (!pendingPromoteId.value) return;
  promoting.value = true;
  try {
    await api.requirementModules.promote(projectId, pendingPromoteId.value);
    pendingPromoteId.value = null;
    promoteOpen.value = false;
    splitError.value = "";
  } catch (err) {
    splitError.value = (err as Error).message ?? "Promote failed";
  } finally {
    promoting.value = false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusClass(status: RequirementDocumentStatus) {
  return {
    uploaded: "text-slate-700",
    processing: "text-blue-700",
    extracted: "text-emerald-700",
    failed: "text-rose-700",
  }[status];
}

async function startReview() {
  if (!document.value) return;
  reviewing.value = true;
  reviewError.value = "";
  try {
    const started = await api.requirementReviews.start(projectId, documentId);
    review.value = started;
    reports.value = [started, ...reports.value];
    if (started.status === "running" || started.status === "pending") {
      // Background LLM call may still be running; poll once after a delay.
      setTimeout(async () => {
        try {
          const refreshed = await api.requirementReviews.get(projectId, started.id);
          review.value = refreshed;
          reports.value = reports.value.map((r) => (r.id === refreshed.id ? refreshed : r));
        } catch {
          /* polling failure is non-fatal */
        }
      }, 4000);
    }
  } catch (err) {
    reviewError.value = (err as Error).message ?? "Review failed";
  } finally {
    reviewing.value = false;
  }
}

function scoreClass(score: number | undefined): string {
  if (score === undefined) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  return "text-rose-700";
}

function issueBadgeClass(severity: RequirementReviewSeverity): string {
  return {
    high: "bg-rose-100 text-rose-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-slate-100 text-slate-700",
  }[severity];
}

function issueBorderClass(severity: RequirementReviewSeverity): string {
  return {
    high: "border-rose-200 bg-rose-50/40",
    medium: "border-amber-200 bg-amber-50/40",
    low: "border-slate-200",
  }[severity];
}

function reviewStatusBadgeClass(status: RequirementReviewStatus): string {
  return {
    pending: "bg-slate-100 text-slate-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
  }[status];
}
</script>
