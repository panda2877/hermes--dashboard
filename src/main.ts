import { createSSRApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
// 预编译的 uView CSS（已内嵌深色主题变量，覆盖所有组件样式）
import "./styles/uview.css";

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  return {
    app,
  };
}
