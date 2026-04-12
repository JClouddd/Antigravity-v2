import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Prevent firebase-admin from being bundled into client or crashing build
  serverExternalPackages: ['firebase-admin'],
  // Set a 60s timeout for static generation so builds never hang
  staticPageGenerationTimeout: 60,
};

export default nextConfig;
