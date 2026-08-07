import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const repoBasePath = "/free-phone-pcode";

const nextConfig: NextConfig = {
  // Native TLS-impersonation client; must not be bundled by Turbopack
  serverExternalPackages: ["impit"],
  ...(isGithubPages
    ? {
        output: "export",
        basePath: repoBasePath,
        assetPrefix: `${repoBasePath}/`,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
