/**
 * Theme toggle — light/dark with localStorage persistence.
 *
 * - Arco dark mode: sets `arco-theme="dark"` on <body>
 * - Tailwind dark mode: sets `dark` class on <html> (requires darkMode: 'class')
 *
 * Persists choice under `crab.theme` (matches `crab.token` naming convention).
 */
import { ref } from "vue";

type Theme = "light" | "dark";

const STORAGE_KEY = "crab.theme";
const theme = ref<Theme>("light");

function apply(t: Theme) {
  if (!import.meta.client) return;
  const html = document.documentElement;
  const body = document.body;
  if (t === "dark") {
    html.classList.add("dark");
    body.setAttribute("arco-theme", "dark");
  } else {
    html.classList.remove("dark");
    body.removeAttribute("arco-theme");
  }
}

if (import.meta.client) {
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  theme.value = saved === "dark" ? "dark" : "light";
  apply(theme.value);
}

export function useTheme() {
  function toggle() {
    theme.value = theme.value === "dark" ? "light" : "dark";
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, theme.value);
      apply(theme.value);
    }
  }
  return { theme, toggle };
}
