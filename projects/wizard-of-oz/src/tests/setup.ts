// Vitest setup: runs before every test file.
// jsdom is enabled via vitest.config.ts. We add a stub for createImageBitmap
// because it's not provided by jsdom; individual tests can override it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).createImageBitmap = (globalThis as any).createImageBitmap ?? (async () => ({
  width: 1000,
  height: 1000,
  close: () => {},
}));
