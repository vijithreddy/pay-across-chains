import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CORS for /api/relay — Tempo Wallet iframe at wallet.tempo.xyz calls our relay
  async headers() {
    return [
      {
        source: "/api/relay",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, GET, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
