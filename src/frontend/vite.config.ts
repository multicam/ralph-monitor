import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import type { AppConfig } from "../lib/types.ts";

const configPath = resolve(__dirname, "../../ralph-monitor.yaml");
const config = existsSync(configPath)
  ? (parseYaml(readFileSync(configPath, "utf-8")) as AppConfig)
  : undefined;
const serverPort = config?.server?.port ?? 4020;

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
