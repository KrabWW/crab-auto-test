<script setup lang="ts">
/**
 * Project workspace navigation — shadcn-vue + Tailwind + NuxtLink + lucide.
 *
 * Project-scoped horizontal tab nav rendered above <NuxtPage /> on the project
 * workspace shell ([id].vue). Active state is derived from useRoute().path and
 * remains on the parent workflow tab for detail routes.
 *
 * Clean-room: independently designed. No upstream layout/component copy, no
 * Arco.
 */
import { computed } from "vue";
import {
  BookOpen,
  BotMessageSquare,
  ClipboardCheck,
  Globe,
  ListTree,
  PackageCheck,
  PlayCircle,
  Settings,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-vue-next";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/components/ui/button";

interface NavEntry {
  label: string;
  slug: string;
  to: string;
  icon: LucideIcon;
  /** Optional placeholder badge, e.g. "Phase 3" for not-yet-built sections. */
  badge?: string;
}

const props = defineProps<{ projectId: string }>();

const route = useRoute();

const entries = computed<NavEntry[]>(() => {
  const base = `/projects/${props.projectId}`;
  return [
    { label: "Requirements", slug: "requirements", to: `${base}/requirements`, icon: ClipboardCheck },
    { label: "AI Generation", slug: "ai-generation", to: `${base}/ai-generation`, icon: Sparkles },
    { label: "Test Cases", slug: "test-cases", to: `${base}/test-cases`, icon: ListTree },
    { label: "Test Suites", slug: "test-suites", to: `${base}/test-suites`, icon: PackageCheck },
    { label: "API Automation", slug: "api-automation", to: `${base}/api-automation`, icon: Globe },
    { label: "Executions", slug: "executions", to: `${base}/executions`, icon: PlayCircle },
    { label: "AI Chat", slug: "chat", to: `${base}/chat`, icon: BotMessageSquare },
    { label: "Knowledge", slug: "knowledge", to: `${base}/knowledge`, icon: BookOpen },
    { label: "MCP Admin", slug: "mcp-admin", to: `${base}/mcp-admin`, icon: Wrench },
    { label: "Skills", slug: "skills", to: `${base}/skills`, icon: PackageCheck },
    { label: "Settings", slug: "settings", to: `${base}/settings`, icon: Settings },
  ];
});

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>

<template>
  <nav class="flex flex-wrap gap-1 border-b" aria-label="Project workspace">
    <NuxtLink
      v-for="entry in entries"
      :key="entry.slug"
      :to="entry.to"
      :data-testid="`nav-${entry.slug}`"
      :aria-current="isActive(entry.to) ? 'page' : undefined"
      :class="
        cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'gap-2 rounded-none border-b-2 border-transparent px-3',
          isActive(entry.to)
            ? 'border-foreground text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )
      "
    >
      <component :is="entry.icon" class="h-4 w-4" aria-hidden="true" />
      <span>{{ entry.label }}</span>
      <span
        v-if="entry.badge"
        class="ml-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        {{ entry.badge }}
      </span>
    </NuxtLink>
  </nav>
</template>
