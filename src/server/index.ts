import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { hostname, homedir } from "os";
import { resolve, join, extname } from "path";
import { parse as parseYaml } from "yaml";
import { Pipeline } from "./pipeline.ts";
import { WsRelay } from "./ws-server.ts";
import type { AppConfig } from "../lib/types.ts";

const STATIC_DIR = resolve(import.meta.dirname!, "../frontend/build");
const hasStaticBuild = existsSync(join(STATIC_DIR, "index.html"));

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");
const DEFAULT_MAX_AGE_MS = 15 * 60_000; // 15 minutes — only discover active sessions

function parseArgs(): { local: boolean; watchDir?: string; port?: number } {
  const args = process.argv.slice(2);
  const result: { local: boolean; watchDir?: string; port?: number } = { local: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--local") result.local = true;
    else if (args[i] === "--watch-dir" && args[i + 1]) result.watchDir = args[++i];
    else if (args[i] === "--port" && args[i + 1]) result.port = Number(args[++i]);
  }
  return result;
}

const flags = parseArgs();

let config: AppConfig;

if (flags.local) {
  const watchDir = flags.watchDir ?? CLAUDE_PROJECTS_DIR;
  const useMaxAge = !flags.watchDir; // only filter by recency when using default Claude dir
  config = {
    server: { port: flags.port ?? 4020 },
    vms: [{
      name: hostname(),
      host: "localhost",
      user: "local",
      local: true,
      watchDir,
      ...(useMaxAge && { maxAgeMs: DEFAULT_MAX_AGE_MS }),
    }],
  };
} else {
  const configPath = resolve(process.cwd(), "ralph-monitor.yaml");
  if (!existsSync(configPath)) {
    console.error("ralph-monitor.yaml not found. Use --local to monitor this machine without a config file.");
    process.exit(1);
  }
  const configRaw = readFileSync(configPath, "utf-8");
  config = parseYaml(configRaw) as AppConfig;
  if (flags.port) config.server.port = flags.port;

  // Validate VM auth config
  for (const vm of config.vms) {
    if (!vm.local && !vm.key && !vm.password) {
      console.error(`VM "${vm.name}": must have either "key", "password", or "local: true" configured`);
      process.exit(1);
    }
  }
}

const port = config.server?.port ?? 3000;

const server = createServer(async (req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*" };

  if (req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json", ...cors });
    const states = Object.fromEntries(pipeline.getLoopStates());
    res.end(JSON.stringify({ ok: true, loops: states }));
    return;
  }

  // On-demand event loading for closed cards
  const eventsMatch = req.url?.match(/^\/api\/loops\/([^/]+)\/events$/);
  if (eventsMatch) {
    const loopId = decodeURIComponent(eventsMatch[1]!);
    res.writeHead(200, { "Content-Type": "application/json", ...cors });
    const events = pipeline.getRecentEvents(loopId, 100);
    res.end(JSON.stringify({ loopId, events }));
    return;
  }

  // Delete a loop and its JSONL file
  const deleteMatch = req.url?.match(/^\/api\/loops\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    const loopId = decodeURIComponent(deleteMatch[1]!);
    const found = await pipeline.removeLoop(loopId);
    res.writeHead(found ? 200 : 404, { "Content-Type": "application/json", ...cors });
    res.end(JSON.stringify({ ok: found, loopId }));
    return;
  }

  // CORS preflight for DELETE
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...cors,
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Serve static frontend build
  if (hasStaticBuild) {
    const urlPath = req.url?.split("?")[0] ?? "/";
    const filePath = join(STATIC_DIR, urlPath === "/" ? "index.html" : urlPath);

    if (existsSync(filePath) && !filePath.includes("..")) {
      const ext = extname(filePath);
      const contentType = MIME[ext] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(readFileSync(filePath));
      return;
    }

    // SPA fallback — serve index.html for unmatched routes
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(readFileSync(join(STATIC_DIR, "index.html")));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const pipeline = new Pipeline(config);
const _relay = new WsRelay(server, pipeline);

pipeline.start();

server.listen(port, () => {
  console.log(`ralph-monitor listening on http://localhost:${port}`);
  if (flags.local) {
    const vm = config.vms[0]!;
    console.log(`Local mode: watching ${vm.watchDir}`);
    if (vm.maxAgeMs) console.log(`  Discovering sessions active within last ${vm.maxAgeMs / 60_000}min`);
  } else {
    console.log(`Monitoring ${config.vms.length} VM(s): ${config.vms.map((v) => v.name).join(", ")}`);
  }
});
