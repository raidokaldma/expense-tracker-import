import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono, type Next } from 'hono';
import { logger } from 'hono/logger';
import { z } from 'zod';
import { messageOf } from '../../shared/errors.ts';
import type { Service } from '../service.ts';
import { HttpError, statusOf } from './httpErrors.ts';
import { COUNTRY_CODE, createConnectionSchema, fetchSchema, patchConnectionSchema } from './schemas.ts';

interface AppOptions {
  service: Service;
  /** The built frontend, e.g. "dist" */
  staticDir?: string;
  logRequests?: boolean;
}

const PAGE = '/import';

async function parseBody<S extends z.ZodType>(context: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await context.req.json();
  } catch {
    throw new HttpError(400, 'The body is not valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new HttpError(422, z.prettifyError(result.error));
  return result.data;
}

/** The person making the request, for the bank's PSU headers. */
function psuOf(context: Context) {
  return {
    ipAddress: getConnInfo(context).remote.address ?? '127.0.0.1',
    userAgent: context.req.header('user-agent') ?? 'unknown',
  };
}

// other sites cannot send JSON without the browser asking this server first
async function requireJsonBody(context: Context, next: Next) {
  const isWrite = ['POST', 'PUT', 'PATCH'].includes(context.req.method);
  if (isWrite && !context.req.header('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'Send the body as application/json');
  await next();
}

function notFound(): never {
  throw new HttpError(404, 'Not found');
}

export function createApp({ service, staticDir, logRequests }: AppOptions) {
  const app = new Hono();
  const api = app.basePath('/api/import');

  api.get('/health', (context) => context.json({ ok: true }));

  if (logRequests) app.use('*', logger());

  app.get('/', (context) => context.redirect(PAGE));

  // the bank sends the browser here after the login; it goes on to the page, which shows the outcome
  api.get('/connections/callback', async (context) => {
    const query = context.req.query();
    try {
      const connection = await service.completeAuth({
        state: query.state,
        code: query.code,
        error: query.error,
        errorDescription: query.error_description,
      });
      return context.redirect(`${PAGE}?connected=${encodeURIComponent(connection.id)}`);
    } catch (err) {
      if (statusOf(err) === null) console.error(err);
      return context.redirect(`${PAGE}?loginError=${encodeURIComponent(messageOf(err))}`);
    }
  });

  api.use('*', requireJsonBody);

  api.get('/connections/banks', async (context) => {
    const country = context.req.query('country') ?? '';
    if (!COUNTRY_CODE.test(country)) throw new HttpError(422, 'Pass ?country=, a country code such as EE');
    return context.json(await service.listBanks(country));
  });

  api.get('/connections', (context) => context.json(service.listConnections()));

  api.post('/connections', async (context) => {
    const input = await parseBody(context, createConnectionSchema);
    return context.json(await service.createConnection(input), 201);
  });

  api.get('/connections/:id', (context) => context.json(service.getConnection(context.req.param('id'))));

  api.patch('/connections/:id', async (context) => {
    const patch = await parseBody(context, patchConnectionSchema);
    return context.json(service.updateConnection(context.req.param('id'), patch));
  });

  api.delete('/connections/:id', async (context) => {
    await service.deleteConnection(context.req.param('id'));
    return context.body(null, 204);
  });

  api.post('/connections/:id/authorize', async (context) =>
    context.json(await service.authorize(context.req.param('id'))),
  );

  // answers once every fetch is done, with their attempts
  api.post('/fetch', async (context) => {
    const { mode, connectionId } = await parseBody(context, fetchSchema);
    const psu = mode === 'user' ? psuOf(context) : null;
    return context.json(await service.fetch({ mode, connectionId, psu }));
  });

  api.get('/attempts', (context) => {
    const limit = Math.min(Number(context.req.query('limit')) || 50, 1000);
    return context.json(service.listAttempts({ connectionId: context.req.query('connectionId'), limit }));
  });

  api.all('*', notFound);

  // the page is built with base /import/
  if (staticDir)
    app.use(`${PAGE}/*`, serveStatic({ root: staticDir, rewriteRequestPath: (path) => path.slice(PAGE.length) }));

  app.all('*', notFound);

  app.onError((err, context) => {
    const status = statusOf(err);
    if (status !== null) return context.json({ error: err.message }, status as 400);
    console.error(err);
    return context.json({ error: err.message || 'Something went wrong on the server' }, 500);
  });

  return app;
}
