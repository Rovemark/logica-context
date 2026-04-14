/**
 * Logica Context — Utility functions
 * Clean room implementation. MIT License.
 */

import { IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';

/**
 * Converts raw HTML to clean markdown text.
 * Strips tags, decodes entities, normalizes whitespace.
 * No external dependencies — pure string processing.
 */
export function htmlToMarkdown(html: string): string {
  let text = html;

  // Remove script and style blocks entirely
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Block-level elements → newlines
  text = text.replace(/<\/?(?:div|p|section|article|aside|header|footer|nav|main|figure|figcaption|details|summary)[^>]*>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Headings
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');
  text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n');
  text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n');

  // Lists
  text = text.replace(/<li[^>]*>/gi, '- ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');

  // Links: [text](url)
  text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Bold / italic
  text = text.replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**');
  text = text.replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '*$1*');

  // Code
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  text = text.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '\n```\n$1\n```\n');

  // Blockquotes
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    return content.trim().split('\n').map((l: string) => `> ${l}`).join('\n');
  });

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = decodeEntities(text);

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Decode common HTML entities
 */
function decodeEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&apos;': "'",
    '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–',
    '&hellip;': '…', '&copy;': '©', '&reg;': '®',
    '&trade;': '™', '&laquo;': '«', '&raquo;': '»',
  };
  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replaceAll(entity, char);
  }
  // Numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  return result;
}

/**
 * Fetches a URL and returns the body as string.
 * Pure Node.js — no external fetch library.
 * Follows redirects (up to 5).
 */
export function fetchUrl(url: string, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const parsed = new URL(url);
    const requester = parsed.protocol === 'https:' ? httpsRequest : httpRequest;

    const req = requester(url, {
      headers: {
        'User-Agent': 'logica-context/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    }, (res: IncomingMessage) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        fetchUrl(redirectUrl, maxRedirects - 1).then(resolve, reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

/**
 * Truncates text to a max length, preserving word boundaries.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.8 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

/**
 * Generates a unique ID for documents.
 */
export function generateId(): string {
  return `lctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Estimates token count (rough approximation: ~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Safe JSON parse with fallback.
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
