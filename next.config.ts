import type { NextConfig } from "next";
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];
const nextConfig: NextConfig = {
  // Probar en el móvil por la red local (http://192.168.x.x:3000); solo afecta a `next dev`
  allowedDevOrigins: ["192.168.*.*"],
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};
export default nextConfig;
