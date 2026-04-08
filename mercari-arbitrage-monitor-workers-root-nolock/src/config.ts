import {
  listActiveMercariCategories,
  listActiveSupplierSources,
  loadRuntimeSettings,
} from './lib/supabase';
import type { Env, MercariCategoryConfig, RuntimeSettings, SupplierSourceConfig } from './types/index';

export interface AppConfig extends RuntimeSettings {
  mercariCategories: MercariCategoryConfig[];
  supplierSources: SupplierSourceConfig[];
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() === 'true';
}

export function getDefaultRuntimeSettings(env: Env): RuntimeSettings {
  return {
    mercariMaxPages: toNumber(env.MERCARI_MAX_PAGES_PER_CATEGORY, 5),
    supplierMaxPages: toNumber(env.SUPPLIER_MAX_PAGES_PER_SOURCE, 5),
    httpTimeoutMs: toNumber(env.HTTP_TIMEOUT_MS, 15_000),
    httpRetryCount: toNumber(env.HTTP_RETRY_COUNT, 2),
    enableDetailEnrichment: toBoolean(env.ENABLE_DETAIL_ENRICHMENT, true),
    marketplaceFeeRate: toNumber(env.MARKETPLACE_FEE_RATE, 0.1),
    defaultShippingCostYen: toNumber(env.DEFAULT_SHIPPING_COST_YEN, 850),
    runMercariCron: env.RUN_MERCARI_CRON ?? '0 21 * * *',
    runSuppliersCron: env.RUN_SUPPLIERS_CRON ?? '15 * * * *',
    runMatchCron: env.RUN_MATCH_CRON ?? '25 * * * *',
  };
}

export async function getConfig(env: Env): Promise<AppConfig> {
  const defaults = getDefaultRuntimeSettings(env);
  const [runtimeSettings, mercariCategories, supplierSources] = await Promise.all([
    loadRuntimeSettings(env, defaults),
    listActiveMercariCategories(env),
    listActiveSupplierSources(env),
  ]);

  return {
    ...runtimeSettings,
    mercariCategories,
    supplierSources,
  };
}
