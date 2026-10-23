/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@grpc/grpc-js", "@grpc/proto-loader"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
