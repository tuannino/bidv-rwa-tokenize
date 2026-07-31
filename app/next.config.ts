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
      "@x402/svm/exact/client": emptyPath,
      "@x402/svm/upto/client": emptyPath,
      "@x402/evm": emptyPath,
      "@x402/svm": emptyPath,
      "@x402/client": emptyPath,
      "@vercel/og": emptyPath,
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
      "@x402/svm/exact/client": "./src/empty.ts",
      "@x402/svm/upto/client": "./src/empty.ts",
      "@x402/evm": "./src/empty.ts",
      "@x402/svm": "./src/empty.ts",
      "@x402/client": "./src/empty.ts",
      "@x402/*": "./src/empty.ts",
      "@vercel/og": "./src/empty.ts",
    }
  },
  // Exclude heavy unused WASM binaries from being copied into build functions
  outputFileTracingExcludes: {
    "*": [
      "node_modules/next/dist/compiled/@vercel/og/resvg.wasm",
      "node_modules/next/dist/compiled/@vercel/og/yoga.wasm",
    ],
  }
};

export default nextConfig;
