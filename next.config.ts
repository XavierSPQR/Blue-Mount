import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — required because Firebase Hosting's Spark (free) plan
  // has no Cloud Functions/Cloud Run, which is what SSR would need.
  // See IMPLEMENTATION_PLAN.md section 1.
  output: "export",
  images: {
    // next/image optimization requires a server; static export can't use it.
    unoptimized: true,
  },
};

export default nextConfig;
