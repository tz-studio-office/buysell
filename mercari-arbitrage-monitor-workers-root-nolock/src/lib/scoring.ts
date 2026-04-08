import type { CandidateMatch, NormalizedProduct, ScoreResult } from '../types/index';

export function intersectionRatio(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) overlap += 1;
  }
  return overlap / Math.max(setA.size, setB.size);
}

export function scoreProducts(supplier: NormalizedProduct, mercari: NormalizedProduct): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const breakdown: Record<string, number> = {};

  if (supplier.normalizedBrand && supplier.normalizedBrand === mercari.normalizedBrand) {
    score += 25;
    reasons.push('brand_match');
    breakdown.brand = 25;
  }

  if (supplier.modelCode && mercari.modelCode && supplier.modelCode === mercari.modelCode) {
    score += 35;
    reasons.push('model_code_match');
    breakdown.model = 35;
  }

  const titleOverlap = intersectionRatio(supplier.titleTokens, mercari.titleTokens);
  const titleScore = Math.round(titleOverlap * 25);
  score += titleScore;
  breakdown.title = titleScore;
  if (titleScore >= 12) reasons.push('title_overlap');

  if (supplier.sizeNormalized && mercari.sizeNormalized && supplier.sizeNormalized === mercari.sizeNormalized) {
    score += 8;
    reasons.push('size_match');
    breakdown.size = 8;
  }

  if (supplier.colorNormalized && mercari.colorNormalized && supplier.colorNormalized === mercari.colorNormalized) {
    score += 4;
    reasons.push('color_match');
    breakdown.color = 4;
  }

  if (supplier.conditionRank != null && mercari.conditionRank != null) {
    const diff = Math.abs(supplier.conditionRank - mercari.conditionRank);
    const conditionScore = diff === 0 ? 3 : diff === 1 ? 1 : 0;
    score += conditionScore;
    breakdown.condition = conditionScore;
    if (conditionScore > 0) reasons.push('condition_near');
  }

  return { score: Math.min(score, 100), reasons, breakdown };
}

export function buildCandidateMatch(params: {
  supplier: NormalizedProduct;
  mercari: NormalizedProduct;
  mercariMedianPriceYen: number;
  mercariSoldCount30d: number;
  feeRate: number;
  shippingCostYen: number;
  matchedOn: string;
}): CandidateMatch {
  const score = scoreProducts(params.supplier, params.mercari);
  const expectedGrossMarginYen = Math.round(
    params.mercariMedianPriceYen -
      params.supplier.priceYen -
      params.mercariMedianPriceYen * params.feeRate -
      params.shippingCostYen,
  );

  const expectedMarginRate = params.mercariMedianPriceYen > 0
    ? expectedGrossMarginYen / params.mercariMedianPriceYen
    : 0;

  return {
    supplierSourceName: params.supplier.sourceName as CandidateMatch['supplierSourceName'],
    supplierSourceItemId: params.supplier.sourceItemId,
    mercariSourceItemId: params.mercari.sourceItemId,
    matchedOn: params.matchedOn,
    matchScore: score.score,
    basis: {
      reasons: score.reasons,
      breakdown: score.breakdown,
      supplierFingerprint: params.supplier.productFingerprint,
      mercariFingerprint: params.mercari.productFingerprint,
    },
    supplierPriceYen: params.supplier.priceYen,
    mercariMedianPriceYen: params.mercariMedianPriceYen,
    mercariSoldCount30d: params.mercariSoldCount30d,
    expectedGrossMarginYen,
    expectedMarginRate,
  };
}
