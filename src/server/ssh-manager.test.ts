import { describe, test, expect } from "bun:test";
import { SshManager } from "./ssh-manager.ts";
import type { VmConfig } from "../lib/types.ts";

const testConfig: VmConfig = {
  name: "test-vm",
  host: "127.0.0.1",
  user: "testuser",
  password: "testpass",
  watchDir: "/tmp/test-ralph",
};

describe("SshManager", () => {
  test("vmId returns the config name", () => {
    const manager = new SshManager(testConfig);
    expect(manager.vmId).toBe("test-vm");
  });

  test("stop does not throw when never started", () => {
    const manager = new SshManager(testConfig);
    expect(() => manager.stop()).not.toThrow();
  });

  test("double stop is safe", () => {
    const manager = new SshManager(testConfig);
    manager.stop();
    expect(() => manager.stop()).not.toThrow();
  });

  test("accepts watchDir config", () => {
    const manager = new SshManager({ ...testConfig, watchDir: "/custom/path" });
    expect(manager.vmId).toBe("test-vm");
  });

  test("accepts key-based auth config", () => {
    const manager = new SshManager({
      name: "key-vm",
      host: "127.0.0.1",
      user: "testuser",
      key: "~/.ssh/id_rsa",
    });
    expect(manager.vmId).toBe("key-vm");
  });
});
