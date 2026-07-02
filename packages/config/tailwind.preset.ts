/** Shared Tailwind preset — first-party shadcn-vue + Tailwind foundation. */
import type { Config } from "tailwindcss";

export const preset: Partial<Config> = {
  content: [],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
      },
    },
  },
};

export default preset;
