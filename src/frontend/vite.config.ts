import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import type { AppConfig } from "../lib/types.ts";

const config = parseYaml(
  readFileSync(resolve(__dirname, "../../ralph-monitor.yaml"), "utf-8"),
) as AppConfig;
const serverPort = config.server?.port ?? 3000;

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      "/api": `http://localhost:${serverPort}`,
      "/ws": {
        target: `ws://localhost:${serverPort}`,
        ws: true,
      },
    },
  },
});
