import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { defineTunnelConfig, cfTunnel } from "../src/index";
import { join } from "node:path";
import { homedir } from "node:os";

// Mock fetch
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ result: [{ id: "fake-zone-id" }] }),
  }),
) as any;

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => "fake-tunnel-id"),
  spawn: vi.fn(() => ({
    kill: vi.fn(),
  })),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
  writeFileSync: vi.fn(),
}));

const TEST_CONFIG = {
  cfToken: "fake-token",
  tunnelName: "test-tunnel",
  domain: "test-domain.test",
  ingress: [
    {
      hostname: "test.test-domain.test",
      service: "http://localhost:3000",
    },
  ],
};

describe("cf-tunnel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates config", async () => {
    const config = defineTunnelConfig(TEST_CONFIG);
    await expect(cfTunnel(config)).resolves.not.toThrow();
  });

  it("throws on invalid config", async () => {
    const config = defineTunnelConfig({
      // Missing required fields
      tunnelName: "test",
    } as any);

    await expect(cfTunnel(config)).rejects.toThrow();
  });

  it("creates and manages tunnel", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue(Buffer.from("tunnel-id"));

    const config = defineTunnelConfig({
      cfToken: "token",
      tunnelName: "test",
      domain: "example.com",
      ingress: [
        {
          hostname: "test.example.com",
          service: "http://localhost:3000",
        },
      ],
    });

    await cfTunnel(config);

    expect(execSync).toHaveBeenCalledWith("cloudflared tunnel create test");
    expect(spawn).toHaveBeenCalled();
  });

  it("handles tunnel deletion when no tunnel exists", async () => {
    vi.mocked(execSync).mockReturnValueOnce(""); // Empty tunnel list
    const config = defineTunnelConfig(TEST_CONFIG);
    await cfTunnel(config);
    expect(execSync).toHaveBeenCalledWith(
      "cloudflared tunnel create test-tunnel",
    );
  });

  it("handles cloudflared login when cert.pem missing", async () => {
    vi.mocked(existsSync).mockReturnValueOnce(false); // cert.pem doesn't exist
    const config = defineTunnelConfig(TEST_CONFIG);
    await cfTunnel(config);
    expect(execSync).toHaveBeenCalledWith("cloudflared tunnel login");
  });

  it("handles SIGINT cleanup", async () => {
    const config = defineTunnelConfig(TEST_CONFIG);
    await cfTunnel(config);

    // Simulate SIGINT
    process.emit("SIGINT");

    await vi.waitFor(() => {
      expect(execSync).toHaveBeenCalledWith(
        `rm ${join(homedir(), ".cloudflared", "config.yml")}`,
      );
    });
  });

  it("handles tunnel credential file deletion", async () => {
    // Mock tunnel exists and has credential file
    vi.mocked(execSync).mockReturnValueOnce(
      Buffer.from("existing-id test-tunnel"),
    );
    vi.mocked(execSync).mockReturnValueOnce(Buffer.from("")); // For tunnel delete
    vi.mocked(existsSync).mockReturnValueOnce(true); // cert.pem exists
    vi.mocked(existsSync).mockReturnValueOnce(true); // credential file exists

    const config = defineTunnelConfig(TEST_CONFIG);
    await cfTunnel(config);

    expect(execSync).toHaveBeenCalledWith(
      `rm ${join(homedir(), ".cloudflared", "existing-id.json")}`,
    );
  });
});
