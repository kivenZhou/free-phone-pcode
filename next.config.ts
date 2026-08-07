import type { NextConfig } from "next";
import path from "path";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const skipNativeModules = process.env.SKIP_NATIVE_MODULES === "1";
const repoBasePath = "/free-phone-pcode";
const sms24Module = path.join(process.cwd(), "src/lib/providers/sms24");

const nextConfig: NextConfig = {
  ...(skipNativeModules
    ? {
        outputFileTracingExcludes: {
          "*": ["./node_modules/impit/**/*", "./node_modules/impit-*/**/*"],
        },
      }
    : {
        // Native TLS-impersonation client; must not be bundled by Turbopack
        serverExternalPackages: ["impit"],
      }),
  ...(isGithubPages
    ? {
        output: "export",
        basePath: repoBasePath,
        assetPrefix: `${repoBasePath}/`,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  webpack: (config, { webpack, isServer }) => {
    if (isServer && skipNativeModules) {
      config.resolve ??= {};
      config.resolve.alias = {
        ...config.resolve.alias,
        [sms24Module]: path.join(process.cwd(), "src/lib/providers/sms24.stub.ts"),
      };
      config.plugins.push(
        new webpack.DefinePlugin({
          "process.env.SKIP_NATIVE_MODULES": JSON.stringify("1"),
        }),
      );
    }
    return config;
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
