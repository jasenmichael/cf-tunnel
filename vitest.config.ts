import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "bin/**",
        "dist/**",
        "build.config.ts",
        "build.cli.config.ts",
        "test/**",
      ],
      include: ["src/**"],
    },
  },
});
