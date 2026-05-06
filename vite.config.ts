import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 注入深色主题变量 via @use 前缀（现代 Sass 模块语法）
        additionalData: `@use "${path.resolve(__dirname, "src/styles/variables.scss").replace(/\\/g, "/")}" as *; `,
        silenceDeprecations: ["legacy-js-api", "import"],
      },
    },
  },
  // uView 2.x 需 transpile 才能在 Vue 3 下正确运行
  optimizeDeps: {
    include: ["uview-ui"],
  },
});
