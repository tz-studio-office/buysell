import { handleAdminRequest } from './admin/site';
import { getConfig } from './config';
import { runMatch } from './jobs/match';
import { runMercariDaily } from './jobs/mercari-daily';
import { runSuppliersFrequent } from './jobs/suppliers-frequent';
import { logError } from './lib/logger';
import type { Env } from './types/index';

function unauthorized(): Response { return new Response('Unauthorized', { status: 401 }); }
function isAuthorized(request: Request, env: Env): boolean { const url = new URL(request.url); const token = url.searchParams.get('token') ?? request.headers.get('x-run-token'); return token === env.RUN_TOKEN; }
async function runFullSync(env: Env): Promise<Response> { const mercari = await runMercariDaily(env); const suppliers = await runSuppliersFrequent(env); const match = await runMatch(env); return Response.json({ ok: true, mercari: await mercari.json(), suppliers: await suppliers.json(), match: await match.json() }); }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/health') return Response.json({ ok: true, app: env.APP_NAME ?? 'mercari-arbitrage-monitor' });
      if (url.pathname.startsWith('/admin')) return handleAdminRequest(request, env);
      if (!isAuthorized(request, env)) return unauthorized();
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
      switch (url.pathname) {
        case '/tasks/mercari-daily': return runMercariDaily(env);
        case '/tasks/suppliers': return runSuppliersFrequent(env);
        case '/tasks/match': return runMatch(env);
        case '/tasks/full-sync': return runFullSync(env);
        default: return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      logError('request failed', { error: (error as Error).message });
      return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
    }
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const config = await getConfig(env);
    try {
      switch (controller.cron) {
        case config.runMercariCron: await runMercariDaily(env); break;
        case config.runSuppliersCron: await runSuppliersFrequent(env); break;
        case config.runMatchCron: await runMatch(env); break;
        default: await runSuppliersFrequent(env);
      }
    } catch (error) {
      logError('scheduled run failed', { cron: controller.cron, error: (error as Error).message });
    }
  },
};
