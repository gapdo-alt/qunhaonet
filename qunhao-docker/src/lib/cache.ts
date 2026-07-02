export const CACHE = {
  ASSETS_IMMUTABLE: 'public, max-age=31536000, immutable',
  QR_A: 'public, max-age=31536000, immutable',
  QR_C: 'public, max-age=300',
  PAGE: 'public, max-age=300',
  OWNER: 'public, max-age=60',
  PRIVATE: 'private, no-store',
  API: 'no-store',
} as const;
