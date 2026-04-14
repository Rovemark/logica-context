import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  external: ['better-sqlite3'],
  minify: true,
};

// MCP Server
await build({
  ...shared,
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.mjs',
  banner: { js: '#!/usr/bin/env node' },
});

// CLI (doctor, upgrade, stats)
await build({
  ...shared,
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.mjs',
  banner: { js: '#!/usr/bin/env node' },
});

console.log('Build complete: dist/server.mjs + dist/cli.mjs');
