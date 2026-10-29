/**
 * Server-safe Markdown to HTML generator.
 * Zero external dependencies.
 * Enforces:
 * 1. Zero raw HTML execution (all input HTML tags are escaped).
 * 2. Strict URL sanitization via protocol whitelist (https, http, mailto, relative, anchor).
 * 3. Neutralization of unsafe protocols (javascript:, data:, vbscript:, blob:, file:) into non-clickable struck-through text.
 */

const SAFE_URL_PATTERN = /^(https?:\/\/|mailto:|\/|#)/i;

export function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^(javascript|vbscript|data|blob|file):/i.test(trimmed)) {
    return null;
  }
  if (SAFE_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMarkdownToSafeHtml(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inList = false;
  let inOrderedList = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Code blocks
    if (rawLine.startsWith('```')) {
      if (inCodeBlock) {
        const langClass = codeBlockLang ? ` class="language-${escapeHtml(codeBlockLang)}"` : '';
        output.push(
          `<pre class="my-5 p-4 rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 overflow-x-auto text-sm font-mono"><code${langClass}>${escapeHtml(
            codeBlockContent.join('\n')
          )}</code></pre>`
        );
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = '';
      } else {
        if (inList) { output.push('</ul>'); inList = false; }
        if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
        inCodeBlock = true;
        codeBlockLang = rawLine.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();

    // Blank line
    if (!trimmed) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      continue;
    }

    // Horizontal rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      output.push('<hr class="my-8 border-t border-gray-200" />');
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      const level = headingMatch[1].length;
      const text = renderInlineMarkdown(headingMatch[2]);
      const classes: Record<number, string> = {
        1: 'text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-10 mb-4 pb-2 border-b border-gray-200',
        2: 'text-2xl font-semibold text-gray-900 tracking-tight mt-8 mb-3',
        3: 'text-xl font-medium text-gray-900 tracking-tight mt-6 mb-2',
        4: 'text-lg font-medium text-gray-800 mt-4 mb-2',
        5: 'text-base font-semibold text-gray-800 mt-3 mb-1',
        6: 'text-sm font-semibold text-gray-700 uppercase tracking-wider mt-3 mb-1',
      };
      output.push(`<h${level} class="${classes[level] || ''}">${text}</h${level}>`);
      continue;
    }

    // Unordered lists (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }
      if (!inList) {
        output.push('<ul class="list-disc pl-6 my-4 space-y-1 text-gray-700 leading-relaxed">');
        inList = true;
      }
      output.push(`<li>${renderInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    // Ordered lists (1., 2., etc.)
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (inList) { output.push('</ul>'); inList = false; }
      if (!inOrderedList) {
        output.push('<ol class="list-decimal pl-6 my-4 space-y-1 text-gray-700 leading-relaxed">');
        inOrderedList = true;
      }
      output.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    // Paragraph
    if (inList) { output.push('</ul>'); inList = false; }
    if (inOrderedList) { output.push('</ol>'); inOrderedList = false; }

    output.push(`<p class="my-4 text-gray-700 leading-relaxed">${renderInlineMarkdown(trimmed)}</p>`);
  }

  if (inList) output.push('</ul>');
  if (inOrderedList) output.push('</ol>');
  if (inCodeBlock) {
    output.push(
      `<pre class="my-5 p-4 rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 overflow-x-auto text-sm font-mono"><code>${escapeHtml(
        codeBlockContent.join('\n')
      )}</code></pre>`
    );
  }

  return output.join('\n');
}

export function renderInlineMarkdown(text: string): string {
  // First escape raw HTML
  let escaped = escapeHtml(text);

  // Inline code `code`
  escaped = escaped.replace(/`([^`]+)`/g, (_m, code) => {
    return `<code class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-sm font-mono border border-gray-200">${code}</code>`;
  });

  // Images ![alt](url)
  escaped = escaped.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) {
      return `<span class="line-through decoration-rose-500/50 text-gray-400">[Blocked image: ${alt}]</span>`;
    }
    return `<img src="${safeUrl}" alt="${alt}" class="rounded-lg max-w-full my-4 border border-gray-200" />`;
  });

  // Links [text](url)
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, linkText, url) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) {
      return `<span class="line-through decoration-rose-500/50 text-gray-400" title="Blocked unsafe link">${linkText}</span>`;
    }
    return `<a href="${safeUrl}" class="text-blue-600 hover:text-blue-800 underline decoration-blue-400 underline-offset-2 transition-colors" rel="noopener noreferrer">${linkText}</a>`;
  });

  // Bold **text** or __text__
  escaped = escaped.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

  // Italic *text* or _text_
  escaped = escaped.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

  // Strikethrough ~~text~~
  escaped = escaped.replace(/~~(.*?)~~/g, '<del class="line-through text-gray-400">$1</del>');

  return escaped;
}
