import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { serve } from '@hono/node-server';
import type { Hono } from 'hono';

interface ServerOptions {
  host: string;
  port: number;
  tls: { certFile: string; keyFile: string } | null;
}

export function startServer(app: Hono, { host, port, tls }: ServerOptions) {
  const https = tls && {
    createServer,
    serverOptions: { cert: readFileSync(tls.certFile), key: readFileSync(tls.keyFile) },
  };
  return serve({ fetch: app.fetch, hostname: host, port, ...https }, ({ address, port }) =>
    console.log(`Expense importer on ${https ? 'https' : 'http'}://${address}:${port}`),
  );
}
