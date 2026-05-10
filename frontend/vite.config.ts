import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  // nodePolyfills нужен для @ton/core, который под капотом тянет Buffer
  // и process. Без полифиллов на /admin падает Uncaught ReferenceError:
  // Buffer is not defined.
  plugins: [react(), nodePolyfills({ globals: { Buffer: true, process: true } })],
  server: {
    port: 5173,
    host: true,
  },
});
