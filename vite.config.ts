/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // npm run dev: the same https://localhost:3000 as in production, so the bank's redirect works while developing
  const https =
    env.TLS_CERT_FILE && env.TLS_KEY_FILE
      ? { cert: readFileSync(env.TLS_CERT_FILE), key: readFileSync(env.TLS_KEY_FILE) }
      : undefined;
  const api = 'http://127.0.0.1:8787';
  return {
    plugins: [react()],
    // the server serves the page only under /import
    base: '/import/',
    // the API server runs next to Vite (see server/dev.ts)
    server: { port: 3000, strictPort: true, https, proxy: { '/api': api } },
    test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
  };
});
