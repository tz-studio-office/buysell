import { getConfig } from '../config';
import { logError, logInfo } from '../lib/logger';
import { normalizeListing } from '../lib/normalizers';
import { insertCrawlRun, upsertNormalizedProducts, upsertSupplierRaw } from '../lib/supabase';
import { fetchBuzzstorePage } from '../sources/buzzstore';
import { fetchOffmollPage } from '../sources/offmoll';
import { fetchSecondStreetPage } from '../sources/secondstreet';
import type { Env, SupplierSourceConfig } from '../types/index';

async function fetchSupplierPage(config: Awaited<ReturnType<typeof getConfig>>, source: SupplierSourceConfig, seedUrl: string, page: number) {
  switch (source.source) {
    case 'secondstreet':
      return fetchSecondStreetPage(config, seedUrl, page);
    case 'buzzstore':
      return fetchBuzzstorePage(config, seedUrl, page);
    case 'offmoll':
      return fetchOffmollPage(config, seedUrl, page);
    default:
      throw new Error(`Unsupported supplier source: ${String(source.source)}`);
  }
}

export async function runSuppliersFrequent(env: Env): Promise<Response> {
  const config = await getConfig(env);
  let total = 0;

  for (const source of config.supplierSources) {
    const maxPages = source.maxPages && source.maxPages > 0 ? source.maxPages : config.supplierMaxPages;
    for (const seedUrl of source.seedUrls) {
      for (let page = 1; page <= maxPages; page += 1) {
        try {
          const result = await fetchSupplierPage(config, source, seedUrl, page);
          if (!result.listings.length) break;

          await upsertSupplierRaw(env, result.listings);
          await upsertNormalizedProducts(env, result.listings.map(normalizeListing));
          await insertCrawlRun(env, {
            jobName: 'suppliers-frequent',
            sourceName: source.source,
            url: result.url,
            page,
            status: 'success',
            resultCount: result.listings.length,
            metadata: { seedUrl },
          });

          total += result.listings.length;
          logInfo('supplier page processed', { source: source.source, page, count: result.listings.length });
        } catch (error) {
          const message = (error as Error).message;
          logError('supplier page failed', { source: source.source, page, error: message, seedUrl });
          await insertCrawlRun(env, {
            jobName: 'suppliers-frequent',
            sourceName: source.source,
            url: seedUrl,
            page,
            status: 'error',
            errorMessage: message,
            metadata: { seedUrl },
          });
        }
      }
    }
  }

  return Response.json({ ok: true, job: 'suppliers-frequent', total });
}
