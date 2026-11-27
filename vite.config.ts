import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export a function to access the Vite mode
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()];
  if (mode === "singlefile") {
    plugins.push(viteSingleFile());
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    worker: {
      format: "es",
    },
  };
});
