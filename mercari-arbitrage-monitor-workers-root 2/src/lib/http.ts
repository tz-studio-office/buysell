import type { AppConfig } from '../config';
import { logError, logInfo } from './logger';

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchText(url: string, config: AppConfig, init?: RequestInit): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= config.httpRetryCount; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.httpTimeoutMs);
    try {
      const headers = new Headers(init?.headers);
      if (!headers.has('user-agent')) {
        headers.set('user-agent', 'Mozilla/5.0 (compatible; MercariArbitrageMonitor/0.1; +https://example.invalid)');
      }
      if (!headers.has('accept-language')) {
        headers.set('accept-language', 'ja,en;q=0.8');
      }

      const response = await fetch(url, {
        ...init,
        redirect: 'follow',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error as Error;
      logError('fetchText failed', { url, attempt, error: lastError.message });
      if (attempt < config.httpRetryCount) {
        await delay(750 * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  logInfo('fetchText exhausted retries', { url });
  throw lastError ?? new Error(`Unknown fetch error for ${url}`);
}
