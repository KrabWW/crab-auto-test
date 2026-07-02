<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="font-bold">🦀 Crab Auto Test</NuxtLink>
        <nav class="flex gap-4 text-sm">
          <NuxtLink to="/projects">Projects</NuxtLink>
          <NuxtLink v-if="!isAuthenticated()" to="/auth/login">Login</NuxtLink>
          <button v-else class="text-muted-foreground" @click="logout">Logout</button>
        </nav>
      </div>
    </header>
    <main class="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { isAuthenticated, clear } = useSession();
function logout() {
  clear();
  navigateTo("/auth/login");
}
</script>
