import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@signal-room/artifacts': new URL(
        './packages/artifacts/src/index.ts',
        import.meta.url,
      ).pathname,
      '@signal-room/browser-ego': new URL(
        './packages/browser-ego/src/index.ts',
        import.meta.url,
      ).pathname,
      '@signal-room/domain': new URL(
        './packages/domain/src/index.ts',
        import.meta.url,
      ).pathname,
      '@signal-room/platform-xhs': new URL(
        './packages/platform-xhs/src/index.ts',
        import.meta.url,
      ).pathname,
      '@signal-room/research-single': new URL(
        './packages/research-single/src/index.ts',
        import.meta.url,
      ).pathname,
      '@signal-room/storage': new URL(
        './packages/storage/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
    ],
    coverage: { reporter: ['text', 'html'] },
  },
});
