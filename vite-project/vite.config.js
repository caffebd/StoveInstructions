import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        instructions: resolve(rootDir, 'instructions.html'),
        stoveDemo: resolve(rootDir, 'stoveDemo.html'),
      },
    },
  },
});
