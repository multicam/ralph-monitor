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
  /** Single multiplexed tail stream — null when not active */
  private tailStream: ReturnType<Client["exec"]> extends void ? never : import("ssh2").ClientChannel | null = null;

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

  deleteFile(filePath: string): Promise<void> {
    this.tailedFiles.delete(filePath);
    return new Promise<void>((resolve) => {
      if (!this.conn) {
        resolve();
        return;
      }
      this.conn.exec(`rm -f ${this.shellEscape(filePath)}`, (err, stream) => {
        if (err) {
          resolve(); // File gone is the desired outcome either way
          return;
        }
        stream.on("close", () => resolve());
        stream.on("error", () => resolve());
      });
    });
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
    this.tailStream = null;
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

  /** Escape a string for use in single-quoted shell arguments */
  private shellEscape(s: string): string {
    return "'" + s.replace(/'/g, "'\\''") + "'";
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
      this.discoverAndTail();
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
        this.tailStream = null;
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

  /**
   * Discover JSONL files and start a single multiplexed tail.
   * Uses only 1 SSH channel for all files via a shell script that
   * prefixes each line with the source file path.
   */
  private discoverAndTail(): void {
    if (!this.conn || this.stopped) return;

    const watchDir = this.config.watchDir ?? "/tmp/ralph";
    // Script that finds all JSONL files and tails them with file prefixes.
    // Uses awk to prefix each line with the filename, separated by a tab.
    // `tail --pid=$$` ensures tails die when the script exits.
    const cmd = [
      `cd ${this.shellEscape(watchDir)} 2>/dev/null || exit 0`,
      `files=$(find . -name '*.jsonl' 2>/dev/null)`,
      `[ -z "$files" ] && exit 0`,
      // Print file list for discovery
      `for f in $files; do echo "FILE:$f"; done`,
      // Tail all files, prefix each line with filename
      `for f in $files; do tail -n 50 -f "$f" 2>/dev/null | while IFS= read -r line; do echo "$f	$line"; done & done`,
      `wait`,
    ].join("; ");

    this.conn.exec(cmd, (err, stream) => {
      if (err) {
        this.emit("vm_connection", this.vmId, "idle");
        return;
      }

      this.tailStream = stream;
      let buffer = "";
      const watchDirPrefix = watchDir.endsWith("/") ? watchDir : watchDir + "/";

      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          if (!rawLine.trim()) continue;

          // File discovery lines: "FILE:./path/to/file.jsonl"
          if (rawLine.startsWith("FILE:")) {
            const relPath = rawLine.slice(5);
            const fullPath = relPath.startsWith("./")
              ? watchDirPrefix + relPath.slice(2)
              : watchDirPrefix + relPath;
            if (!this.tailedFiles.has(fullPath)) {
              this.tailedFiles.set(fullPath, { lastData: Date.now() });
              this.emit("status", this.vmId, fullPath, "new");
              console.log(`[${this.vmId}] Tailing ${fullPath}`);
            }
            continue;
          }

          // Data lines: "./path/to/file.jsonl\tJSON_LINE"
          const tabIdx = rawLine.indexOf("\t");
          if (tabIdx === -1) continue;

          const relPath = rawLine.slice(0, tabIdx);
          const line = rawLine.slice(tabIdx + 1);
          const fullPath = relPath.startsWith("./")
            ? watchDirPrefix + relPath.slice(2)
            : watchDirPrefix + relPath;

          const tracked = this.tailedFiles.get(fullPath);
          if (tracked) tracked.lastData = Date.now();

          if (line.trim()) {
            this.emit("line", this.vmId, fullPath, line);
          }
        }
      });

      stream.on("close", () => {
        this.tailStream = null;
        // All tails died — will be rediscovered on next poll
        this.tailedFiles.clear();
      });

      stream.stderr.on("data", (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) this.emit("error", this.vmId, new Error(msg));
      });
    });
  }

  /** Periodically check for new files and restart tail if needed */
  private startFilePoller(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (!this.tailStream) {
        // Tail stream died, restart discovery
        this.discoverAndTail();
      }
      // For new files appearing after initial discovery,
      // the tail stream won't catch them. Check periodically.
      this.checkForNewFiles();
    }, 10_000);
  }

  private checkForNewFiles(): void {
    if (!this.conn || this.stopped) return;

    const watchDir = this.config.watchDir ?? "/tmp/ralph";
    const cmd = `find ${this.shellEscape(watchDir)} -name '*.jsonl' 2>/dev/null`;

    this.conn.exec(cmd, (err, stream) => {
      if (err) { console.error(`[${this.vmId}] checkForNewFiles exec error:`, err.message); return; }

      let data = "";
      stream.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });

      stream.on("close", () => {
        const files = data.trim().split("\n").filter(Boolean);
        const newFiles = files.filter((f) => !this.tailedFiles.has(f));
        if (newFiles.length > 0) {
          console.log(`[${this.vmId}] Found ${newFiles.length} new file(s), restarting tail...`);
          // Kill the old tail stream and restart with all files
          if (this.tailStream) {
            this.tailStream.close();
            this.tailStream = null;
          }
          this.tailedFiles.clear();
          this.discoverAndTail();
        }
      });
    });
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
