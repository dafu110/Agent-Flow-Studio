import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 放行局域网 IP
  allowedDevOrigins: ['10.255.254.2', 'localhost:3000', '10.255.254.2:3000']
};

export default nextConfig;