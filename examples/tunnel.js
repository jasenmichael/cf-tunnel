import { cfTunnel, defineTunnelConfig } from "cf-tunnel";

const tunnelConfig = defineTunnelConfig({
  cfToken: process.env.CF_TOKEN,
  tunnelName: "test-tunnel",
  domain: "test.com",
  ingress: [{ hostname: "test.com", service: "localhost:3000" }],
});

await cfTunnel(tunnelConfig);
