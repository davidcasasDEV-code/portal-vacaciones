import fs from 'node:fs';
import { defineConfig } from 'vite';

// Identificador de compilación: el portal lo compara con dist/version.json para
// recargarse solo cuando se publica una versión nueva.
const BUILD_ID = new Date().toISOString();

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    {
      name: 'version-json',
      apply: 'build',
      writeBundle(opts) {
        fs.writeFileSync(`${opts.dir}/version.json`, JSON.stringify({ build: BUILD_ID }));
      },
    },
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
  server: { port: 5173 },
});
