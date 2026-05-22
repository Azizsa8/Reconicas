import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so Next stops auto-detecting a stale parent lockfile.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
