import type { RawListing } from '../types/index';
import type { AppConfig } from '../config';
import { absoluteUrl, extractPriceYen, firstAttr, firstText, parseHtml, textContent } from '../lib/dom';
import { extractModelCode } from '../lib/normalizers';
import { fetchText } from '../lib/http';

function buildPageUrl(seedUrl: string, page: number): string {
  return seedUrl.includes('{page}') ? seedUrl.replace('{page}', String(page)) : `${seedUrl}${seedUrl.includes('?') ? '&' : '?'}paged=${page}`;
}

function getId(url: string): string | null {
  const match = url.match(/\/archives\/([^/?#]+)/) ?? url.match(/\/item\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function parseCard(baseUrl: string, node: Element): RawListing | null {
  const itemUrl = absoluteUrl(baseUrl, node.getAttribute('href'));
  if (!itemUrl) return null;
  const sourceItemId = getId(itemUrl);
  if (!sourceItemId) return null;

  const text = textContent(node);
  const title = firstText(node, ['h2', 'h3', 'p']) || text.split('¥')[0]?.trim();
  const priceYen = extractPriceYen(text);
  if (!title || !priceYen) return null;

  return {
    sourceName: 'buzzstore',
    sourceItemId,
    title,
    priceYen,
    itemUrl,
    imageUrl: firstAttr(node, [{ selector: 'img', attr: 'src' }]) || null,
    brand: firstText(node, ['.brand', '[class*=brand]']) || null,
    sizeLabel: text.match(/サイズ[:：]?\s*([A-Z0-9]+)/i)?.[1] ?? null,
    conditionLabel: text.match(/状態[:：]?\s*([^\s]+)/)?.[1] ?? null,
    modelCode: extractModelCode(text),
    availabilityStatus: 'active',
    storeName: firstText(node, ['.store', '[class*=shop]']) || null,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    isActive: true,
    rawPayload: { snippet: text.slice(0, 300) },
  };
}

export async function fetchBuzzstorePage(config: AppConfig, seedUrl: string, page: number) {
  const url = buildPageUrl(seedUrl, page);
  const html = await fetchText(url, config);
  const document = parseHtml(html);
  const anchors = Array.from(document.querySelectorAll('a')).filter((anchor) => /(archives|\/item\/)/.test(anchor.getAttribute('href') ?? ''));
  const listings = anchors.map((anchor) => parseCard(url, anchor)).filter((item): item is RawListing => item !== null);
  return { url, listings };
}
