import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import type { AppConfig } from "../src/lib/types.ts";

const config = parseYaml(
  readFileSync(resolve(import.meta.dirname!, "../ralph-monitor.yaml"), "utf-8"),
) as AppConfig;
const port = config.frontend?.port ?? 5173;

const proc = Bun.spawn(["bunx", "vite", "dev", "--port", String(port)], {
  cwd: resolve(import.meta.dirname!, "../src/frontend"),
  stdout: "inherit",
  stderr: "inherit",
});

await proc.exited;
