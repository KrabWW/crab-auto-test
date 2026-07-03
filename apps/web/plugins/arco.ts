/**
 * Arco Design Vue plugin — registers all components, icons, and styles globally.
 *
 * Loaded via nuxt.config.ts `plugins` array. Runs before app mount so
 * Arco components are available in every page/component.
 *
 * Locale: zh-CN (Chinese Simplified) — UI copy is Chinese throughout the app.
 */
import ArcoVue from "@arco-design/web-vue";
import ArcoVueIcon from "@arco-design/web-vue/es/icon";
import zhCN from "@arco-design/web-vue/es/locale/lang/zh-cn";
import "@arco-design/web-vue/dist/arco.css";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(ArcoVue, { locale: zhCN });
  nuxtApp.vueApp.use(ArcoVueIcon);
});
