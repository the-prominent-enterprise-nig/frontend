import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // A second `next dev` process (Playwright's isolated e2e frontend, see
  // playwright.config.ts) can't share .next with the real dev server — Next
  // takes an exclusive lock on <distDir>/dev/lock, so a second instance
  // pointed at the same dir fails to start while the real one is running.
  ...(process.env.E2E_ISOLATED ? { distDir: '.next-e2e' } : {}),
  experimental: {
    serverActions: {
      // Default is 1mb — CSV bulk-import actions (items, serialized inventory)
      // post the file as multipart FormData through a Server Action, so a
      // file anywhere past a few hundred rows blows past that and 413s
      // before the action body even runs. Matches the backend's own
      // multer limit (MAX_FILE_SIZE_BYTES, default 10mb) so this isn't the
      // tighter bottleneck.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
