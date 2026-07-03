<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <ClientOnly>
      <a-card class="w-full max-w-sm" :bordered="false">
        <h1 class="text-xl font-bold mb-4">Sign in</h1>
        <a-form :model="form" layout="vertical" @submit-success="onSubmit">
          <a-form-item
            field="email"
            label="Email"
            :rules="[{ required: true, message: 'Email is required' }]"
          >
            <a-input
              v-model="form.email"
              placeholder="Email"
              allow-clear
            />
          </a-form-item>
          <a-form-item
            field="password"
            label="Password"
            :rules="[{ required: true, message: 'Password is required' }]"
          >
            <a-input-password
              v-model="form.password"
              placeholder="Password"
              allow-clear
            />
          </a-form-item>
          <a-alert v-if="error" type="error" class="mb-4">{{ error }}</a-alert>
          <a-button type="primary" html-type="submit" long :loading="loading">
            Login
          </a-button>
        </a-form>
      </a-card>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { api } from "~/composables/api";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });
const authStore = useAuthStore();

const form = reactive({ email: "", password: "" });
const error = ref<string | null>(null);
const loading = ref(false);

async function onSubmit() {
  error.value = null;
  loading.value = true;
  try {
    const s = await api.auth.login({ email: form.email, password: form.password });
    authStore.setSession(s);
    await navigateTo("/projects");
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>
