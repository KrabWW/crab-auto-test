<template>
  <div class="flex flex-col gap-4">
    <Card class="p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">Knowledge/RAG</p>
          <h2 class="text-xl font-bold">Knowledge Base</h2>
          <p class="text-sm text-muted-foreground">
            Manage project documents, inspect chunks, and diagnose retrieval evidence with source attribution.
          </p>
        </div>
        <Button :disabled="loading || !ready" @click="loadKbs">Refresh</Button>
      </div>
    </Card>

    <div class="grid gap-3 md:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label" class="p-4">
        <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ stat.label }}</div>
        <div class="mt-2 text-2xl font-semibold tabular-nums">{{ stat.value }}</div>
        <div class="mt-1 text-xs text-muted-foreground">{{ stat.detail }}</div>
      </Card>
    </div>

    <div v-if="error" class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {{ error }}
    </div>
    <div v-if="notice" class="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
      {{ notice }}
    </div>

    <div class="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div class="flex flex-col gap-4">
        <Card class="p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold">Knowledge bases</h3>
              <p class="text-sm text-muted-foreground">Project-scoped document collections.</p>
            </div>
            <Button size="sm" variant="outline" :disabled="!ready" @click="showNewKb = !showNewKb">New KB</Button>
          </div>

          <div v-if="showNewKb" class="mt-4 grid gap-2">
            <Input v-model="newKbName" data-testid="kb-name" placeholder="KB name" />
            <Input v-model="newKbDesc" data-testid="kb-description" placeholder="Description (optional)" />
            <Button data-testid="kb-create" :disabled="loading || !ready || !newKbName.trim()" @click="createKb">Create</Button>
          </div>
        </Card>

        <Card class="overflow-hidden">
          <button
            v-for="kb in kbs"
            :key="kb.id"
            class="block w-full p-4 text-left transition hover:bg-muted/40"
            :class="activeKbId === kb.id ? 'bg-accent/60' : ''"
            :data-testid="`kb-row-${kb.id}`"
            @click="selectKb(kb.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ kb.name }}</span>
              <span class="rounded-full bg-muted px-2 py-1 text-xs">{{ kb.documentCount }} docs</span>
            </div>
            <div class="mt-1 text-xs text-muted-foreground">{{ kb.description ?? "No description" }}</div>
          </button>
          <div v-if="!kbs.length" class="p-4 text-sm text-muted-foreground">No knowledge bases yet.</div>
        </Card>
      </div>

      <div v-if="activeKb" class="grid gap-4">
        <Card class="p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active KB</p>
              <h3 class="text-lg font-semibold">{{ activeKb.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ activeKb.description ?? "No description" }}</p>
            </div>
            <div class="text-right text-xs text-muted-foreground">
              <div>Created {{ formatDate(activeKb.createdAt) }}</div>
              <div>Updated {{ formatDate(activeKb.updatedAt) }}</div>
            </div>
          </div>
        </Card>

        <div class="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div class="grid gap-4">
            <Card class="p-4">
              <h3 class="font-semibold">Ingest document</h3>
              <p class="text-sm text-muted-foreground">Plain text is chunked with source metadata and embedded for retrieval.</p>
              <div class="mt-4 grid gap-2">
                <Input v-model="uploadFilename" data-testid="kb-upload-filename" placeholder="filename.txt" />
                <textarea
                  v-model="uploadContent"
                  data-testid="kb-upload-content"
                  placeholder="Paste document content..."
                  class="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button data-testid="kb-ingest" :disabled="loading || !ready || !canIngest" @click="ingest">Ingest document</Button>
              </div>
            </Card>

            <Card class="overflow-hidden">
              <div class="border-b p-4">
                <h3 class="font-semibold">Documents</h3>
                <p class="text-sm text-muted-foreground">Select a document to inspect chunks.</p>
              </div>
              <button
                v-for="doc in docs"
                :key="doc.id"
                class="block w-full p-4 text-left transition hover:bg-muted/40"
                :class="selectedDocId === doc.id ? 'bg-accent/60' : ''"
                :data-testid="`kb-doc-${doc.id}`"
                @click="selectDocument(doc.id)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium">{{ doc.filename }}</span>
                  <span class="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">{{ doc.status }}</span>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">
                  {{ doc.chunkCount }} chunks / {{ formatBytes(doc.sizeBytes) }} / {{ shortChecksum(doc.checksum) }}
                </div>
              </button>
              <div v-if="!docs.length" class="p-4 text-sm text-muted-foreground">No documents yet.</div>
            </Card>
          </div>

          <Card class="p-4" data-testid="kb-chunks">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="font-semibold">Document chunks</h3>
                <p class="text-sm text-muted-foreground">Order, token count, source metadata, and text preview.</p>
              </div>
              <span v-if="selectedDoc" class="rounded-full bg-muted px-2 py-1 text-xs">{{ selectedDoc.chunkCount }} chunks</span>
            </div>
            <div v-if="!selectedDoc" class="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Select a document to inspect its chunks.
            </div>
            <div v-else-if="!chunks.length" class="mt-4 text-sm text-muted-foreground">No chunks found.</div>
            <div v-for="chunk in chunks" :key="chunk.id" class="mt-4 rounded-md border p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-medium">Chunk {{ chunk.order + 1 }}</span>
                <span class="text-xs text-muted-foreground">{{ chunk.tokenCount }} tokens / embedding {{ chunk.hasEmbedding ? "ready" : "missing" }}</span>
              </div>
              <p class="mt-2 text-sm">{{ chunk.textPreview }}</p>
              <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>section={{ chunk.sourceMetadata?.section ?? "-" }}</span>
                <span>page={{ chunk.sourceMetadata?.page ?? "-" }}</span>
                <span>source={{ chunk.sourceMetadata?.filename ?? selectedDoc?.filename ?? "-" }}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card class="p-4" data-testid="kb-diagnostics">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 class="font-semibold">Retrieval diagnostics</h3>
              <p class="text-sm text-muted-foreground">Review backend/model, scores, selected sources, and source attribution.</p>
            </div>
            <div class="flex min-w-72 flex-1 gap-2 sm:flex-none">
              <Input v-model="diagQuery" data-testid="kb-diag-query" placeholder="Query knowledge..." />
              <Button data-testid="kb-run-diag" :disabled="loading || !ready || !diagQuery.trim()" @click="runDiag">Run</Button>
            </div>
          </div>

          <div v-if="diagResult" class="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div>
              <div class="text-sm text-muted-foreground">
                {{ diagResult.backend }} / {{ diagResult.model }} / query: {{ diagResult.query }}
              </div>
              <div
                v-if="diagResult.usingStubVectors"
                class="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800"
                data-testid="kb-stub-vector-warning"
              >
                <strong>Stub-vector mode.</strong> No embeddings provider is configured (or it returned unexpected dimensions), so retrieval is using a deterministic-hash fallback. Results are useful for plumbing tests but are <em>not</em> production-quality semantic matches. Configure an embeddings provider in project settings to enable real retrieval.
              </div>
              <div v-if="!diagResult.matchedChunks.length" class="mt-3 text-sm text-muted-foreground">No matches.</div>
              <div v-for="match in diagResult.matchedChunks" :key="match.chunkId" class="mt-3 rounded-md border p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-medium">{{ match.filename ?? "Unknown source" }}</span>
                  <span class="text-xs tabular-nums text-muted-foreground">score {{ match.score.toFixed(3) }}</span>
                </div>
                <p class="mt-2 text-sm">{{ match.textPreview ?? "No preview available" }}</p>
                <div class="mt-2 text-xs text-muted-foreground">
                  doc={{ match.documentId || "-" }} / chunk={{ match.chunkId }} / section={{ match.sourceMetadata?.section ?? "-" }} / page={{ match.sourceMetadata?.page ?? "-" }}
                </div>
              </div>
            </div>
            <div class="rounded-md bg-muted/40 p-3">
              <h4 class="font-medium">Selected sources</h4>
              <div v-if="!diagResult.selectedSources.length" class="mt-2 text-sm text-muted-foreground">No selected sources.</div>
              <div v-for="source in diagResult.selectedSources" :key="source.chunkId" class="mt-3 rounded bg-background p-2 text-sm">
                <div class="font-medium">{{ source.filename ?? source.chunkId }}</div>
                <div class="text-xs text-muted-foreground">
                  section={{ source.section ?? "-" }} / page={{ source.page ?? "-" }} / score={{ source.score?.toFixed(3) ?? "-" }}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card v-else class="p-6 text-sm text-muted-foreground">
        Create or select a knowledge base to manage documents and retrieval diagnostics.
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";
import type { KnowledgeBaseDto, KnowledgeChunkDto, KnowledgeDocumentDto, KnowledgeRetrievalDiagnosticDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;

const ready = ref(false);
const loading = ref(false);
const error = ref("");
const notice = ref("");
const kbs = ref<KnowledgeBaseDto[]>([]);
const showNewKb = ref(false);
const newKbName = ref("");
const newKbDesc = ref("");
const activeKbId = ref("");
const docs = ref<KnowledgeDocumentDto[]>([]);
const selectedDocId = ref("");
const chunks = ref<KnowledgeChunkDto[]>([]);
const uploadFilename = ref("");
const uploadContent = ref("");
const diagQuery = ref("");
const diagResult = ref<KnowledgeRetrievalDiagnosticDto | null>(null);

const activeKb = computed(() => kbs.value.find((kb) => kb.id === activeKbId.value) ?? null);
const selectedDoc = computed(() => docs.value.find((doc) => doc.id === selectedDocId.value) ?? null);
const canIngest = computed(() => !!activeKbId.value && !!uploadFilename.value.trim() && !!uploadContent.value.trim());
const stats = computed(() => [
  { label: "Knowledge bases", value: kbs.value.length, detail: "Project collections" },
  { label: "Documents", value: docs.value.length, detail: "In active KB" },
  { label: "Chunks", value: docs.value.reduce((sum, doc) => sum + doc.chunkCount, 0), detail: "In active KB" },
  { label: "Matches", value: diagResult.value?.matchedChunks.length ?? 0, detail: "Last diagnostic" },
]);

onMounted(() => {
  ready.value = true;
  void loadKbs();
});

async function loadKbs() {
  await run(async () => {
    kbs.value = await api.knowledge.listKbs(projectId);
    if (!kbs.value.some((kb) => kb.id === activeKbId.value)) {
      activeKbId.value = kbs.value[0]?.id ?? "";
    }
    if (activeKbId.value) await loadDocs(activeKbId.value);
  });
}

async function createKb() {
  await run(async () => {
    const created = await api.knowledge.createKb(projectId, { name: newKbName.value.trim(), description: newKbDesc.value.trim() || undefined });
    newKbName.value = "";
    newKbDesc.value = "";
    showNewKb.value = false;
    notice.value = "Knowledge base created.";
    kbs.value = await api.knowledge.listKbs(projectId);
    await selectKb(created.id);
  });
}

async function selectKb(kbId: string) {
  activeKbId.value = kbId;
  diagResult.value = null;
  await loadDocs(kbId);
}

async function loadDocs(kbId: string) {
  docs.value = await api.knowledge.listDocs(projectId, kbId);
  if (!docs.value.some((doc) => doc.id === selectedDocId.value)) {
    selectedDocId.value = docs.value[0]?.id ?? "";
  }
  chunks.value = selectedDocId.value ? await api.knowledge.chunks(projectId, kbId, selectedDocId.value) : [];
}

async function ingest() {
  if (!activeKbId.value) return;
  await run(async () => {
    const doc = await api.knowledge.ingest(projectId, activeKbId.value, {
      filename: uploadFilename.value.trim(),
      mimeType: "text/plain",
      content: uploadContent.value,
    });
    uploadFilename.value = "";
    uploadContent.value = "";
    notice.value = "Document ingested and chunked.";
    docs.value = await api.knowledge.listDocs(projectId, activeKbId.value);
    await selectDocument(doc.id);
    kbs.value = await api.knowledge.listKbs(projectId);
  });
}

async function selectDocument(documentId: string) {
  if (!activeKbId.value) return;
  selectedDocId.value = documentId;
  chunks.value = await api.knowledge.chunks(projectId, activeKbId.value, documentId);
}

async function runDiag() {
  await run(async () => {
    diagResult.value = await api.knowledge.diagnose(projectId, diagQuery.value.trim());
    notice.value = "Retrieval diagnostics updated.";
  });
}

async function run(fn: () => Promise<void>) {
  loading.value = true;
  error.value = "";
  notice.value = "";
  try {
    await fn();
  } catch (err) {
    error.value = (err as Error).message || "Knowledge operation failed";
  } finally {
    loading.value = false;
  }
}

function shortChecksum(checksum: string) {
  return checksum.slice(0, 8);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
</script>
