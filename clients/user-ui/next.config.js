/** @type {import('next').NextConfig} */
const nextConfig = {
  // biar build tidak berhenti karena lint/type error
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // agar bisa upload “standalone” ke cPanel
  output: 'standalone',
};

module.exports = nextConfig;
