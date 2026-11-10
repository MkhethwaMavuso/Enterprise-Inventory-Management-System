import type { NextConfig } from "next";

const nextConfig: NextConfig = process.env.NODE_ENV === "production"
  ? {
      output: "export",
      images: { unoptimized: true },
    }
  : {
      async rewrites() {
        return [{ source: "/api/:path*", destination: "http://127.0.0.1:4000/api/:path*" }];
      },
      images: { unoptimized: true },
    };

export default nextConfig;