import { defineBuildConfig } from "unbuild";
import { rm, readdir } from "node:fs/promises";

export default defineBuildConfig({
  hooks: {
    async "build:done"() {
      const files = await readdir("dist");
      for (const file of files) {
        if (file.startsWith("cli") && file !== "cli.mjs") {
          await rm(`dist/${file}`);
        }
      }
    },
  },
});
