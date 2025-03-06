#!/usr/bin/env node
import { Command } from "commander";
import { consola } from "consola";
import { existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { readFileSync } from "node:fs";
import yaml from "yaml";
import "dotenv/config";

import { version } from "../package.json";

import { cfTunnel } from "./index";
import type { TunnelConfig } from "./index";

const program = new Command();
const startDir = process.cwd(); // Save the starting directory

function getConfigPath(configPath: string) {
  const CONFIG_FILES = [
    "tunnel.config.yml",
    "tunnel.config.yaml",
    "tunnel.config.json",
    "tunnel.config.js",
  ];

  // If no config specified, try to find one
  if (!configPath) {
    for (const file of CONFIG_FILES) {
      if (existsSync(resolve(startDir, file))) {
        configPath = resolve(startDir, file);
        break;
      }
    }
    if (!configPath) {
      throw new Error(
        `No config file found. Looked for: ${CONFIG_FILES.join(", ")}`,
      );
    }
    return configPath;
  }

  configPath = isAbsolute(configPath)
    ? configPath
    : resolve(process.cwd(), configPath);

  if (!existsSync(configPath)) {
    throw new Error(`Config file ${configPath} does not exist`);
  }

  return configPath;
}

async function loadConfig(configPath: string): Promise<TunnelConfig> {
  const ext = configPath.split(".").pop()?.toLowerCase();

  let jsonContent: string;
  let yamlContent: string;
  let config: { default: TunnelConfig };

  switch (ext) {
    case "json": {
      jsonContent = readFileSync(configPath, "utf8");
      return JSON.parse(jsonContent);
    }

    case "yml":
    case "yaml": {
      yamlContent = readFileSync(configPath, "utf8");
      return yaml.parse(yamlContent);
    }

    case "js":
    case "mjs": {
      const fileUrl = new URL(`file://${configPath}`);
      config = await import(fileUrl.href);
      return config.default;
    }

    default: {
      throw new Error(`Unsupported config file type: ${ext}`);
    }
  }
}

program
  .name("cf-tunnel")
  .description("Cloudflare tunnel manager")
  .version(version)
  .option("-c, --config <path>", "Config file path")
  .action(async (options) => {
    try {
      const configPath = getConfigPath(options.config);
      consola.info(`Loading config: ${configPath}`);
      const config = await loadConfig(configPath);
      consola.info("Config loaded");

      config.cfToken = config.cfToken || process.env?.CF_TOKEN;

      await cfTunnel(config);
    } catch (error) {
      consola.error(error);
      process.exit(1);
    }
  });

program.parse();
