/**
 * Link Preview Service
 * Extracts Open Graph metadata from URLs for rich link previews
 */

import { logger } from '../../shared/logger';

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

/**
 * Extract link preview metadata from a URL
 * Uses simple fetch and regex parsing (no external dependencies needed)
 */
export async function extractLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    // Fetch HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RelayChatBot/1.0)',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      logger.warn('Failed to fetch URL for preview', { url, status: response.status });
      return null;
    }

    const html = await response.text();

    // Extract Open Graph and meta tags
    const preview: LinkPreview = {
      url,
      title:
        extractMetaTag(html, 'og:title') ||
        extractMetaTag(html, 'twitter:title') ||
        extractTitle(html),
      description:
        extractMetaTag(html, 'og:description') ||
        extractMetaTag(html, 'twitter:description') ||
        extractMetaTag(html, 'description'),
      image: extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image'),
      siteName: extractMetaTag(html, 'og:site_name'),
      favicon: extractFavicon(html, urlObj.origin),
    };

    // Make image URLs absolute
    if (preview.image && !preview.image.startsWith('http')) {
      preview.image = new URL(preview.image, urlObj.origin).href;
    }

    logger.info('Link preview extracted', { url, hasImage: !!preview.image });
    return preview;
  } catch (error: any) {
    logger.error('Link preview extraction failed', { url, error: error.message });
    return null;
  }
}

/**
 * Extract meta tag content from HTML
 */
function extractMetaTag(html: string, property: string): string | undefined {
  // Try Open Graph format
  const ogRegex = new RegExp(
    `<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`,
    'i'
  );
  const ogMatch = html.match(ogRegex);
  if (ogMatch) return ogMatch[1];

  // Try name format
  const nameRegex = new RegExp(
    `<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`,
    'i'
  );
  const nameMatch = html.match(nameRegex);
  if (nameMatch) return nameMatch[1];

  // Try reversed order
  const revRegex = new RegExp(
    `<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["']${property}["']`,
    'i'
  );
  const revMatch = html.match(revRegex);
  if (revMatch) return revMatch[1];

  return undefined;
}

/**
 * Extract page title from HTML
 */
function extractTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : undefined;
}

/**
 * Extract favicon from HTML
 */
function extractFavicon(html: string, origin: string): string | undefined {
  const iconMatch = html.match(
    /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i
  );
  if (iconMatch) {
    const href = iconMatch[1];
    return href.startsWith('http') ? href : new URL(href, origin).href;
  }
  // Fallback to default favicon
  return `${origin}/favicon.ico`;
}

/**
 * Extract URLs from message content
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"]+/gi;
  const matches = text.match(urlRegex);
  return matches || [];
}

/**
 * Process message and extract link previews for all URLs
 */
export async function processMessageForPreviews(content: string): Promise<LinkPreview[]> {
  const urls = extractUrls(content);
  if (urls.length === 0) return [];

  // Limit to first 3 URLs to avoid abuse
  const limitedUrls = urls.slice(0, 3);

  const previews = await Promise.all(limitedUrls.map((url) => extractLinkPreview(url)));

  return previews.filter((p): p is LinkPreview => p !== null);
}
