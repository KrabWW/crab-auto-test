/**
 * Project workspace summary composable.
 *
 * The overview page uses one project-scoped backend summary endpoint instead
 * of stitching together multiple list endpoints in the browser. That keeps the
 * dashboard fast, avoids partial stale counts, and leaves project membership
 * enforcement on the API boundary.
 */
import { type MaybeRef, computed, ref, unref, watch } from "vue";
import { api } from "~/composables/api";
import type { ProjectWorkspaceSummaryDto } from "@crab/shared-types";

const emptyCounts: ProjectWorkspaceSummaryDto["counts"] = {
  testCases: 0,
  testSuites: 0,
  executions: 0,
  queuedExecutions: 0,
  failedExecutions: 0,
  reportArtifacts: 0,
  apiCases: 0,
  apiExecutions: 0,
  requirements: 0,
  approvedRequirements: 0,
  aiRuns: 0,
  aiGeneratedCases: 0,
  knowledgeBases: 0,
  knowledgeDocuments: 0,
  chatSessions: 0,
  mcpTools: 0,
  approvedMcpTools: 0,
  skills: 0,
  enabledSkills: 0,
};

export function useProjectOverview(projectId: MaybeRef<string>) {
  const summary = ref<ProjectWorkspaceSummaryDto | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const counts = computed(() => summary.value?.counts ?? emptyCounts);

  async function refresh() {
    if (!import.meta.client) return;
    const id = unref(projectId);
    if (!id) return;

    loading.value = true;
    error.value = null;
    summary.value = null;
    try {
      summary.value = await api.projects.workspaceSummary(id);
    } catch (err) {
      summary.value = null;
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      loading.value = false;
    }
  }

  watch(
    () => unref(projectId),
    () => void refresh(),
    { immediate: true },
  );

  return { counts, summary, loading, error, refresh };
}
