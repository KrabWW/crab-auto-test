/**
 * Auth store (Pinia) — replaces useSession composable.
 *
 * Persistence contract:
 *   - localStorage key `crab.token` is the source of truth for the token
 *     (preserved for E2E continuity — see tests/e2e/_helpers.ts).
 *   - User payload is hydrated via api.auth.me() on app boot when a token
 *     exists but the user is not yet loaded.
 */
import { defineStore } from "pinia";
import type { SessionDto } from "@crab/shared-types";

interface AuthState {
  token: string | null;
  user: SessionDto["user"] | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    token: import.meta.client ? localStorage.getItem("crab.token") : null,
    user: null,
  }),

  getters: {
    isAuthenticated: (state) => state.token != null,
    isAdmin: (state) => state.user?.isAdmin === true,
  },

  actions: {
    setSession(s: SessionDto) {
      this.token = s.token;
      this.user = s.user;
      if (import.meta.client) localStorage.setItem("crab.token", s.token);
    },

    setUser(user: SessionDto["user"]) {
      this.user = user;
    },

    clear() {
      this.token = null;
      this.user = null;
      if (import.meta.client) localStorage.removeItem("crab.token");
    },
  },
});
