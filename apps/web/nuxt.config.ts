// Nuxt 3 config — R6: desktop build target = SPA/static (ssr:false / nuxt generate).
// Web target may use SSR/SSG. Shared UI, dual build config.
export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: true },
  ssr: false, // SPA mode — required for Electron renderer reuse (R6)
  modules: ["@nuxtjs/tailwindcss"],
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? "http://localhost:3000/api/v1",
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  app: {
    head: {
      title: "Crab Auto Test",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
    },
  },
});
