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
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">Module split</h3>
          <p class="text-sm text-muted-foreground">
            AI-generated functional modules will appear here after the next migration commit.
          </p>
        </div>
        <Button variant="outline" disabled>Auto-split modules (coming next)</Button>
      </div>
    </Card>

    <Card class="p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">AI review report</h3>
          <p class="text-sm text-muted-foreground">
            The 4-dimension review report (clarity / completeness / testability / boundaries) will land in the next migration commit.
          </p>
        </div>
        <Button variant="outline" disabled>Run AI review (coming next)</Button>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { RequirementDocumentDto, RequirementDocumentStatus } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const documentId = route.params.documentId as string;

const document = ref<RequirementDocumentDto | null>(null);
const loading = ref(false);
const error = ref("");
const showText = ref(true);

onMounted(load);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    document.value = await api.requirementDocuments.get(projectId, documentId);
  } catch (err) {
    error.value = (err as Error).message ?? "Failed to load document";
  } finally {
    loading.value = false;
  }
}

async function reExtract() {
  if (!document.value) return;
  try {
    document.value = await api.requirementDocuments.extract(projectId, documentId);
  } catch (err) {
    error.value = (err as Error).message ?? "Re-extract failed";
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
</script>
