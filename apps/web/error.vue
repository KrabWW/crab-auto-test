<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <div class="text-center">
      <h1 class="text-2xl font-bold mb-2">{{ error?.statusCode ?? 'Error' }}</h1>
      <p class="text-muted-foreground mb-4">{{ error?.message ?? 'Something went wrong' }}</p>
      <button class="px-4 py-2 rounded bg-primary text-primary-foreground" @click="handleError">
        Back to home
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; message?: string } }>();
const handleError = () => clearError({ redirect: "/" });
</script>