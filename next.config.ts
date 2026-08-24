import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isCapacitorBuild = process.env.BUILD_TARGET === 'capacitor'

const nextConfig: NextConfig = {
  output: 'standalone',
  /* config options here */
  reactStrictMode: false,
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      {
        protocol: "https",
        hostname: "127.0.0.1",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "localhost",
      },
    ],
  },

};

// withSentryConfig only uploads source maps when SENTRY_AUTH_TOKEN is set
// (e.g. in CI); locally or without it, it's a harmless passthrough.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
