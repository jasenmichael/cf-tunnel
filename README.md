# 모-cf-tunnel-던

<!-- automd:badges name="cf-tunnel" codecov license -->

[![npm version](https://img.shields.io/npm/v/cf-tunnel)](https://npmjs.com/package/cf-tunnel)
[![npm downloads](https://img.shields.io/npm/dm/cf-tunnel)](https://npm.chart.dev/cf-tunnel)
[![codecov](https://img.shields.io/codecov/c/gh/jasenmichael/cf-tunnel)](https://codecov.io/gh/jasenmichael/cf-tunnel)
[![license](https://img.shields.io/github/license/jasenmichael/cf-tunnel)](https://github.com/jasenmichael/cf-tunnel/blob/main/LICENSE)

<!-- /automd -->

Easily manage Cloudflare Tunnels in your Node.js applications.

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
  domain: "example.com",
  ingress: [
    {
      hostname: "app.example.com",
      service: "http://localhost:3000",
    },
    // Add more services as needed
  ],
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
  domain: "example.com",
  ingress: [
    {
      hostname: "app.example.com",
      service: "http://localhost:3000",
    },
  ],
});

// Start the tunnel
await cfTunnel(config);
```

---

## Configuration Options

| Option               | Type      | Required | Default               | Description                          |
| -------------------- | --------- | -------- | --------------------- | ------------------------------------ |
| cfToken              | string    | Yes      | process.env.CF_TOKEN  | Cloudflare API token                 |
| tunnelName           | string    | Yes      | -                     | Name for the tunnel                  |
| domain               | string    | Yes      | -                     | Your Cloudflare domain               |
| ingress              | Ingress[] | Yes      | -                     | Array of services to expose          |
| cloudflaredConfigDir | string    | No       | OS-specific default\* | Path to cloudflared config directory |

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
  domain: "test.com",
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
4. Install dependencies using `npm install`
5. Run interactive tests using `npm run dev`

</details>

## License

Published under the [MIT](./LICENSE) license.

## Contributors

<!-- automd:contributors author=jasenmichael license=MIT -->

Published under the [MIT](https://github.com/jasenmichael/cf-tunnel/blob/main/LICENSE) license.
Made by [@jasenmichael](https://github.com/jasenmichael) and [community](https://github.com/jasenmichael/cf-tunnel/graphs/contributors) 💛
<br><br>
<a href="https://github.com/jasenmichael/cf-tunnel/graphs/contributors">
<img src="https://contrib.rocks/image?repo=jasenmichael/cf-tunnel" />
</a>

<!-- /automd -->

<!-- automd:with-automd -->

---

_🤖 auto updated with [automd](https://automd.unjs.io)_

<!-- /automd -->
