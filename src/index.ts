import { execSync, spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { defu } from "defu";
import yaml from "yaml";

export interface TunnelIngress {
  hostname: string;
  service: string;
  [key: string]: any;
}

export interface TunnelConfig {
  cfToken?: string;
  tunnelName: string;
  cloudflaredConfigDir?: string;
  ingress: TunnelIngress[];
  // New configuration options
  removeExistingDns?: boolean;
  removeExistingTunnel?: boolean;
}

/**
 * Define and validate a tunnel configuration
 *
 * @example
 * ```ts
 * const config = defineTunnelConfig({
 *   cfToken: process.env.CF_TOKEN,
 *   tunnelName: 'my-tunnel',
 *   ingress: [{
 *     hostname: 'app.example.com',
 *     service: 'http://localhost:3000'
 *   }],
 *   removeExistingDns: true,
 *   removeExistingTunnel: true
 * })
 * ```
 *
 * @param config - Tunnel configuration object
 * @param config.cfToken - Cloudflare API token (defaults to process.env.CF_TOKEN)
 * @param config.tunnelName - Name for the tunnel
 * @param config.cloudflaredConfigDir - Path to cloudflared config directory (defaults to ~/.cloudflared)
 * @param config.ingress - Array of services to expose
 * @param config.removeExistingDns - If true, removes existing DNS records (default: false)
 * @param config.removeExistingTunnel - If true, removes existing tunnel with same name (default: false)
 * @returns Validated tunnel configuration
 */
export function defineTunnelConfig(config: TunnelConfig): TunnelConfig {
  return config;
}

function getCloudflaredConfigDir(): string {
  const home = homedir();
  switch (platform()) {
    case "win32": {
      return join(home, "AppData", "Local", "cloudflared");
    }
    case "darwin": {
      return join(home, "Library", "Application Support", "cloudflared");
    }
    default: {
      // Linux and others
      return join(home, ".cloudflared");
    }
  }
}

async function deleteTunnel({
  tunnelName,
  cloudflaredConfigDir = getCloudflaredConfigDir(),
  removeExistingTunnel = false,
}: TunnelConfig) {
  try {
    // Try to get existing tunnel if it exists
    const tunnelList = execSync("cloudflared tunnel list", {
      stdio: "pipe", // Capture output to prevent errors showing
    }).toString();

    const existingTunnelId = tunnelList
      .split("\n")
      .find((line: string) => line.includes(tunnelName))
      ?.split(" ")[0];

    if (existingTunnelId) {
      if (!removeExistingTunnel) {
        throw new Error(
          `Tunnel "${tunnelName}" already exists. Set removeExistingTunnel: true to remove it automatically.`,
        );
      }

      console.log(`Removing existing tunnel: ${tunnelName}`);
      execSync(`cloudflared tunnel delete ${existingTunnelId}`);
      const credFile = join(cloudflaredConfigDir, `${existingTunnelId}.json`);
      if (existsSync(credFile)) {
        execSync(`rm ${credFile}`);
      }
    }
  } catch (error) {
    // Only rethrow if not in SIGINT cleanup context
    if (removeExistingTunnel) {
      console.warn(
        // @ts-ignore
        `Warning: Could not check or delete tunnel: ${error.message}`,
      );
    } else {
      throw error;
    }
  }
}

/**
 * Extract domain from a hostname (e.g., "app.example.com" -> "example.com")
 */
function extractDomain(hostname: string): string {
  // Simple approach for common TLDs
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }
  return hostname;
}

async function getZoneId(domain: string, cfToken: string) {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
      {
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    // Check if response exists and has json method
    if (!response || typeof response.json !== "function") {
      return undefined; // Return undefined instead of throwing during cleanup
    }

    const data = await response.json();
    return data?.result?.[0]?.id;
  } catch (error) {
    console.warn(`Warning: Error getting zone ID for ${domain}: ${error}`);
    return undefined; // Don't throw during cleanup
  }
}

async function deleteDnsRecords(
  config: Required<Pick<TunnelConfig, "cfToken" | "ingress">> &
    Pick<TunnelConfig, "removeExistingDns">,
) {
  const { removeExistingDns = false } = config;

  // Remove existing DNS records
  for (const service of config.ingress) {
    // Extract domain from hostname
    const domain = extractDomain(service.hostname);

    // Get zone ID for this domain
    const zoneId = await getZoneId(domain, config.cfToken);

    if (!zoneId) {
      console.warn(`Zone ID not found for domain: ${domain}`);
      continue;
    }

    const recordResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${service.hostname}`,
      {
        headers: {
          Authorization: `Bearer ${config.cfToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const recordData = await recordResponse.json();
    const recordId = recordData.result[0]?.id;

    if (recordId) {
      if (!removeExistingDns) {
        throw new Error(
          `DNS record for "${service.hostname}" already exists. Set removeExistingDns: true to remove it automatically.`,
        );
      }

      console.log(`Removing existing DNS record: ${service.hostname}`);
      await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${config.cfToken}`,
            "Content-Type": "application/json",
          },
        },
      );
    }
  }
}

/**
 * Create and manage a Cloudflare Tunnel
 *
 * Creates a new tunnel, configures DNS records, and starts the tunnel process.
 * Handles cleanup of DNS records and tunnel on process exit.
 *
 * @example
 * ```ts
 * await cfTunnel({
 *   cfToken: process.env.CF_TOKEN,
 *   tunnelName: 'my-tunnel',
 *   ingress: [{
 *     hostname: 'app.example.com',
 *     service: 'http://localhost:3000'
 *   }],
 *   removeExistingDns: true,
 *   removeExistingTunnel: true
 * })
 * ```
 *
 * @param userConfig - Tunnel configuration object
 * @param userConfig.cfToken - Cloudflare API token (defaults to process.env.CF_TOKEN)
 * @param userConfig.tunnelName - Name for the tunnel
 * @param userConfig.cloudflaredConfigDir - Path to cloudflared config directory (defaults to ~/.cloudflared)
 * @param userConfig.ingress - Array of services to expose
 * @param userConfig.removeExistingDns - If true, removes existing DNS records (default: false)
 * @param userConfig.removeExistingTunnel - If true, removes existing tunnel with same name (default: false)
 * @throws Will throw an error if cfToken is missing
 */
export async function cfTunnel(userConfig: TunnelConfig) {
  const config = defu(userConfig, {
    cloudflaredConfigDir: getCloudflaredConfigDir(),
    cfToken: userConfig.cfToken || process.env.CF_TOKEN,
    removeExistingDns: false,
    removeExistingTunnel: false,
  });

  // Validate cfToken early
  if (!config.cfToken) {
    console.error("Tunnel config missing: cfToken");
    throw new Error("Missing required configuration");
  }

  // Now we know cfToken exists for the rest of the function
  const validatedConfig = config as Required<TunnelConfig>;

  // Check login
  if (!existsSync(join(validatedConfig.cloudflaredConfigDir, "cert.pem"))) {
    execSync("cloudflared tunnel login");
  }

  await deleteTunnel(validatedConfig);
  await deleteDnsRecords(validatedConfig);

  // Create new tunnel
  execSync(`cloudflared tunnel create ${validatedConfig.tunnelName}`);

  // Route DNS for each service
  for (const service of validatedConfig.ingress) {
    execSync(
      `cloudflared tunnel route dns ${validatedConfig.tunnelName} ${service.hostname}`,
    );
  }

  // Get new tunnel ID
  const newTunnelId = execSync("cloudflared tunnel list")
    .toString()
    .split("\n")
    .find((line: string) => line.includes(validatedConfig.tunnelName))
    ?.split(" ")[0];

  // Create config file
  const tunnelConfig = {
    tunnel: validatedConfig.tunnelName,
    "credentials-file": join(
      validatedConfig.cloudflaredConfigDir,
      `${newTunnelId}.json`,
    ),
    ingress: [...validatedConfig.ingress, { service: "http_status:404" }],
  };

  writeFileSync(
    join(validatedConfig.cloudflaredConfigDir, "config.yml"),
    yaml.stringify(tunnelConfig),
    "utf8",
  );

  const tunnelCommand = `cloudflared tunnel run ${validatedConfig.tunnelName}`;
  console.log("Running tunnel:", tunnelCommand);

  const tunnel = spawn(tunnelCommand, { shell: true, stdio: "inherit" });
  let cleanupDone = false;

  // Handle cleanup on exit
  const cleanup = async () => {
    if (cleanupDone) return;
    cleanupDone = true;

    console.log("Cleaning up tunnel resources...");

    // Gracefully terminate the tunnel process
    tunnel.kill("SIGTERM");

    // Wait a short time for cloudflared to clean up
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Remove tunnel and DNS records
    await deleteTunnel({ ...validatedConfig, removeExistingTunnel: true });
    // remove dns records
    await deleteDnsRecords({ ...validatedConfig, removeExistingDns: true });
    // remove config.yml
    if (existsSync(join(validatedConfig.cloudflaredConfigDir, "config.yml"))) {
      execSync(
        `rm ${join(validatedConfig.cloudflaredConfigDir, "config.yml")}`,
      );
    }

    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Also cleanup if the tunnel process exits
  tunnel.on("exit", cleanup);
}
