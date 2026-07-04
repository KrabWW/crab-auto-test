<template>
  <a-layout class="layout-wrapper">
    <a-layout-sider
      v-model:collapsed="collapsed"
      :width="220"
      :collapsed-width="64"
      :collapsible="true"
      breakpoint="lg"
      class="layout-sider"
    >
      <div class="logo">
        <span class="logo-mark">CT</span>
        <transition name="fade">
          <span v-if="!collapsed" class="logo-text">Crab Auto Test</span>
        </transition>
      </div>
      <a-menu
        :selected-keys="selectedKeys"
        :default-open-keys="['projects']"
        :collapsed="collapsed"
        @menu-item-click="onMenuClick"
      >
        <a-menu-item key="projects">
          <template #icon><icon-folder /></template>
          Projects
        </a-menu-item>
        <a-menu-item key="audit">
          <template #icon><icon-history /></template>
          Audit Logs
        </a-menu-item>
        <a-menu-item v-if="authStore.isAdmin" key="model-providers">
          <template #icon><icon-bulb /></template>
          Model Providers
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout class="layout-main">
      <a-layout-header class="layout-header">
        <div class="header-left">
          <a-button
            type="text"
            size="small"
            :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="collapsed = !collapsed"
          >
            <template #icon>
              <icon-menu-fold v-if="!collapsed" />
              <icon-menu-unfold v-else />
            </template>
          </a-button>
        </div>
        <div class="header-right">
          <a-button
            type="text"
            size="small"
            :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggle"
          >
            <template #icon>
              <icon-sun-fill v-if="theme === 'dark'" />
              <icon-moon-fill v-else />
            </template>
          </a-button>
          <a-dropdown v-if="authStore.isAuthenticated" position="br">
            <a-button type="text" size="small">
              <template #icon><icon-user /></template>
              <span class="user-name">{{ displayName }}</span>
            </a-button>
            <template #content>
              <a-doption @click="onLogout">
                <template #icon><icon-export /></template>
                Log out
              </a-doption>
            </template>
          </a-dropdown>
          <NuxtLink v-else to="/auth/login">
            <a-button type="text" size="small">Log in</a-button>
          </NuxtLink>
        </div>
      </a-layout-header>
      <a-layout-content class="layout-content">
        <slot />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useAuthStore } from "~/stores/auth";
import { useTheme } from "~/composables/useTheme";

const authStore = useAuthStore();
const { theme, toggle } = useTheme();
const collapsed = ref(false);

const selectedKeys = computed<string[]>(() => {
  const route = useRoute();
  if (route.path.startsWith("/projects")) return ["projects"];
  if (route.path.startsWith("/audit")) return ["audit"];
  if (route.path.startsWith("/model-providers")) return ["model-providers"];
  return [];
});

const displayName = computed(() => {
  const u = authStore.user;
  return u?.displayName || u?.email || "User";
});

function onMenuClick(key: string) {
  const map: Record<string, string> = {
    projects: "/projects",
    audit: "/audit",
    "model-providers": "/model-providers",
  };
  const target = map[key];
  if (target) navigateTo(target);
}

function onLogout() {
  authStore.clear();
  navigateTo("/auth/login");
}
</script>

<style scoped>
.layout-wrapper {
  min-height: 100vh;
}
.layout-sider {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: auto;
  box-shadow: 1px 0 0 0 var(--color-border-2);
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 16px;
  font-weight: 600;
  font-size: 16px;
  border-bottom: 1px solid var(--color-border-2);
  white-space: nowrap;
  overflow: hidden;
}
.logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--color-primary-light-1);
  color: var(--color-primary-6);
  font-size: 12px;
  flex-shrink: 0;
}
.logo-text {
  color: var(--color-text-1);
}
.layout-main {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
  background-color: var(--color-bg-2);
  border-bottom: 1px solid var(--color-border-2);
  position: sticky;
  top: 0;
  z-index: 10;
}
.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-name {
  margin-left: 4px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.layout-content {
  flex: 1;
  padding: 16px 24px;
  background-color: var(--color-fill-1);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
