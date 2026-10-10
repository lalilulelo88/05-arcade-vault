import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Probar en el móvil por la red local (http://192.168.x.x:3000); solo afecta a `next dev`
  allowedDevOrigins: ["192.168.*.*"],
};
export default nextConfig;
