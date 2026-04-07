import { describe, expect, it } from 'vitest';
import { normalizeBrand, normalizeListing, tokenizeTitle } from '../lib/normalizers';

describe('normalizers', () => {
  it('normalizes brand aliases', () => {
    expect(normalizeBrand('ナイキ')).toBe('nike');
    expect(normalizeBrand('UNITED ARROWS')).toBe('united arrows');
  });

  it('tokenizes titles', () => {
    expect(tokenizeTitle('NIKE ナイキ AIR MAX 95 ブラック 27cm')).toContain('air');
  });

  it('builds normalized listing', () => {
    const listing = normalizeListing({
      sourceName: 'mercari',
      sourceItemId: 'm123',
      title: 'NIKE AIR MAX 95 ブラック 27cm',
      brand: 'ナイキ',
      modelCode: 'CZ1234-001',
      sizeLabel: '27cm',
      colorLabel: 'ブラック',
      conditionLabel: '美品',
      priceYen: 12000,
      itemUrl: 'https://jp.mercari.com/item/m123',
    });

    expect(listing.normalizedBrand).toBe('nike');
    expect(listing.modelCode).toBe('CZ1234-001');
    expect(listing.colorNormalized).toBe('black');
    expect(listing.titleTokens.length).toBeGreaterThan(0);
  });
});
