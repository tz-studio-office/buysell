import type { NormalizedProduct, RawListing } from '../types/index';

const brandAliases: Record<string, string> = {
  nike: 'nike',
  ナイキ: 'nike',
  'the north face': 'the north face',
  ノースフェイス: 'the north face',
  unitedarrows: 'united arrows',
  'united arrows': 'united arrows',
  ユナイテッドアローズ: 'united arrows',
};

const sizeAliases: Record<string, string> = {
  xs: 'xs',
  s: 's',
  m: 'm',
  l: 'l',
  xl: 'xl',
  xxl: 'xxl',
  '2xl': 'xxl',
  '3xl': 'xxxl',
  free: 'free',
  フリー: 'free',
};

const colorAliases: Record<string, string> = {
  black: 'black',
  ブラック: 'black',
  white: 'white',
  ホワイト: 'white',
  gray: 'gray',
  grey: 'gray',
  グレー: 'gray',
  navy: 'navy',
  ネイビー: 'navy',
  beige: 'beige',
  ベージュ: 'beige',
};

const stopWords = new Set([
  '',
  '送料無料',
  '中古',
  '美品',
  'used',
  'mens',
  'ladies',
  'women',
  'men',
  'サイズ',
  'カラー',
  '色',
  'brand',
  'item',
  '商品',
]);

export function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[“”"'`´]+/g, '')
    .replace(/[｜|/\\]+/g, ' ')
    .replace(/[()\[\]{}<>【】「」]/g, ' ')
    .trim();
}

export function normalizeBrand(value: string | null | undefined): string | null {
  const cleaned = cleanText(value).toLowerCase();
  if (!cleaned) return null;
  return brandAliases[cleaned] ?? cleaned;
}

export function extractModelCode(value: string | null | undefined): string | null {
  const cleaned = cleanText(value).toUpperCase();
  if (!cleaned) return null;
  const match = cleaned.match(/\b([A-Z0-9]{4,}(?:[-_/][A-Z0-9]+)*)\b/);
  return match?.[1] ?? null;
}

export function normalizeSize(value: string | null | undefined): string | null {
  const cleaned = cleanText(value).toLowerCase();
  if (!cleaned) return null;
  return sizeAliases[cleaned] ?? cleaned;
}

export function normalizeColor(value: string | null | undefined): string | null {
  const cleaned = cleanText(value).toLowerCase();
  if (!cleaned) return null;
  return colorAliases[cleaned] ?? cleaned;
}

export function normalizeTitle(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeTitle(value: string): string[] {
  return normalizeTitle(value)
    .split(' ')
    .filter((token) => !stopWords.has(token) && token.length >= 2);
}

export function buildFingerprint(input: {
  brand?: string | null;
  modelCode?: string | null;
  titleTokens: string[];
  sizeNormalized?: string | null;
  colorNormalized?: string | null;
}): string {
  return [
    input.brand ?? '',
    input.modelCode ?? '',
    input.sizeNormalized ?? '',
    input.colorNormalized ?? '',
    input.titleTokens.slice(0, 6).join('_'),
  ].join('|');
}

export function normalizeConditionRank(conditionLabel?: string | null, existing?: number | null): number | null {
  if (existing != null) return existing;
  const label = cleanText(conditionLabel).toLowerCase();
  if (!label) return null;
  if (/(新品|未使用|n|s|mint)/.test(label)) return 5;
  if (/(美品|a)/.test(label)) return 4;
  if (/(良好|b)/.test(label)) return 3;
  if (/(使用感|c)/.test(label)) return 2;
  if (/(難あり|d|ジャンク)/.test(label)) return 1;
  return null;
}

export function normalizeListing(listing: RawListing): NormalizedProduct {
  const normalizedBrand = normalizeBrand(listing.brand ?? null);
  const modelCode = extractModelCode(listing.modelCode ?? listing.title);
  const sizeNormalized = normalizeSize(listing.sizeLabel ?? null);
  const colorNormalized = normalizeColor(listing.colorLabel ?? null);
  const normalizedTitle = normalizeTitle(listing.title);
  const titleTokens = tokenizeTitle(listing.title);
  const conditionRank = normalizeConditionRank(listing.conditionLabel, listing.conditionRank ?? null);

  return {
    sourceName: listing.sourceName,
    sourceItemId: listing.sourceItemId,
    title: listing.title,
    normalizedTitle,
    brand: listing.brand ?? null,
    normalizedBrand,
    modelCode,
    sizeLabel: listing.sizeLabel ?? null,
    sizeNormalized,
    colorLabel: listing.colorLabel ?? null,
    colorNormalized,
    conditionLabel: listing.conditionLabel ?? null,
    conditionRank,
    titleTokens,
    productFingerprint: buildFingerprint({
      brand: normalizedBrand,
      modelCode,
      titleTokens,
      sizeNormalized,
      colorNormalized,
    }),
    priceYen: listing.priceYen,
    itemUrl: listing.itemUrl,
    rawRef: {
      categoryKey: listing.categoryKey,
      categoryLabel: listing.categoryLabel,
      rawPayload: listing.rawPayload ?? {},
    },
  };
}
