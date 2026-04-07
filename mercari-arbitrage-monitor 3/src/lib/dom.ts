import { DOMParser } from 'linkedom';

export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function absoluteUrl(baseUrl: string, href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function textContent(node: Element | null | undefined): string {
  return node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function firstText(doc: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const value = textContent(doc.querySelector(selector));
    if (value) return value;
  }
  return '';
}

export function firstAttr(doc: ParentNode, selectors: Array<{ selector: string; attr: string }>): string {
  for (const entry of selectors) {
    const value = doc.querySelector(entry.selector)?.getAttribute(entry.attr)?.trim();
    if (value) return value;
  }
  return '';
}

export function extractPriceYen(value: string): number {
  const match = value.replace(/,/g, '').match(/([0-9]{2,})/);
  return match ? Number(match[1]) : 0;
}
