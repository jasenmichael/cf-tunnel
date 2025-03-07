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
  ingress: [
    {
      hostname: "test.test-domain.test",
      service: "http://localhost:3000",
    },
  ],
  removeExistingDns: true,
  removeExistingTunnel: true,
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
      ingress: [
        {
          hostname: "test.example.com",
          service: "http://localhost:3000",
        },
      ],
      removeExistingDns: true,
      removeExistingTunnel: true,
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

  it("respects removeExistingTunnel option", async () => {
    // Mock an existing tunnel
    vi.mocked(execSync).mockReturnValueOnce(
      Buffer.from("existing-id test-tunnel"),
    );

    // Test with removeExistingTunnel: false (default)
    const config = defineTunnelConfig({
      ...TEST_CONFIG,
      removeExistingTunnel: false,
    });

    await expect(cfTunnel(config)).rejects.toThrow(
      /Tunnel "test-tunnel" already exists/,
    );

    // Test with removeExistingTunnel: true
    const configWithRemove = defineTunnelConfig({
      ...TEST_CONFIG,
      removeExistingTunnel: true,
    });

    await expect(cfTunnel(configWithRemove)).resolves.not.toThrow();
  });

  it("respects removeExistingDns option", async () => {
    // Mock an existing DNS record
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/dns_records?name=")) {
        return Promise.resolve({
          json: () => Promise.resolve({ result: [{ id: "fake-dns-id" }] }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ result: [{ id: "fake-zone-id" }] }),
      });
    }) as any;

    // Test with removeExistingDns: false (default)
    const config = defineTunnelConfig({
      ...TEST_CONFIG,
      removeExistingDns: false,
      removeExistingTunnel: true, // To avoid the tunnel error
    });

    await expect(cfTunnel(config)).rejects.toThrow(
      /DNS record for "test.test-domain.test" already exists/,
    );

    // Test with removeExistingDns: true
    const configWithRemove = defineTunnelConfig({
      ...TEST_CONFIG,
      removeExistingDns: true,
      removeExistingTunnel: true, // To avoid the tunnel error
    });

    await expect(cfTunnel(configWithRemove)).resolves.not.toThrow();
  });

  it("uses default values (false) for removeExisting options", async () => {
    // Mock an existing tunnel
    vi.mocked(execSync).mockReturnValueOnce(
      Buffer.from("existing-id test-tunnel"),
    );

    // Mock an existing DNS record
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/dns_records?name=")) {
        return Promise.resolve({
          json: () => Promise.resolve({ result: [{ id: "fake-dns-id" }] }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ result: [{ id: "fake-zone-id" }] }),
      });
    }) as any;

    // Test with defaults (should be false for both)
    const config = defineTunnelConfig({
      cfToken: "fake-token",
      tunnelName: "test-tunnel",
      ingress: [
        {
          hostname: "test.test-domain.test",
          service: "http://localhost:3000",
        },
      ],
      // Not setting removeExistingDns or removeExistingTunnel options
    });

    // Should throw error about existing tunnel first (since that's checked before DNS)
    await expect(cfTunnel(config)).rejects.toThrow(
      /Tunnel "test-tunnel" already exists/,
    );
  });
});
