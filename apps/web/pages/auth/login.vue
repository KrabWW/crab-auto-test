<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <Card class="w-full max-w-sm p-6 space-y-4">
      <h1 class="text-xl font-bold">Sign in</h1>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <Input v-model="email" type="email" placeholder="Email" />
      <Input v-model="password" type="password" placeholder="Password" />
      <Button class="w-full" @click="onSubmit">Login</Button>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "~/composables/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card } from "~/components/ui/card";

definePageMeta({ layout: "auth" });
const { setSession } = useSession();

const email = ref("");
const password = ref("");
const error = ref<string | null>(null);

async function onSubmit() {
  error.value = null;
  try {
    const s = await api.auth.login({ email: email.value, password: password.value });
    setSession(s);
    await navigateTo("/projects");
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>
