import { getConfig } from '../config';
import { logError, logInfo } from '../lib/logger';
import { normalizeListing } from '../lib/normalizers';
import { insertCrawlRun, recomputeMarketStats, upsertMercariRaw, upsertNormalizedProducts } from '../lib/supabase';
import { fetchMercariSoldItems } from '../sources/mercari';
import type { Env } from '../types/index';

export async function runMercariDaily(env: Env): Promise<Response> {
  const config = await getConfig(env);
  let total = 0;

  for (const category of config.mercariCategories) {
    const maxPages = category.maxPages && category.maxPages > 0 ? category.maxPages : config.mercariMaxPages;
    for (let page = 1; page <= maxPages; page += 1) {
      try {
        const result = await fetchMercariSoldItems(config, category, page);
        if (!result.listings.length) break;

        await upsertMercariRaw(env, result.listings);
        await upsertNormalizedProducts(env, result.listings.map(normalizeListing));
        await insertCrawlRun(env, {
          jobName: 'mercari-daily',
          sourceName: 'mercari',
          url: result.url,
          page,
          status: 'success',
          resultCount: result.listings.length,
          metadata: { categoryKey: category.key, categoryLabel: category.label },
        });

        total += result.listings.length;
        logInfo('mercari page processed', { page, count: result.listings.length, category: category.key });
      } catch (error) {
        const message = (error as Error).message;
        logError('mercari page failed', { page, category: category.key, error: message });
        await insertCrawlRun(env, {
          jobName: 'mercari-daily',
          sourceName: 'mercari',
          page,
          status: 'error',
          errorMessage: message,
          metadata: { categoryKey: category.key, categoryLabel: category.label },
        });
      }
    }
  }

  const asOfDate = new Date().toISOString().slice(0, 10);
  await recomputeMarketStats(env, asOfDate);

  return Response.json({ ok: true, job: 'mercari-daily', total, asOfDate });
}
