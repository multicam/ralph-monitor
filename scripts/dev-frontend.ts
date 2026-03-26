import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import type { AppConfig } from "../src/lib/types.ts";

const configPath = resolve(import.meta.dirname!, "../ralph-monitor.yaml");
const config = existsSync(configPath)
  ? (parseYaml(readFileSync(configPath, "utf-8")) as AppConfig)
  : undefined;
const port = config?.frontend?.port ?? 5173;

const proc = Bun.spawn(["bunx", "vite", "dev", "--port", String(port)], {
  cwd: resolve(import.meta.dirname!, "../src/frontend"),
  stdout: "inherit",
  stderr: "inherit",
});

await proc.exited;
