/**
 * useProjectOverview — aggregates lightweight counts for a project's overview
 * home page by composing existing list endpoints client-side.
 *
 * Uses Promise.allSettled so a 401/404 on one endpoint does not break the
 * others. SSR-safe: only calls the api on the client (api.ts reads the token
 * from localStorage on the client only).
 */
import { type MaybeRef, ref, unref, watch } from "vue";
import { api } from "~/composables/api";

export interface ProjectCounts {
  testCases: number;
  executions: number;
  knowledgeBases: number;
  aiRuns: number;
}

export function useProjectOverview(projectId: MaybeRef<string>) {
  const counts = ref<ProjectCounts>({
    testCases: 0,
    executions: 0,
    knowledgeBases: 0,
    aiRuns: 0,
  });
  const loading = ref(false);
  const error = ref<Error | null>(null);

  async function refresh() {
    // SSR guard: api.ts reads the auth token from localStorage, which only
    // exists on the client. Skip fetching during SSR.
    if (!import.meta.client) return;
    const id = unref(projectId);
    if (!id) return;

    loading.value = true;
    error.value = null;

    const results = await Promise.allSettled([
      api.testCases.list(id),
      api.executions.list(id),
      api.knowledge.listKbs(id),
      // AI has no list endpoint in api.ts; resolve 0 so the slot stays
      // composable-backed and never throws.
      Promise.resolve([]),
    ]);

    const next: ProjectCounts = {
      testCases: 0,
      executions: 0,
      knowledgeBases: 0,
      aiRuns: 0,
    };
    const errors: Error[] = [];

    const [tc, ex, kb] = results;
    if (tc.status === "fulfilled") next.testCases = tc.value.length;
    else errors.push(tc.reason instanceof Error ? tc.reason : new Error(String(tc.reason)));
    if (ex.status === "fulfilled") next.executions = ex.value.length;
    else errors.push(ex.reason instanceof Error ? ex.reason : new Error(String(ex.reason)));
    if (kb.status === "fulfilled") next.knowledgeBases = kb.value.length;
    else errors.push(kb.reason instanceof Error ? kb.reason : new Error(String(kb.reason)));

    counts.value = next;
    error.value = errors.length ? errors[0]! : null;
    loading.value = false;
  }

  // Re-fetch when the project id ref changes.
  watch(
    () => unref(projectId),
    () => void refresh(),
    { immediate: true },
  );

  return { counts, loading, error, refresh };
}
