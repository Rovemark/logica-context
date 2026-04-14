// fetcher.ts — Fetch URL, convert HTML to markdown, return clean text

export async function fetchAndConvert(url: string): Promise<{ content: string; title: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LogicaContext/1.0 (MCP Server)',
      Accept: 'text/html,application/xhtml+xml,text/plain,application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (contentType.includes('application/json')) {
    return { content: JSON.stringify(JSON.parse(text), null, 2), title: url };
  }

  if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
    return { content: text, title: url };
  }

  // HTML → simplified markdown
  return { content: htmlToMarkdown(text), title: extractTitle(text) || url };
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

function htmlToMarkdown(html: string): string {
  let text = html;

  // Remove script, style, nav, footer
  text = text.replace(/<(script|style|nav|footer|header|aside|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Convert headers
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
    return '\n' + '#'.repeat(Number(level)) + ' ' + stripTags(content).trim() + '\n';
  });

  // Convert paragraphs
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => '\n' + stripTags(content).trim() + '\n');

  // Convert list items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => '- ' + stripTags(content).trim() + '\n');

  // Convert links
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => {
    const label = stripTags(content).trim();
    return label ? `[${label}](${href})` : '';
  });

  // Convert code blocks
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, content) => '\n```\n' + stripTags(content).trim() + '\n```\n');
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, content) => '`' + stripTags(content).trim() + '`');

  // Convert bold/italic
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, content) => '**' + stripTags(content).trim() + '**');
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, content) => '*' + stripTags(content).trim() + '*');

  // Strip remaining tags
  text = stripTags(text);

  // Clean whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
