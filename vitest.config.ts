import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    // Resolve alias same as Vite
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
