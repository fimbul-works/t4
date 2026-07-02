import { defineConfig, type UserConfig } from "tsdown";

const entryPoints: Record<string, string> = {
  bundle: "src/index.ts",
};

const commonConfig: UserConfig = {
  platform: "neutral",
  format: ["esm"],
  target: "es2022",
  dts: true,
  treeshake: true,
  outDir: "bundles",
  inputOptions: {
    optimization: {
      inlineConst: false,
    },
    experimental: {
      attachDebugInfo: "none",
    },
  },
  deps: {
    alwaysBundle: ["@fimbul-works/vec"],
  },
};

export default defineConfig(
  Object.entries(entryPoints).map(([key, entry]) => ({
    entry: {
      [key]: entry,
    },
    ...commonConfig,
  })),
);
