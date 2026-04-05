import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.8.206',
    '192.168.9.125',
    'localhost',
  ],
};

export default nextConfig;