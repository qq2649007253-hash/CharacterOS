import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@/server': fileURLToPath(new URL('./services/api/src/server', import.meta.url)), '@characteros/contracts': fileURLToPath(new URL('./packages/contracts/src', import.meta.url)) } },
  test: { environment: 'node' },
});
