<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="font-bold">Knowledge Base</h2>
      <Button @click="showNewKb = !showNewKb">New KB</Button>
    </div>

    <Card v-if="showNewKb" class="p-4 space-y-2">
      <Input v-model="newKbName" placeholder="KB name" />
      <Input v-model="newKbDesc" placeholder="Description (optional)" />
      <Button @click="createKb">Create</Button>
    </Card>

    <Card class="divide-y">
      <button
        v-for="kb in kbs"
        :key="kb.id"
        class="w-full text-left p-3 hover:bg-muted/50"
        @click="selectKb(kb.id)"
      >
        <div class="font-medium">{{ kb.name }}</div>
        <div class="text-xs text-muted-foreground">{{ kb.description ?? "no description" }}</div>
      </button>
      <div v-if="!kbs.length" class="p-3 text-sm text-muted-foreground">No knowledge bases yet.</div>
    </Card>

    <div v-if="activeKbId" class="space-y-3">
      <h3 class="font-semibold">Documents</h3>
      <Card class="p-4 space-y-2">
        <Input v-model="uploadFilename" placeholder="filename.txt" />
        <textarea
          v-model="uploadContent"
          placeholder="Paste document content..."
          class="w-full h-24 px-3 py-2 border rounded-md bg-background text-sm"
        />
        <Button @click="ingest">Ingest document</Button>
      </Card>
      <Card class="divide-y">
        <div v-for="d in docs" :key="d.id" class="p-3">
          <div class="font-medium">{{ d.filename }}</div>
          <div class="text-xs text-muted-foreground">{{ d.status }}</div>
        </div>
        <div v-if="!docs.length" class="p-3 text-sm text-muted-foreground">No documents yet.</div>
      </Card>

      <h3 class="font-semibold pt-2">Retrieval diagnostics</h3>
      <Card class="p-4 space-y-2">
        <Input v-model="diagQuery" placeholder="Query..." />
        <Button @click="runDiag">Run diagnostics</Button>
        <pre v-if="diagResult" class="text-xs bg-muted p-2 rounded overflow-auto max-h-64">{{ JSON.stringify(diagResult, null, 2) }}</pre>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";

const route = useRoute();
const projectId = route.params.id as string;

const kbs = ref<Array<{ id: string; name: string; description?: string }>>([]);
const showNewKb = ref(false);
const newKbName = ref("");
const newKbDesc = ref("");
const activeKbId = ref<string | null>(null);
const docs = ref<Array<{ id: string; filename: string; status: string }>>([]);
const uploadFilename = ref("");
const uploadContent = ref("");
const diagQuery = ref("");
const diagResult = ref<unknown>(null);

onMounted(loadKbs);
async function loadKbs() {
  kbs.value = await api.knowledge.listKbs(projectId);
}
async function createKb() {
  await api.knowledge.createKb(projectId, newKbName.value, newKbDesc.value);
  newKbName.value = ""; newKbDesc.value = "";
  showNewKb.value = false;
  await loadKbs();
}
async function selectKb(kbId: string) {
  activeKbId.value = kbId;
  docs.value = await api.knowledge.listDocs(projectId, kbId);
}
async function ingest() {
  if (!activeKbId.value) return;
  await api.knowledge.ingest(projectId, activeKbId.value, {
    filename: uploadFilename.value,
    mimeType: "text/plain",
    content: uploadContent.value,
  });
  uploadFilename.value = ""; uploadContent.value = "";
  docs.value = await api.knowledge.listDocs(projectId, activeKbId.value);
}
async function runDiag() {
  diagResult.value = await api.knowledge.diagnose(projectId, diagQuery.value);
}
</script>
