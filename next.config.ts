import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // L'aperçu est servi derrière le proxy space-z.ai : déclarer ces origines
  // évite l'avertissement cross-origin (/_next/*) et prépare Next 17.
  allowedDevOrigins: ["*.space-z.ai"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
