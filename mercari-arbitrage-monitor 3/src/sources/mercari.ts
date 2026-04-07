import type { MercariCategoryConfig, RawListing } from '../types/index';
import type { AppConfig } from '../config';
import { absoluteUrl, extractPriceYen, firstAttr, firstText, parseHtml, textContent } from '../lib/dom';
import { extractModelCode } from '../lib/normalizers';
import { fetchText } from '../lib/http';

function buildMercariUrl(category: MercariCategoryConfig, page: number): string {
  const url = new URL('https://jp.mercari.com/search');
  url.searchParams.set('status', 'sold_out');
  url.searchParams.set('sort', 'created_time');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('page', String(page));
  if (category.categoryId) url.searchParams.set('category_id', category.categoryId);
  if (category.keyword) url.searchParams.set('keyword', category.keyword);
  return url.toString();
}

function getMercariIdFromUrl(itemUrl: string): string | null {
  const match = itemUrl.match(/\/item\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function extractCards(document: Document): Element[] {
  const anchors = Array.from(document.querySelectorAll('a'));
  return anchors.filter((anchor) => /\/item\//.test(anchor.getAttribute('href') ?? ''));
}

function parseCard(baseUrl: string, card: Element, category: MercariCategoryConfig): RawListing | null {
  const itemUrl = absoluteUrl(baseUrl, card.getAttribute('href'));
  if (!itemUrl) return null;

  const sourceItemId = getMercariIdFromUrl(itemUrl);
  if (!sourceItemId) return null;

  const title = firstAttr(card, [
    { selector: 'img', attr: 'alt' },
    { selector: '[alt]', attr: 'alt' },
  ]) || firstText(card, ['h3', 'p', 'span']);

  const priceText = textContent(card).match(/¥\s?[\d,]+/)?.[0] ?? '';
  const priceYen = extractPriceYen(priceText);
  if (!title || !priceYen) return null;

  const imageUrl = firstAttr(card, [{ selector: 'img', attr: 'src' }]) || null;
  const conditionLabel = /新品|未使用/.test(textContent(card)) ? '新品・未使用' : null;

  return {
    sourceName: 'mercari',
    sourceItemId,
    title,
    modelCode: extractModelCode(title),
    categoryKey: category.key,
    categoryLabel: category.label,
    priceYen,
    conditionLabel,
    itemUrl,
    imageUrl,
    soldDetectedAt: new Date().toISOString(),
    rawPayload: {
      snippet: textContent(card).slice(0, 300),
    },
  };
}

export async function fetchMercariSoldItems(
  config: AppConfig,
  category: MercariCategoryConfig,
  page: number,
): Promise<{ url: string; listings: RawListing[] }> {
  const url = buildMercariUrl(category, page);
  const html = await fetchText(url, config);
  const document = parseHtml(html);
  const cards = extractCards(document);
  const listings = cards
    .map((card) => parseCard(url, card, category))
    .filter((item): item is RawListing => item !== null);

  return { url, listings };
}
