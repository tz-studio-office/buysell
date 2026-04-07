import { createClient } from '@supabase/supabase-js';
import type {
  CandidateMatch,
  CrawlRun,
  CrawlTargetRow,
  Env,
  MercariCategoryConfig,
  NormalizedProduct,
  RawListing,
  RuntimeSettings,
  SourceName,
  SupplierSourceConfig,
  TargetType,
} from '../types/index';

const DEFAULT_SETTINGS_KEYS = [
  'mercari_max_pages',
  'supplier_max_pages',
  'http_timeout_ms',
  'http_retry_count',
  'enable_detail_enrichment',
  'marketplace_fee_rate',
  'default_shipping_cost_yen',
  'run_mercari_cron',
  'run_suppliers_cron',
  'run_match_cron',
] as const;

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}
function parseBoolean(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}
function parseNumber(value: string | null | undefined, fallback: number): number {
  if (value == null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
function parseText(value: string | null | undefined, fallback: string): string {
  if (value == null || value === '') return fallback;
  return value;
}

export function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function ensureDefaultRuntimeSettings(env: Env, defaults: RuntimeSettings): Promise<void> {
  const supabase = getSupabase(env);
  const payload = [
    { setting_key: 'mercari_max_pages', setting_value: String(defaults.mercariMaxPages), value_type: 'number' },
    { setting_key: 'supplier_max_pages', setting_value: String(defaults.supplierMaxPages), value_type: 'number' },
    { setting_key: 'http_timeout_ms', setting_value: String(defaults.httpTimeoutMs), value_type: 'number' },
    { setting_key: 'http_retry_count', setting_value: String(defaults.httpRetryCount), value_type: 'number' },
    { setting_key: 'enable_detail_enrichment', setting_value: String(defaults.enableDetailEnrichment), value_type: 'boolean' },
    { setting_key: 'marketplace_fee_rate', setting_value: String(defaults.marketplaceFeeRate), value_type: 'number' },
    { setting_key: 'default_shipping_cost_yen', setting_value: String(defaults.defaultShippingCostYen), value_type: 'number' },
    { setting_key: 'run_mercari_cron', setting_value: defaults.runMercariCron, value_type: 'text' },
    { setting_key: 'run_suppliers_cron', setting_value: defaults.runSuppliersCron, value_type: 'text' },
    { setting_key: 'run_match_cron', setting_value: defaults.runMatchCron, value_type: 'text' },
  ];
  const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'setting_key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function loadRuntimeSettings(env: Env, defaults: RuntimeSettings): Promise<RuntimeSettings> {
  await ensureDefaultRuntimeSettings(env, defaults);
  const supabase = getSupabase(env);
  const { data, error } = await supabase.from('app_settings').select('setting_key, setting_value').in('setting_key', [...DEFAULT_SETTINGS_KEYS]);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(String((row as any).setting_key), String((row as any).setting_value ?? ''));
  return {
    mercariMaxPages: parseNumber(map.get('mercari_max_pages'), defaults.mercariMaxPages),
    supplierMaxPages: parseNumber(map.get('supplier_max_pages'), defaults.supplierMaxPages),
    httpTimeoutMs: parseNumber(map.get('http_timeout_ms'), defaults.httpTimeoutMs),
    httpRetryCount: parseNumber(map.get('http_retry_count'), defaults.httpRetryCount),
    enableDetailEnrichment: parseBoolean(map.get('enable_detail_enrichment'), defaults.enableDetailEnrichment),
    marketplaceFeeRate: parseNumber(map.get('marketplace_fee_rate'), defaults.marketplaceFeeRate),
    defaultShippingCostYen: parseNumber(map.get('default_shipping_cost_yen'), defaults.defaultShippingCostYen),
    runMercariCron: parseText(map.get('run_mercari_cron'), defaults.runMercariCron),
    runSuppliersCron: parseText(map.get('run_suppliers_cron'), defaults.runSuppliersCron),
    runMatchCron: parseText(map.get('run_match_cron'), defaults.runMatchCron),
  };
}

function mapTargetRow(row: any): CrawlTargetRow {
  return {
    id: row.id,
    targetType: row.target_type,
    sourceName: row.source_name,
    targetKey: row.target_key,
    label: row.label,
    categoryId: row.category_id,
    keyword: row.keyword,
    seedUrl: row.seed_url,
    maxPages: row.max_pages,
    sortOrder: row.sort_order ?? 100,
    isActive: row.is_active ?? true,
    metadata: asObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAllTargets(env: Env): Promise<CrawlTargetRow[]> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase.from('crawl_targets').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapTargetRow);
}

export async function listActiveMercariCategories(env: Env): Promise<MercariCategoryConfig[]> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase.from('crawl_targets').select('*').eq('target_type', 'mercari_category').eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    key: row.target_key,
    label: row.label,
    categoryId: row.category_id ?? undefined,
    keyword: row.keyword ?? undefined,
    maxPages: row.max_pages ?? undefined,
    sortOrder: row.sort_order ?? 100,
    isActive: row.is_active ?? true,
  }));
}

export async function listActiveSupplierSources(env: Env): Promise<SupplierSourceConfig[]> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase.from('crawl_targets').select('*').eq('target_type', 'supplier_seed').eq('is_active', true).order('source_name', { ascending: true }).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  const grouped = new Map<string, SupplierSourceConfig>();
  for (const row of data ?? []) {
    const source = row.source_name as Exclude<SourceName, 'mercari'>;
    const existing = grouped.get(source);
    const maxPages = row.max_pages ?? undefined;
    if (!existing) {
      grouped.set(source, { id: row.id, source, label: row.label || source, seedUrls: row.seed_url ? [row.seed_url] : [], maxPages, sortOrder: row.sort_order ?? 100, isActive: row.is_active ?? true });
      continue;
    }
    if (row.seed_url) existing.seedUrls.push(row.seed_url);
    if (typeof maxPages === 'number' && (!existing.maxPages || maxPages > existing.maxPages)) existing.maxPages = maxPages;
  }
  return [...grouped.values()];
}

export async function upsertRuntimeSettings(env: Env, settings: Record<string, string>): Promise<void> {
  const supabase = getSupabase(env);
  const payload = Object.entries(settings).map(([setting_key, setting_value]) => ({
    setting_key,
    setting_value,
    value_type: ['enable_detail_enrichment'].includes(setting_key) ? 'boolean' : ['run_mercari_cron', 'run_suppliers_cron', 'run_match_cron'].includes(setting_key) ? 'text' : 'number',
  }));
  if (!payload.length) return;
  const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'setting_key' });
  if (error) throw error;
}

export async function upsertCrawlTarget(env: Env, target: { id?: string; targetType: TargetType; sourceName: SourceName; targetKey: string; label: string; categoryId?: string | null; keyword?: string | null; seedUrl?: string | null; maxPages?: number | null; sortOrder?: number; isActive?: boolean; metadata?: Record<string, unknown>; }): Promise<void> {
  const supabase = getSupabase(env);
  const payload = {
    id: target.id,
    target_type: target.targetType,
    source_name: target.sourceName,
    target_key: target.targetKey,
    label: target.label,
    category_id: target.categoryId ?? null,
    keyword: target.keyword ?? null,
    seed_url: target.seedUrl ?? null,
    max_pages: target.maxPages ?? null,
    sort_order: target.sortOrder ?? 100,
    is_active: target.isActive ?? true,
    metadata: target.metadata ?? {},
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('crawl_targets').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

export async function toggleCrawlTarget(env: Env, id: string, isActive: boolean): Promise<void> {
  const supabase = getSupabase(env);
  const { error } = await supabase.from('crawl_targets').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteCrawlTarget(env: Env, id: string): Promise<void> {
  const supabase = getSupabase(env);
  const { error } = await supabase.from('crawl_targets').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAdminSummary(env: Env) {
  const supabase = getSupabase(env);
  const today = new Date().toISOString().slice(0, 10);
  const [targetsRes, runsRes, candidatesRes] = await Promise.all([
    supabase.from('crawl_targets').select('id, is_active', { count: 'exact', head: false }),
    supabase.from('crawl_runs').select('id, job_name, source_name, status, created_at').gte('created_at', `${today}T00:00:00.000Z`).order('created_at', { ascending: false }).limit(20),
    supabase.from('match_candidates').select('id', { count: 'exact', head: true }).eq('matched_on', today),
  ]);
  return {
    targetCount: targetsRes.count ?? 0,
    activeTargetCount: (targetsRes.data ?? []).filter((row: any) => row.is_active).length,
    recentRuns: runsRes.data ?? [],
    todayCandidateCount: candidatesRes.count ?? 0,
  };
}

export async function insertCrawlRun(env: Env, payload: CrawlRun): Promise<void> {
  const supabase = getSupabase(env);
  const { error } = await supabase.from('crawl_runs').insert({ job_name: payload.jobName, source_name: payload.sourceName, url: payload.url ?? null, page: payload.page ?? null, status: payload.status, result_count: payload.resultCount ?? null, error_message: payload.errorMessage ?? null, metadata: payload.metadata ?? {} });
  if (error) throw error;
}
export async function upsertMercariRaw(env: Env, rows: RawListing[]): Promise<void> {
  if (!rows.length) return;
  const supabase = getSupabase(env);
  const payload = rows.map((row) => ({ source_name: row.sourceName, source_item_id: row.sourceItemId, category_key: row.categoryKey ?? null, category_label: row.categoryLabel ?? null, title: row.title, brand: row.brand ?? null, model_code: row.modelCode ?? null, size_label: row.sizeLabel ?? null, color_label: row.colorLabel ?? null, condition_label: row.conditionLabel ?? null, condition_rank: row.conditionRank ?? null, price_yen: row.priceYen, shipping_fee_burden: row.shippingFeeBurden ?? null, sold_at_detected_at: row.soldDetectedAt ?? new Date().toISOString(), item_url: row.itemUrl, image_url: row.imageUrl ?? null, raw_payload: row.rawPayload ?? {}, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('mercari_sales_raw').upsert(payload, { onConflict: 'source_item_id' });
  if (error) throw error;
}
export async function upsertSupplierRaw(env: Env, rows: RawListing[]): Promise<void> {
  if (!rows.length) return;
  const supabase = getSupabase(env);
  const now = new Date().toISOString();
  const payload = rows.map((row) => ({ source_name: row.sourceName, source_item_id: row.sourceItemId, title: row.title, brand: row.brand ?? null, model_code: row.modelCode ?? null, size_label: row.sizeLabel ?? null, color_label: row.colorLabel ?? null, condition_label: row.conditionLabel ?? null, condition_rank: row.conditionRank ?? null, listed_price_yen: row.priceYen, availability_status: row.availabilityStatus ?? 'active', shipping_fee_burden: row.shippingFeeBurden ?? null, store_name: row.storeName ?? null, item_url: row.itemUrl, image_url: row.imageUrl ?? null, first_seen_at: row.firstSeenAt ?? now, last_seen_at: row.lastSeenAt ?? now, is_active: row.isActive ?? true, raw_payload: row.rawPayload ?? {}, updated_at: now }));
  const { error } = await supabase.from('supplier_listings_raw').upsert(payload, { onConflict: 'source_name,source_item_id' });
  if (error) throw error;
}
export async function upsertNormalizedProducts(env: Env, rows: NormalizedProduct[]): Promise<void> {
  if (!rows.length) return;
  const supabase = getSupabase(env);
  const payload = rows.map((row) => ({ source_name: row.sourceName, source_item_id: row.sourceItemId, title: row.title, normalized_title: row.normalizedTitle, brand: row.brand ?? null, normalized_brand: row.normalizedBrand ?? null, model_code: row.modelCode ?? null, size_label: row.sizeLabel ?? null, size_normalized: row.sizeNormalized ?? null, color_label: row.colorLabel ?? null, color_normalized: row.colorNormalized ?? null, condition_label: row.conditionLabel ?? null, condition_rank: row.conditionRank ?? null, title_tokens: row.titleTokens, product_fingerprint: row.productFingerprint, price_yen: row.priceYen, item_url: row.itemUrl, raw_ref: row.rawRef ?? {}, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('products_normalized').upsert(payload, { onConflict: 'source_name,source_item_id' });
  if (error) throw error;
}
export async function recomputeMarketStats(env: Env, asOfDate: string): Promise<void> {
  const supabase = getSupabase(env);
  const { error } = await supabase.rpc('recompute_market_stats_30d', { p_as_of_date: asOfDate });
  if (error) throw error;
}
export async function fetchRecentSupplierProducts(env: Env) {
  const supabase = getSupabase(env);
  const { data, error } = await supabase.from('products_normalized').select('*').neq('source_name', 'mercari').order('updated_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data ?? [];
}
export async function fetchRecentMercariProducts(env: Env) {
  const supabase = getSupabase(env);
  const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('products_normalized').select('*').eq('source_name', 'mercari').gte('updated_at', since).limit(5000);
  if (error) throw error;
  return data ?? [];
}
export async function fetchMarketStatsMap(env: Env) {
  const supabase = getSupabase(env);
  const asOfDate = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from('market_stats_30d').select('*').eq('as_of_date', asOfDate);
  if (error) throw error;
  return data ?? [];
}
export async function upsertMatchCandidates(env: Env, rows: CandidateMatch[]): Promise<void> {
  if (!rows.length) return;
  const supabase = getSupabase(env);
  const payload = rows.map((row) => ({ supplier_source_name: row.supplierSourceName, supplier_source_item_id: row.supplierSourceItemId, mercari_source_item_id: row.mercariSourceItemId, matched_on: row.matchedOn, match_score: row.matchScore, match_status: 'candidate', basis: row.basis, supplier_price_yen: row.supplierPriceYen, mercari_median_price_yen: row.mercariMedianPriceYen, mercari_sold_count_30d: row.mercariSoldCount30d, expected_gross_margin_yen: row.expectedGrossMarginYen, expected_margin_rate: row.expectedMarginRate, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('match_candidates').upsert(payload, { onConflict: 'supplier_source_name,supplier_source_item_id,mercari_source_item_id' });
  if (error) throw error;
}
