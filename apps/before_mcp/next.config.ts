import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

function loadMonorepoEnv() {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, ".env.local"))) {
      loadEnvConfig(dir);
      return;
    }
    const parent = path.resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
}

loadMonorepoEnv();

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cursor/sdk"],
  transpilePackages: ["@mcp-learning/shared"],
};

export default nextConfig;
