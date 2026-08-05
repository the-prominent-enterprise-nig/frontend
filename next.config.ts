import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
