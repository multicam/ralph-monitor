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

const server = createServer((req, res) => {
  // Serve a minimal status endpoint
  if (req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    const states = Object.fromEntries(pipeline.getLoopStates());
    res.end(JSON.stringify({ ok: true, loops: states }));
    return;
  }

  // Everything else proxied to SvelteKit in dev, or served from build in prod
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
