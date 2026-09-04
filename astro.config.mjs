import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://oogabooga.rocks",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  vite: {
    build: { target: "es2022" },
  },
});
