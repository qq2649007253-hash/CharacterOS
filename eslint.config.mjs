import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  { settings: { next: { rootDir: 'apps/web/' } } },
  globalIgnores(['**/.next/**', '**/runtime/**', '**/dist/**', 'dist-desktop/**', '**/node_modules/**', '**/next-env.d.ts']),
]);
