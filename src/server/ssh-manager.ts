import { Client } from "ssh2";
import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";
import type { VmConfig } from "../lib/types.ts";

export interface SshManagerEvents {
  line: (vmId: string, sessionFile: string, line: string) => void;
  status: (vmId: string, sessionFile: string, status: "active" | "inactive" | "new") => void;
  vm_connection: (vmId: string, status: "connected" | "disconnected" | "idle") => void;
  error: (vmId: string, error: Error) => void;
}

const STALE_THRESHOLD_MS = 5 * 60_000; // 5 minutes

export class SshManager extends EventEmitter {
  private conn: Client | null = null;
  private config: VmConfig;
  private tailedFiles = new Map<string, { lastData: number }>();
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(config: VmConfig) {
    super();
    this.config = config;
  }

  get vmId(): string {
    return this.config.name;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
    if (this.conn) {
      this.conn.end();
      this.conn = null;
    }
    this.tailedFiles.clear();
  }

  private resolveKeyPath(keyPath: string): string {
    if (keyPath.startsWith("~")) {
      return resolve(homedir(), keyPath.slice(2));
    }
    return resolve(keyPath);
  }

  private reconnecting = false;

  private connect(): void {
    if (this.stopped) return;
    this.reconnecting = false;

    const conn = new Client();
    this.conn = conn;

    console.log(`[${this.vmId}] Connecting to ${this.config.host}...`);

    conn.on("ready", () => {
      console.log(`[${this.vmId}] SSH connected`);
      this.reconnectDelay = 1000;
      this.emit("vm_connection", this.vmId, "connected");
      this.discoverFiles();
      this.startFilePoller();
      this.startStaleChecker();
    });

    conn.on("error", (err: Error) => {
      console.error(`[${this.vmId}] SSH error: ${err.message}`);
      this.emit("error", this.vmId, err);
      this.scheduleReconnect();
    });

    conn.on("close", () => {
      if (!this.stopped) {
        this.emit("vm_connection", this.vmId, "disconnected");
        this.tailedFiles.clear();
        this.scheduleReconnect();
      }
    });

    conn.on("keyboard-interactive", (_name, _instructions, _instructionsLang, _prompts, finish) => {
      console.log(`[${this.vmId}] keyboard-interactive auth requested`);
      finish([this.config.password ?? ""]);
    });

    const baseOpts = {
      host: this.config.host,
      port: 22,
      username: this.config.user,
      readyTimeout: 30_000,
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
    };

    try {
      if (this.config.key) {
        const privateKey = readFileSync(this.resolveKeyPath(this.config.key));
        conn.connect({ ...baseOpts, privateKey });
      } else if (this.config.password) {
        conn.connect({
          ...baseOpts,
          password: this.config.password,
          tryKeyboard: true,
        });
      }
    } catch (err) {
      this.emit("error", this.vmId, err instanceof Error ? err : new Error(String(err)));
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnecting) return;
    this.reconnecting = true;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    console.log(`[${this.vmId}] Reconnecting in ${delay / 1000}s...`);
    setTimeout(() => this.connect(), delay);
  }

  private discoverFiles(): void {
    if (!this.conn || this.stopped) return;

    this.conn.exec("find /tmp/ralph -name '*.jsonl' 2>/dev/null", (err, stream) => {
      if (err) {
        this.emit("vm_connection", this.vmId, "idle");
        return;
      }

      let data = "";
      stream.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });

      stream.on("close", () => {
        const files = data.trim().split("\n").filter(Boolean);
        if (files.length === 0) {
          this.emit("vm_connection", this.vmId, "idle");
          return;
        }

        for (const file of files) {
          if (!this.tailedFiles.has(file)) {
            this.tailFile(file);
          }
        }
      });
    });
  }

  private tailFile(filePath: string): void {
    if (!this.conn || this.stopped || this.tailedFiles.has(filePath)) return;

    this.tailedFiles.set(filePath, { lastData: Date.now() });
    this.emit("status", this.vmId, filePath, "new");

    this.conn.exec(`tail -f "${filePath}"`, (err, stream) => {
      if (err) {
        this.tailedFiles.delete(filePath);
        this.emit("error", this.vmId, err);
        return;
      }

      let buffer = "";

      stream.on("data", (chunk: Buffer) => {
        const tracked = this.tailedFiles.get(filePath);
        if (tracked) tracked.lastData = Date.now();

        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) {
            this.emit("line", this.vmId, filePath, line);
          }
        }
      });

      stream.on("close", () => {
        this.tailedFiles.delete(filePath);
      });

      stream.stderr.on("data", (chunk: Buffer) => {
        this.emit("error", this.vmId, new Error(chunk.toString()));
      });
    });
  }

  /** Periodically discover new files */
  private startFilePoller(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      this.discoverFiles();
    }, 10_000);
  }

  /** Periodically check for stale files (no data in 5 min) */
  private startStaleChecker(): void {
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.staleTimer = setInterval(() => {
      const now = Date.now();
      for (const [file, info] of this.tailedFiles) {
        if (now - info.lastData > STALE_THRESHOLD_MS) {
          this.emit("status", this.vmId, file, "inactive");
        } else {
          this.emit("status", this.vmId, file, "active");
        }
      }
    }, 30_000);
  }
}
