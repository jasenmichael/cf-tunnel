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
  domain: string;
  ingress: TunnelIngress[];
  // TODO: add optional removeDnsRecords and removeTunnel
  // removeDnsRecords?: { before: boolean, after: boolean }
  // removeTunnel?: { before: boolean, after: boolean }
}

/**
 * Define and validate a tunnel configuration
 *
 * @example
 * ```ts
 * const config = defineTunnelConfig({
 *   cfToken: process.env.CF_TOKEN,
 *   tunnelName: 'my-tunnel',
 *   domain: 'example.com',
 *   ingress: [{
 *     hostname: 'app.example.com',
 *     service: 'http://localhost:3000'
 *   }]
 * })
 * ```
 *
 * @param config - Tunnel configuration object
 * @param config.cfToken - Cloudflare API token (defaults to process.env.CF_TOKEN)
 * @param config.tunnelName - Name for the tunnel
 * @param config.domain - Your Cloudflare domain
 * @param config.cloudflaredConfigDir - Path to cloudflared config directory (defaults to ~/.cloudflared)
 * @param config.ingress - Array of services to expose
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
}: TunnelConfig) {
  // Get and delete existing tunnel if exists
  const tunnelList = execSync("cloudflared tunnel list").toString();
  const existingTunnelId = tunnelList
    .split("\n")
    .find((line: string) => line.includes(tunnelName))
    ?.split(" ")[0];

  if (existingTunnelId) {
    execSync(`cloudflared tunnel delete ${existingTunnelId}`);
    const credFile = join(cloudflaredConfigDir, `${existingTunnelId}.json`);
    if (existsSync(credFile)) {
      execSync(`rm ${credFile}`);
    }
  }
}

async function deleteDnsRecords(
  config: Required<Pick<TunnelConfig, "cfToken" | "domain" | "ingress">>,
) {
  async function getZoneId(domain: string, cfToken: string) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
      {
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const data = await response.json();
    return data.result[0].id;
  }
  // Get zone ID
  const zoneId = await getZoneId(config.domain, config.cfToken);

  // Remove existing DNS records
  for (const service of config.ingress) {
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
 *   domain: 'example.com',
 *   ingress: [{
 *     hostname: 'app.example.com',
 *     service: 'http://localhost:3000'
 *   }]
 * })
 * ```
 *
 * @param userConfig - Tunnel configuration object
 * @param userConfig.cfToken - Cloudflare API token (defaults to process.env.CF_TOKEN)
 * @param userConfig.tunnelName - Name for the tunnel
 * @param userConfig.domain - Your Cloudflare domain
 * @param userConfig.cloudflaredConfigDir - Path to cloudflared config directory (defaults to ~/.cloudflared)
 * @param userConfig.ingress - Array of services to expose
 * @throws Will throw an error if cfToken is missing
 */
export async function cfTunnel(userConfig: TunnelConfig) {
  const config = defu(userConfig, {
    cloudflaredConfigDir: getCloudflaredConfigDir(),
    cfToken: userConfig.cfToken || process.env.CF_TOKEN,
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

  await deleteDnsRecords(validatedConfig);
  await deleteTunnel(validatedConfig);

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

  // Handle cleanup on exit
  process.on("SIGINT", async () => {
    console.log("SIGINT exiting");
    tunnel.kill("SIGINT");
    // remove dns records
    await deleteDnsRecords(validatedConfig);
    // delete cloudflared tunnel, and local tunnel credentials .json file
    await deleteTunnel(validatedConfig);
    // remove config.yml
    execSync(`rm ${join(validatedConfig.cloudflaredConfigDir, "config.yml")}`);
  });
}
