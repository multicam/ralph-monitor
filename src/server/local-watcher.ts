import { EventEmitter } from "events";
import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

const STALE_THRESHOLD_MS = 5 * 60_000;
const WATCH_DIR = "/tmp/ralph";

/**
 * Local file watcher that emits the same events as SshManager
 * but reads directly from the filesystem instead of SSH.
 */
export class LocalWatcher extends EventEmitter {
  private tailedFiles = new Map<string, { lastData: number; offset: number }>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private watchDir: string;

  constructor(
    private vmId: string,
    watchDir?: string,
  ) {
    super();
    this.watchDir = watchDir ?? WATCH_DIR;
  }

  start(): void {
    this.stopped = false;
    this.emit("vm_connection", this.vmId, "connected");
    this.discoverFiles();
    this.startFilePoller();
    this.startStaleChecker();
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
    this.tailedFiles.clear();
  }

  private discoverFiles(): void {
    if (this.stopped) return;

    try {
      const files = this.findJsonlFiles(this.watchDir);
      if (files.length === 0) {
        this.emit("vm_connection", this.vmId, "idle");
        return;
      }
      for (const file of files) {
        if (!this.tailedFiles.has(file)) {
          this.tailFile(file);
        }
      }
    } catch {
      // Directory doesn't exist yet
      this.emit("vm_connection", this.vmId, "idle");
    }
  }

  private findJsonlFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.findJsonlFiles(fullPath));
        } else if (entry.name.endsWith(".jsonl")) {
          results.push(fullPath);
        }
      }
    } catch {
      // ignore unreadable dirs
    }
    return results;
  }

  private tailFile(filePath: string): void {
    if (this.stopped || this.tailedFiles.has(filePath)) return;

    // Start from current end of file (like tail -f)
    let offset = 0;
    try {
      offset = statSync(filePath).size;
    } catch {
      // file gone, skip
      return;
    }

    this.tailedFiles.set(filePath, { lastData: Date.now(), offset });
    this.emit("status", this.vmId, filePath, "new");

    // Poll file for new content
    const poll = setInterval(() => {
      if (this.stopped) {
        clearInterval(poll);
        return;
      }

      const tracked = this.tailedFiles.get(filePath);
      if (!tracked) {
        clearInterval(poll);
        return;
      }

      try {
        const stat = statSync(filePath);
        if (stat.size <= tracked.offset) return;

        const content = readFileSync(filePath, "utf-8");
        const newContent = content.slice(tracked.offset);
        tracked.offset = stat.size;

        if (newContent) {
          tracked.lastData = Date.now();
          const lines = newContent.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              this.emit("line", this.vmId, filePath, line);
            }
          }
        }
      } catch {
        // File removed or inaccessible
        this.tailedFiles.delete(filePath);
        clearInterval(poll);
      }
    }, 500);
  }

  private startFilePoller(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      this.discoverFiles();
    }, 10_000);
  }

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
