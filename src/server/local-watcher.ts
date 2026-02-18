import { EventEmitter } from "events";
import { readdirSync, statSync, openSync, readSync, closeSync, unlinkSync } from "fs";
import { join } from "path";

const STALE_THRESHOLD_MS = 5 * 60_000;
const WATCH_DIR = "/tmp/ralph";

/**
 * Local file watcher that emits the same events as SshManager
 * but reads directly from the filesystem instead of SSH.
 */
export class LocalWatcher extends EventEmitter {
  private tailedFiles = new Map<string, { lastData: number; offset: number }>();
  private filePollers = new Map<string, ReturnType<typeof setInterval>>();
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

  deleteFile(filePath: string): Promise<void> {
    this.tailedFiles.delete(filePath);
    try {
      unlinkSync(filePath);
    } catch {
      // File already gone — desired outcome
    }
    return Promise.resolve();
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
    for (const interval of this.filePollers.values()) {
      clearInterval(interval);
    }
    this.filePollers.clear();
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
        this.clearFilePoller(filePath);
        return;
      }

      const tracked = this.tailedFiles.get(filePath);
      if (!tracked) {
        this.clearFilePoller(filePath);
        return;
      }

      try {
        const stat = statSync(filePath);
        if (stat.size <= tracked.offset) return;

        // Read only the new bytes using fd + offset
        const bytesToRead = stat.size - tracked.offset;
        const buf = Buffer.alloc(bytesToRead);
        const fd = openSync(filePath, "r");
        try {
          readSync(fd, buf, 0, bytesToRead, tracked.offset);
        } finally {
          closeSync(fd);
        }
        tracked.offset = stat.size;

        const newContent = buf.toString("utf-8");
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
        this.clearFilePoller(filePath);
      }
    }, 500);

    this.filePollers.set(filePath, poll);
  }

  private clearFilePoller(filePath: string): void {
    const interval = this.filePollers.get(filePath);
    if (interval) {
      clearInterval(interval);
      this.filePollers.delete(filePath);
    }
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
