# 모-cf-tunnel-던

Easily manage Cloudflare Tunnels in your Node.js applications.

<!-- automd:badges name="cf-tunnel" codecov license -->

[![npm version](https://img.shields.io/npm/v/cf-tunnel)](https://npmjs.com/package/cf-tunnel)
[![npm downloads](https://img.shields.io/npm/dm/cf-tunnel)](https://npm.chart.dev/cf-tunnel)
[![codecov](https://img.shields.io/codecov/c/gh/jasenmichael/cf-tunnel)](https://codecov.io/gh/jasenmichael/cf-tunnel)
[![license](https://img.shields.io/github/license/jasenmichael/cf-tunnel)](https://github.com/jasenmichael/cf-tunnel/blob/main/LICENSE)

<!-- /automd -->

## Why Use cf-tunnel?

**cf-tunnel** provides significant advantages over alternatives like `cloudflared-tunnel` or `untun`:

- **Consistent URLs**: Unlike Quick Tunnels that use random URLs, cf-tunnel uses [Locally-managed tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/local-management/) with user-defined hostnames – critical for OAuth/SSO authentication flows.
- **Config-Driven Approach**: Manage tunnels entirely from your configuration file – no manual CLI commands needed.
- **Automatic Lifecycle Management**: Creates, configures, and cleans up tunnels and DNS records automatically.
- **Clean Exit Handling**: Automatically removes tunnels and DNS records when your application exits.

### When to Choose cf-tunnel

Choose **cf-tunnel** when you need:

- A persistent, custom hostname for your local development environment
- Authentication flows that require stable callback URLs
- Automated tunnel management within your application lifecycle
- Complete cleanup of resources when your application exits

## Features

- 🚀 Simple CLI interface
- ⚙️ Flexible configuration (JS/JSON/YAML)
- 🔄 Automatic tunnel cleanup
- 🔒 Secure credential management
- 📂 OS-specific config paths
- 📝 TypeScript support

## CLI Usage

### Installation

<!-- automd:pm-install name="cf-tunnel" global -->

```sh
# ✨ Auto-detect
npx nypm install cf-tunnel

# npm
npm install cf-tunnel

# yarn
yarn add cf-tunnel

# pnpm
pnpm install cf-tunnel

# bun
bun install cf-tunnel

# deno
deno install cf-tunnel
```

<!-- /automd -->

#### Run with default config (tunnel.config.{yml,yaml,json,js})

```sh
cf-tunnel
```

#### Or with custom config path

```sh
cf-tunnel -c custom-tunnel.config.js
cf-tunnel -c path/to/my-config.js
cf-tunnel -c /absolute/path/config.yml
cf-tunnel -c ./relative/config.json
```

<!-- automd:pm-x name="cf-tunnel" -->

```sh
# npm
npx cf-tunnel

# pnpm
pnpm dlx cf-tunnel

# bun
bunx cf-tunnel

# deno
deno run -A npm:cf-tunnel
```

<!-- /automd -->

### Configuration File

When no config file is specified, the CLI looks for these files in order:

1. `tunnel.config.yml`
2. `tunnel.config.yaml`
3. `tunnel.config.json`
4. `tunnel.config.js`

Example configuration file:

```js
// tunnel.config.js
export default {
  cfToken: process.env.CF_TOKEN, // Cloudflare API token
  tunnelName: "my-tunnel",
  ingress: [
    {
      hostname: "app.example.com",
      service: "http://localhost:3000",
    },
    // Add more services as needed
  ],
  // Optional: Control how existing resources are handled
  removeExistingDns: false, // Set to true to automatically remove existing DNS records
  removeExistingTunnel: false, // Set to true to automatically remove existing tunnel
};
```

## Programmatic Usage

### Installation

<!-- automd:pm-install name="cf-tunnel" -->

```sh
# ✨ Auto-detect
npx nypm install cf-tunnel

# npm
npm install cf-tunnel

# yarn
yarn add cf-tunnel

# pnpm
pnpm install cf-tunnel

# bun
bun install cf-tunnel

# deno
deno install cf-tunnel
```

<!-- /automd -->

### Usage

**ESM** (Node.js, Bun, Deno)

```js
import { cfTunnel, defineTunnelConfig } from "cf-tunnel";

const config = defineTunnelConfig({
  cfToken: process.env.CF_TOKEN,
  tunnelName: "my-tunnel",
  ingress: [
    {
      hostname: "app.example.com",
      service: "http://localhost:3000",
    },
  ],
  removeExistingDns: true,
  removeExistingTunnel: true,
});

// Start the tunnel
await cfTunnel(config);
```

## Lifecycle Management

**cf-tunnel** manages the entire lifecycle of your Cloudflare Tunnel:

1. **Setup Phase**:

   - If `removeExistingTunnel: true`, removes any existing tunnel with the same name
   - If `removeExistingDns: true`, removes DNS records for hostnames in your config
   - Creates a new tunnel with the specified name
   - Configures DNS records for all ingress services

2. **Running Phase**:

   - Runs the tunnel in the foreground
   - Keeps the process alive until interrupted

3. **Cleanup Phase** (triggered on process exit):
   - Automatically removes all DNS records created for the tunnel
   - Deletes the tunnel from Cloudflare
   - Removes local credential files

This automatic lifecycle management ensures no orphaned resources are left in your Cloudflare account.

---

## Configuration Options

| Option               | Type      | Required | Default               | Description                                             |
| -------------------- | --------- | -------- | --------------------- | ------------------------------------------------------- |
| cfToken              | string    | Yes      | process.env.CF_TOKEN  | Cloudflare API token                                    |
| tunnelName           | string    | Yes      | -                     | Name for the tunnel                                     |
| ingress              | Ingress[] | Yes      | -                     | Array of services to expose                             |
| cloudflaredConfigDir | string    | No       | OS-specific default\* | Path to cloudflared config directory                    |
| removeExistingDns    | boolean   | No       | false                 | If true, removes existing DNS records                   |
| removeExistingTunnel | boolean   | No       | false                 | If true, removes any existing tunnel with the same name |

\* Default config directory:

- Windows: `%AppData%/Local/cloudflared`
- macOS: `~/Library/Application Support/cloudflared`
- Linux: `~/.cloudflared`

### Ingress Configuration

Each ingress entry requires:

- `hostname`: The public hostname for the service (e.g., "app.example.com")
- `service`: The local service URL (e.g., "http://localhost:3000")

Additional ingress options are supported as per [Cloudflare's documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/local-management/configuration-file/#supported-protocols).

## Examples

Check out the [examples directory](./examples) for usage examples:

<!-- automd:file src="examples/tunnel.js" code lang="js" -->

```js [tunnel.js]
import { cfTunnel, defineTunnelConfig } from "cf-tunnel";

const tunnelConfig = defineTunnelConfig({
  cfToken: process.env.CF_TOKEN,
  tunnelName: "test-tunnel",
  ingress: [{ hostname: "test.com", service: "localhost:3000" }],
});

await cfTunnel(tunnelConfig);
```

<!-- /automd -->

## Development

<details>
<summary>Local Development</summary>

1. Clone this repository
2. Install latest LTS version of [Node.js](https://nodejs.org/en/)
3. Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
4. Install dependencies using `pnpm install`
5. Run interactive tests using `pnpm dev`

</details>

## License

Published under the [MIT](./LICENSE) license.

## Contributors

Published under the [MIT](https://github.com/jasenmichael/cf-tunnel/blob/main/LICENSE) license.
Made by [@jasenmichael](https://github.com/jasenmichael) ❤️

<!-- automd:with-automd -->

---

_🤖 auto updated with [automd](https://automd.unjs.io)_

<!-- /automd -->
