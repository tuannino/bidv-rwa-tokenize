import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    const emptyPath = path.resolve(process.cwd(), "src/empty.ts");
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@x402/core": emptyPath,
      "@x402/core/client": emptyPath,
      "@x402/evm/exact/client": emptyPath,
      "@x402/evm/upto/client": emptyPath,
    };
    return config;
  },
  // For Next.js 16+ Turbopack
  turbopack: {
    resolveAlias: {
      "@x402/core": "./src/empty.ts",
      "@x402/core/client": "./src/empty.ts",
      "@x402/evm/exact/client": "./src/empty.ts",
      "@x402/evm/upto/client": "./src/empty.ts",
    }
  }
};

export default nextConfig;
