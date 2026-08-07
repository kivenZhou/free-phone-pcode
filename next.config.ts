import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native TLS-impersonation client; must not be bundled by Turbopack
  serverExternalPackages: ["impit"],
};

export default nextConfig;
