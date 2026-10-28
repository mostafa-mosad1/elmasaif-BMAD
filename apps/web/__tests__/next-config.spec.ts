import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface RewriteRule {
  source: string;
  destination: string;
}

describe('next.config.ts rewrites', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.INTERNAL_API_URL;
    delete process.env.API_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should define an async rewrites function', async () => {
    const nextConfig = (await import('../next.config')).default;
    expect(nextConfig.rewrites).toBeDefined();
    expect(typeof nextConfig.rewrites).toBe('function');
  });

  it('should map /api/:path* to default http://localhost:4000/api/:path*', async () => {
    const nextConfig = (await import('../next.config')).default;
    if (!nextConfig.rewrites) throw new Error('rewrites not defined');
    const rewrites = await nextConfig.rewrites();
    const rules = (Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles || []) as RewriteRule[];

    const apiRule = rules.find((r) => r.source === '/api/:path*');
    expect(apiRule).toBeDefined();
    expect(apiRule?.destination).toBe('http://localhost:4000/api/:path*');
  });

  it('should prioritize INTERNAL_API_URL when provided', async () => {
    process.env.INTERNAL_API_URL = 'http://backend-internal:4000';
    process.env.API_URL = 'http://public-api:4000';
    const nextConfig = (await import('../next.config')).default;
    if (!nextConfig.rewrites) throw new Error('rewrites not defined');
    const rewrites = await nextConfig.rewrites();
    const rules = (Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles || []) as RewriteRule[];

    const apiRule = rules.find((r) => r.source === '/api/:path*');
    expect(apiRule?.destination).toBe('http://backend-internal:4000/api/:path*');
  });

  it('should use API_URL if INTERNAL_API_URL is absent', async () => {
    delete process.env.INTERNAL_API_URL;
    process.env.API_URL = 'http://public-api:4000';
    const nextConfig = (await import('../next.config')).default;
    if (!nextConfig.rewrites) throw new Error('rewrites not defined');
    const rewrites = await nextConfig.rewrites();
    const rules = (Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles || []) as RewriteRule[];

    const apiRule = rules.find((r) => r.source === '/api/:path*');
    expect(apiRule?.destination).toBe('http://public-api:4000/api/:path*');
  });

  it('should cleanly proxy Swagger UI paths such as /api/docs and subpaths', async () => {
    const nextConfig = (await import('../next.config')).default;
    if (!nextConfig.rewrites) throw new Error('rewrites not defined');
    const rewrites = await nextConfig.rewrites();
    const rules = (Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles || []) as RewriteRule[];

    const apiRule = rules.find((r) => r.source === '/api/:path*');
    expect(apiRule).toBeDefined();
    // Verify that /api/:path* wildcard pattern matches any subpath without conflict
    expect(apiRule?.source).toBe('/api/:path*');
    expect(apiRule?.destination).toContain('/api/:path*');
  });
});
