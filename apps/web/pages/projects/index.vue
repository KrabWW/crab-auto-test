<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">Projects</h1>
      <Button @click="showNew = !showNew">New project</Button>
    </div>
    <Card v-if="showNew" class="p-4 space-y-2">
      <Input v-model="newName" placeholder="Name" />
      <Input v-model="newSlug" placeholder="Slug" />
      <Input v-model="newDesc" placeholder="Description" />
      <Button @click="createProject">Create</Button>
    </Card>
    <Card class="divide-y">
      <NuxtLink
        v-for="p in projects"
        :key="p.id"
        :to="`/projects/${p.id}`"
        class="block p-3 hover:bg-muted/50"
      >
        <div class="font-medium">{{ p.name }}</div>
        <div class="text-sm text-muted-foreground">{{ p.slug }}</div>
      </NuxtLink>
      <div v-if="!projects.length" class="p-3 text-sm text-muted-foreground">No projects yet.</div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";
import type { ProjectDto } from "@crab/shared-types";

const projects = ref<ProjectDto[]>([]);
const showNew = ref(false);
const newName = ref("");
const newSlug = ref("");
const newDesc = ref("");

onMounted(load);
async function load() {
  projects.value = await api.projects.list();
}
async function createProject() {
  await api.projects.create({ name: newName.value, slug: newSlug.value, description: newDesc.value });
  newName.value = ""; newSlug.value = ""; newDesc.value = "";
  showNew.value = false;
  await load();
}
</script>
