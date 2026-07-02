/** Session composable — thin client auth state (no LLM/MCP/Prisma). */
import { ref, readonly } from "vue";
import type { SessionDto } from "@crab/shared-types";

const session = ref<SessionDto | null>(null);
const token = ref<string | null>(localStorage.getItem("crab.token"));

export function useSession() {
  function setSession(s: SessionDto) {
    session.value = s;
    token.value = s.token;
    localStorage.setItem("crab.token", s.token);
  }
  function clear() {
    session.value = null;
    token.value = null;
    localStorage.removeItem("crab.token");
  }
  return {
    session: readonly(session),
    token: readonly(token),
    isAuthenticated: () => token.value != null,
    setSession,
    clear,
  };
}
