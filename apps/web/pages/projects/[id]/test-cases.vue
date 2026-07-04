<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="font-bold">Test Cases</h2>
        <p class="text-sm text-muted-foreground">Write one executable check, then add it to a suite to run it.</p>
      </div>
      <Button @click="showNew = !showNew">{{ showNew ? "Close" : "New case" }}</Button>
    </div>

    <Card v-if="!cases.length && !showNew" class="p-4">
      <div class="font-medium">First manual case</div>
      <p class="mt-1 text-sm text-muted-foreground">
        Example: "User can log in", action "Open /login and submit valid credentials", expected "Projects page opens".
      </p>
      <Button class="mt-3" @click="showNew = true">Create test case</Button>
    </Card>

    <Card v-if="showNew" class="space-y-2 p-4">
      <Input v-model="title" placeholder="Title, e.g. User can log in" />
      <select v-model="priority" class="w-full h-10 px-3 border rounded-md bg-background">
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
        <option value="critical">critical</option>
      </select>
      <Input v-model="preconditions" placeholder="Preconditions (optional)" />
      <textarea
        v-model="action"
        class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        placeholder="Step action, e.g. Open /login and submit valid credentials"
      />
      <textarea
        v-model="expectedResult"
        class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        placeholder="Expected result, e.g. Projects page opens"
      />
      <Button :disabled="!canCreate" @click="createCase">Create</Button>
    </Card>
    <Card class="divide-y">
      <div v-for="c in cases" :key="c.id" class="p-3">
        <div class="font-medium">{{ c.title }}</div>
        <div class="text-xs text-muted-foreground">{{ c.priority }} · {{ c.origin }} · {{ c.steps.length }} steps</div>
      </div>
      <div v-if="!cases.length" class="p-3 text-sm text-muted-foreground">No test cases yet. Approve a requirement, generate draft cases, then accept them here or add a manual case.</div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
const action = ref("");
const expectedResult = ref("");

const canCreate = computed(() => title.value.trim().length > 0 && action.value.trim().length > 0);

onMounted(load);
async function load() {
  cases.value = await api.testCases.list(projectId);
}
async function createCase() {
  await api.testCases.create(projectId, {
    title: title.value.trim(),
    priority: priority.value,
    preconditions: preconditions.value.trim() || undefined,
    steps: [{ order: 1, action: action.value.trim(), expectedResult: expectedResult.value.trim() || undefined }],
  });
  title.value = ""; preconditions.value = ""; action.value = ""; expectedResult.value = "";
  showNew.value = false;
  await load();
}
</script>
