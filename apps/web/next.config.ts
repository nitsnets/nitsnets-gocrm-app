import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  async rewrites() {
    // Web and native clients share an origin; Laravel owns API authorization.
    const apiBase = (
      process.env.CRM_API_URL || "http://127.0.0.1:8000/api/v1"
    ).replace(/\/$/, "");
    return [{ source: "/api/v1/:path*", destination: `${apiBase}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
