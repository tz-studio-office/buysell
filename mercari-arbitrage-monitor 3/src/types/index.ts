export type SourceName = 'mercari' | 'secondstreet' | 'buzzstore' | 'offmoll';
export type TargetType = 'mercari_category' | 'supplier_seed';

export interface Env {
  APP_NAME?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RUN_TOKEN: string;
  MERCARI_MAX_PAGES_PER_CATEGORY?: string;
  SUPPLIER_MAX_PAGES_PER_SOURCE?: string;
  HTTP_TIMEOUT_MS?: string;
  HTTP_RETRY_COUNT?: string;
  ENABLE_DETAIL_ENRICHMENT?: string;
  MARKETPLACE_FEE_RATE?: string;
  DEFAULT_SHIPPING_COST_YEN?: string;
  RUN_MERCARI_CRON?: string;
  RUN_SUPPLIERS_CRON?: string;
  RUN_MATCH_CRON?: string;
}

export interface MercariCategoryConfig {
  id?: string;
  key: string;
  label: string;
  categoryId?: string;
  keyword?: string;
  maxPages?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SupplierSourceConfig {
  id?: string;
  source: Exclude<SourceName, 'mercari'>;
  label: string;
  seedUrls: string[];
  maxPages?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface RuntimeSettings {
  mercariMaxPages: number;
  supplierMaxPages: number;
  httpTimeoutMs: number;
  httpRetryCount: number;
  enableDetailEnrichment: boolean;
  marketplaceFeeRate: number;
  defaultShippingCostYen: number;
  runMercariCron: string;
  runSuppliersCron: string;
  runMatchCron: string;
}

export interface CrawlTargetRow {
  id: string;
  targetType: TargetType;
  sourceName: SourceName;
  targetKey: string;
  label: string;
  categoryId?: string | null;
  keyword?: string | null;
  seedUrl?: string | null;
  maxPages?: number | null;
  sortOrder: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrawlRun {
  jobName: string;
  sourceName: SourceName;
  url?: string;
  page?: number;
  status: 'started' | 'success' | 'error';
  resultCount?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface RawListing {
  sourceName: SourceName;
  sourceItemId: string;
  title: string;
  brand?: string | null;
  modelCode?: string | null;
  sizeLabel?: string | null;
  colorLabel?: string | null;
  conditionLabel?: string | null;
  conditionRank?: number | null;
  categoryKey?: string | null;
  categoryLabel?: string | null;
  priceYen: number;
  shippingFeeBurden?: string | null;
  availabilityStatus?: string | null;
  storeName?: string | null;
  itemUrl: string;
  imageUrl?: string | null;
  soldDetectedAt?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  isActive?: boolean;
  rawPayload?: Record<string, unknown>;
}

export interface NormalizedProduct {
  sourceName: SourceName;
  sourceItemId: string;
  title: string;
  normalizedTitle: string;
  brand?: string | null;
  normalizedBrand?: string | null;
  modelCode?: string | null;
  sizeLabel?: string | null;
  sizeNormalized?: string | null;
  colorLabel?: string | null;
  colorNormalized?: string | null;
  conditionLabel?: string | null;
  conditionRank?: number | null;
  titleTokens: string[];
  productFingerprint: string;
  priceYen: number;
  itemUrl: string;
  rawRef?: Record<string, unknown>;
}

export interface MarketStat {
  asOfDate: string;
  categoryKey?: string | null;
  categoryLabel?: string | null;
  normalizedBrand?: string | null;
  modelCode?: string | null;
  sizeNormalized?: string | null;
  soldCount: number;
  medianPriceYen: number;
  avgPriceYen: number;
  minPriceYen: number;
  maxPriceYen: number;
  p25PriceYen: number;
  p75PriceYen: number;
  latestSoldAt?: string | null;
}

export interface CandidateMatch {
  supplierSourceName: Exclude<SourceName, 'mercari'>;
  supplierSourceItemId: string;
  mercariSourceItemId: string;
  matchedOn: string;
  matchScore: number;
  basis: Record<string, unknown>;
  supplierPriceYen: number;
  mercariMedianPriceYen: number;
  mercariSoldCount30d: number;
  expectedGrossMarginYen: number;
  expectedMarginRate: number;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
}
