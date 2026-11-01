
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  additionalPrecacheEntries: [
    { url: "/offline", revision: "1" },
  ],
});

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.92.215.10", "10.178.190.10", "10.254.162.10"],
  experimental: {
    // Crossfade between routes (see <ViewTransition> in app/(main)/layout.tsx).
    viewTransition: true,
  },
};

export default withSerwist(nextConfig);
