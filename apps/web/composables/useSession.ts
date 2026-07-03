/**
 * useSession — backwards-compatible composable that delegates to the Pinia
 * authStore. Existing call sites (layouts/default.vue, login.vue, etc.) keep
 * working unchanged while we migrate to direct store usage.
 *
 * New code should prefer `useAuthStore()` directly.
 */
import { useAuthStore } from "~/stores/auth";

export function useSession() {
  const store = useAuthStore();

  return {
    session: store.user ? { token: store.token!, user: store.user } : null,
    token: store.token,
    isAuthenticated: () => store.isAuthenticated,
    setSession: (s: Parameters<typeof store.setSession>[0]) => store.setSession(s),
    clear: () => store.clear(),
  };
}
