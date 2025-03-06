import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { consola } from "consola";
import { existsSync, readFileSync } from "node:fs";

// Mock the action handler
let actionHandler: (options: any) => Promise<void>;

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true), // Make config file exist
  readFileSync: vi.fn(() => ""),
}));

vi.mock("commander", () => ({
  Command: vi.fn().mockImplementation(() => ({
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn((handler) => {
      actionHandler = handler;
      return this;
    }),
    parse: vi.fn(),
  })),
}));

vi.mock("consola", () => ({
  consola: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const TEST_CONFIG = {
  cfToken: "test-token",
  tunnelName: "test-tunnel",
  domain: "test.com",
  services: [{ hostname: "test.com", service: "localhost:3000" }],
};

describe("cli", () => {
  it("loads and runs with config", async () => {
    await import("../src/cli");

    // Trigger the action handler
    await actionHandler({ config: "./test-config.js" });

    expect(Command).toHaveBeenCalled();
    expect(consola.info).toHaveBeenCalledWith(
      expect.stringContaining("Loading config"),
    );
  });

  it("handles config file load error", async () => {
    vi.mocked(existsSync).mockReturnValueOnce(true);
    await import("../src/cli");

    // Mock import to fail
    vi.mock("./test-config.js", () => {
      throw new Error("Failed to load");
    });

    await actionHandler({ config: "./test-config.js" });
    expect(consola.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Failed to load url"),
      }),
    );
  });

  it("throws detailed error when config file not found", async () => {
    vi.mocked(existsSync).mockReturnValueOnce(false);
    await import("../src/cli");

    try {
      await actionHandler({ config: "missing.js" });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      expect(error.message).toBe("Config file missing.js does not exist");
      expect(consola.error).toHaveBeenCalledWith(
        "Config file missing.js does not exist",
      );
    }
  });

  it("loads JSON config", async () => {
    vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify(TEST_CONFIG));
    await import("../src/cli");
    await actionHandler({ config: "tunnel.config.json" });
    expect(readFileSync).toHaveBeenCalled();
  });

  it("loads YAML config", async () => {
    vi.mocked(readFileSync).mockReturnValueOnce(
      "cfToken: test-token\ntunnelName: test-tunnel",
    );
    await import("../src/cli");
    await actionHandler({ config: "tunnel.config.yml" });
    expect(readFileSync).toHaveBeenCalled();
  });

  it("throws on unsupported file type", async () => {
    await import("../src/cli");
    try {
      await actionHandler({ config: "tunnel.config.txt" });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      expect(error.message).toBe("Unsupported config file type: txt");
      expect(consola.error).toHaveBeenCalledWith(error);
    }
  });
});
