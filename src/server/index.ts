import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { Pipeline } from "./pipeline.ts";
import { WsRelay } from "./ws-server.ts";
import type { AppConfig } from "../lib/types.ts";

const configPath = resolve(process.cwd(), "ralph-monitor.yaml");
const configRaw = readFileSync(configPath, "utf-8");
const config = parseYaml(configRaw) as AppConfig;

// Validate VM auth config
for (const vm of config.vms) {
  if (!vm.local && !vm.key && !vm.password) {
    console.error(`VM "${vm.name}": must have either "key", "password", or "local: true" configured`);
    process.exit(1);
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

  res.writeHead(404);
  res.end("Not found");
});

const pipeline = new Pipeline(config);
const _relay = new WsRelay(server, pipeline);

pipeline.start();

server.listen(port, () => {
  console.log(`ralph-monitor listening on http://localhost:${port}`);
  console.log(`Monitoring ${config.vms.length} VM(s): ${config.vms.map((v) => v.name).join(", ")}`);
});
