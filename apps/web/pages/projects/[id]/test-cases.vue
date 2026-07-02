<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="font-bold">Test Cases</h2>
      <Button @click="showNew = !showNew">New case</Button>
    </div>
    <Card v-if="showNew" class="p-4 space-y-2">
      <Input v-model="title" placeholder="Title" />
      <select v-model="priority" class="w-full h-10 px-3 border rounded-md bg-background">
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
        <option value="critical">critical</option>
      </select>
      <Input v-model="preconditions" placeholder="Preconditions" />
      <Button @click="createCase">Create</Button>
    </Card>
    <Card class="divide-y">
      <div v-for="c in cases" :key="c.id" class="p-3">
        <div class="font-medium">{{ c.title }}</div>
        <div class="text-xs text-muted-foreground">{{ c.priority }} · {{ c.origin }} · {{ c.steps.length }} steps</div>
      </div>
      <div v-if="!cases.length" class="p-3 text-sm text-muted-foreground">No test cases yet.</div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";
import type { TestCaseDto } from "@crab/shared-types";

const route = useRoute();
const projectId = route.params.id as string;
const cases = ref<TestCaseDto[]>([]);
const showNew = ref(false);
const title = ref("");
const priority = ref<"low" | "medium" | "high" | "critical">("medium");
const preconditions = ref("");

onMounted(load);
async function load() {
  cases.value = await api.testCases.list(projectId);
}
async function createCase() {
  await api.testCases.create(projectId, {
    title: title.value,
    priority: priority.value,
    preconditions: preconditions.value,
    steps: [{ order: 1, action: "Placeholder step", expectedResult: "Succeeds" }],
  });
  title.value = ""; preconditions.value = "";
  showNew.value = false;
  await load();
}
</script>
