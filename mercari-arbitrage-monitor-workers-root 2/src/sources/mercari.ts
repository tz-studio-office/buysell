import type { MercariCategoryConfig, RawListing } from '../types/index';
import type { AppConfig } from '../config';
import { absoluteUrl, extractPriceYen, firstAttr, firstText, parseHtml, textContent } from '../lib/dom';
import { extractModelCode } from '../lib/normalizers';
import { fetchText } from '../lib/http';

function appendOrReplacePage(urlText: string, page: number): string {
  if (urlText.includes('{page}')) return urlText.replace('{page}', String(page));
  const url = new URL(urlText);
  url.searchParams.set('page', String(page));
  return url.toString();
}

function buildMercariUrl(scope: MercariCategoryConfig, page: number): string {
  if (scope.seedUrl) return appendOrReplacePage(scope.seedUrl, page);
  const url = new URL('https://jp.mercari.com/search');
  url.searchParams.set('status', 'sold_out');
  url.searchParams.set('sort', 'created_time');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('page', String(page));
  if (scope.categoryId) url.searchParams.set('category_id', scope.categoryId);
  if (scope.keyword) url.searchParams.set('keyword', scope.keyword);
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

function parseCard(baseUrl: string, card: Element, scope: MercariCategoryConfig): RawListing | null {
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
    categoryKey: scope.key,
    categoryLabel: scope.label,
    priceYen,
    conditionLabel,
    itemUrl,
    imageUrl,
    soldDetectedAt: new Date().toISOString(),
    rawPayload: {
      snippet: textContent(card).slice(0, 300),
      collectionMode: scope.seedUrl ? 'list_url' : 'search_builder',
      scopeMetadata: scope.metadata ?? {},
    },
  };
}

export async function fetchMercariSoldItems(
  config: AppConfig,
  scope: MercariCategoryConfig,
  page: number,
): Promise<{ url: string; listings: RawListing[] }> {
  const url = buildMercariUrl(scope, page);
  const html = await fetchText(url, config);
  const document = parseHtml(html);
  const cards = extractCards(document);
  const listings = cards
    .map((card) => parseCard(url, card, scope))
    .filter((item): item is RawListing => item !== null);

  return { url, listings };
}
