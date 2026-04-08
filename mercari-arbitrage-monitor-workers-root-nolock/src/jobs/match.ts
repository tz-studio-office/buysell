import { getConfig } from '../config';
import { buildCandidateMatch, scoreProducts } from '../lib/scoring';
import { fetchMarketStatsMap, fetchRecentMercariProducts, fetchRecentSupplierProducts, upsertMatchCandidates } from '../lib/supabase';
import type { CandidateMatch, Env, NormalizedProduct } from '../types/index';

function buildStatsIndex(statsRows: any[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const row of statsRows) {
    const key = [row.normalized_brand ?? '', row.model_code ?? '', row.size_normalized ?? ''].join('|');
    map.set(key, row);
  }
  return map;
}
function productKey(product: NormalizedProduct | Record<string, any>): string {
  const row = product as any;
  return [row.normalizedBrand ?? row.normalized_brand ?? '', row.modelCode ?? row.model_code ?? '', row.sizeNormalized ?? row.size_normalized ?? ''].join('|');
}
function hydrateProduct(row: Record<string, any>): NormalizedProduct {
  return {
    sourceName: row.source_name,
    sourceItemId: row.source_item_id,
    title: row.title,
    normalizedTitle: row.normalized_title,
    brand: row.brand,
    normalizedBrand: row.normalized_brand,
    modelCode: row.model_code,
    sizeLabel: row.size_label,
    sizeNormalized: row.size_normalized,
    colorLabel: row.color_label,
    colorNormalized: row.color_normalized,
    conditionLabel: row.condition_label,
    conditionRank: row.condition_rank,
    titleTokens: row.title_tokens ?? [],
    productFingerprint: row.product_fingerprint,
    priceYen: row.price_yen,
    itemUrl: row.item_url,
    rawRef: row.raw_ref ?? {},
  };
}
function findBestMercariCandidates(supplier: NormalizedProduct, mercariProducts: NormalizedProduct[]): NormalizedProduct[] {
  return mercariProducts.map((mercari) => ({ mercari, score: scoreProducts(supplier, mercari).score })).filter((entry) => entry.score >= 45).sort((a, b) => b.score - a.score).slice(0, 5).map((entry) => entry.mercari);
}
export async function runMatch(env: Env): Promise<Response> {
  const config = await getConfig(env);
  const [supplierRows, mercariRows, statRows] = await Promise.all([fetchRecentSupplierProducts(env), fetchRecentMercariProducts(env), fetchMarketStatsMap(env)]);
  const suppliers = supplierRows.map(hydrateProduct);
  const mercariProducts = mercariRows.map(hydrateProduct);
  const statsIndex = buildStatsIndex(statRows);
  const matchedOn = new Date().toISOString().slice(0, 10);
  const candidates: CandidateMatch[] = [];
  for (const supplier of suppliers) {
    const bestMercari = findBestMercariCandidates(supplier, mercariProducts);
    for (const mercari of bestMercari) {
      const stat = statsIndex.get(productKey(mercari));
      if (!stat) continue;
      const candidate = buildCandidateMatch({ supplier, mercari, mercariMedianPriceYen: stat.median_price_yen, mercariSoldCount30d: stat.sold_count, feeRate: config.marketplaceFeeRate, shippingCostYen: config.defaultShippingCostYen, matchedOn });
      if (candidate.matchScore < 45) continue;
      if (candidate.expectedGrossMarginYen <= 0) continue;
      candidates.push(candidate);
    }
  }
  await upsertMatchCandidates(env, candidates);
  return Response.json({ ok: true, job: 'match', supplierCount: suppliers.length, mercariCount: mercariProducts.length, candidateCount: candidates.length });
}
