'use client';

import React, { useState, useId } from 'react';
import { Copy, Check, ExternalLink, CheckSquare, Square } from 'lucide-react';

interface MarkdownRendererProps {
  content?: string | null;
  className?: string;
  compact?: boolean;
  variant?: 'default' | 'document';
}

// ---------------------------------------------------------------------------
// Security & URL Validation
// ---------------------------------------------------------------------------
const SAFE_URL_PATTERN = /^(https?:\/\/|mailto:|\/|#)/i;

export function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Strictly reject javascript:, data:, vbscript:, file:, etc.
  if (/^(javascript|vbscript|data|blob|file):/i.test(trimmed)) {
    return null;
  }
  if (SAFE_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lightweight Code Syntax Tokenizer
// ---------------------------------------------------------------------------
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'class', 'return', 'import', 'export',
  'from', 'default', 'if', 'else', 'switch', 'case', 'for', 'while', 'do',
  'try', 'catch', 'finally', 'throw', 'new', 'typeof', 'instanceof', 'async',
  'await', 'def', 'self', 'lambda', 'yield', 'SELECT', 'FROM', 'WHERE',
  'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'CREATE', 'TABLE', 'public',
  'private', 'protected', 'static', 'void', 'int', 'string', 'bool',
  'boolean', 'null', 'undefined', 'true', 'false', 'type', 'interface',
  'package', 'func', 'go', 'struct', 'impl', 'fn', 'mut', 'pub', 'use',
]);

function highlightSyntax(code: string): React.ReactNode[] {
  // Simple regex-based syntax tokenization
  const tokenRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|[^\sA-Za-z_0-9]+|\s+)/gm;
  const tokens: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(code)) !== null) {
    const text = match[0];
    if (text.startsWith('//') || text.startsWith('/*') || (text.startsWith('#') && !text.startsWith('#include'))) {
      tokens.push(<span key={key++} className="text-zinc-500 italic">{text}</span>);
    } else if (text.startsWith('"') || text.startsWith("'") || text.startsWith('`')) {
      tokens.push(<span key={key++} className="text-emerald-400">{text}</span>);
    } else if (/^\d+(?:\.\d+)?$/.test(text)) {
      tokens.push(<span key={key++} className="text-amber-400">{text}</span>);
    } else if (KEYWORDS.has(text)) {
      tokens.push(<span key={key++} className="text-purple-400 font-semibold">{text}</span>);
    } else if (/^[A-Z][A-Za-z0-9_]*$/.test(text)) {
      tokens.push(<span key={key++} className="text-cyan-300">{text}</span>);
    } else {
      tokens.push(<span key={key++}>{text}</span>);
    }
  }

  return tokens.length > 0 ? tokens : [code];
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayLang = (language || 'text').toUpperCase();

  return (
    <div className="my-5 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800/80">
        <span className="font-mono text-[11px] font-bold text-zinc-400 tracking-wider">
          {displayLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed text-zinc-200">
        <code>{highlightSyntax(code)}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Markdown Parser: Bold, Italic, Strikethrough, Code, Links, Images
// ---------------------------------------------------------------------------
export function parseInlineMarkdown(text: string, baseKey: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Tokenizer pattern matching inline markdown tokens
  // Group 1: Image ![alt](url)
  // Group 2: Link [text](url)
  // Group 3: Inline code `code`
  // Group 4: Bold+Italic ***text*** or ___text___
  // Group 5: Bold **text** or __text__
  // Group 6: Italic *text* or _text_
  // Group 7: Strikethrough ~~text~~
  const inlineRegex = /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*\*([^*]+)\*\*\*|___([^_]+)___)|(\*\*([^*]+)\*\*|__([^_]+)__)|(\*([^*]+)\*|_([^_]+)_)|(~~([^~]+)~~)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      nodes.push(text.substring(lastIndex, matchIndex));
    }

    const key = `${baseKey}-inline-${counter++}`;

    if (match[1]) {
      // Image: ![alt](url)
      const alt = match[2];
      const url = sanitizeUrl(match[3]);
      if (url) {
        nodes.push(
          <img
            key={key}
            src={url}
            alt={alt || 'Project illustration'}
            className="my-3 rounded-lg max-w-full h-auto border border-zinc-800 object-cover"
            loading="lazy"
          />
        );
      } else {
        nodes.push(`[Image: ${alt || 'blocked'}]`);
      }
    } else if (match[4]) {
      // Link: [text](url)
      const linkText = match[5];
      const rawUrl = match[6];
      const safeHref = sanitizeUrl(rawUrl);

      if (safeHref) {
        const isExternal = /^https?:\/\//i.test(safeHref);
        nodes.push(
          <a
            key={key}
            href={safeHref}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="text-[#0057FF] hover:text-blue-400 underline underline-offset-2 transition-colors inline-flex items-center gap-0.5 font-medium"
          >
            <span>{parseInlineMarkdown(linkText, `${key}-nested`)}</span>
            {isExternal && <ExternalLink className="w-3 h-3 inline-block ml-0.5 opacity-70" />}
          </a>
        );
      } else {
        // Blocked unsafe URL scheme: render text safely without active link
        nodes.push(
          <span key={key} className="text-zinc-400 line-through decoration-rose-500/50" title="Link blocked for security">
            {linkText}
          </span>
        );
      }
    } else if (match[7]) {
      // Inline code: `code`
      nodes.push(
        <code
          key={key}
          className="font-mono text-xs sm:text-[13px] bg-zinc-800/90 text-cyan-300 px-1.5 py-0.5 rounded border border-zinc-700/60 break-all"
        >
          {match[8]}
        </code>
      );
    } else if (match[9]) {
      // Bold + Italic: ***text***
      const boldItalicContent = match[10] || match[11];
      nodes.push(
        <strong key={key} className="font-bold text-white">
          <em className="italic">{parseInlineMarkdown(boldItalicContent, `${key}-bi`)}</em>
        </strong>
      );
    } else if (match[12]) {
      // Bold: **text**
      const boldContent = match[13] || match[14];
      nodes.push(
        <strong key={key} className="font-bold text-white">
          {parseInlineMarkdown(boldContent, `${key}-b`)}
        </strong>
      );
    } else if (match[15]) {
      // Italic: *text*
      const italicContent = match[16] || match[17];
      nodes.push(
        <em key={key} className="italic text-zinc-200">
          {parseInlineMarkdown(italicContent, `${key}-i`)}
        </em>
      );
    } else if (match[18]) {
      // Strikethrough: ~~text~~
      nodes.push(
        <del key={key} className="line-through text-zinc-500">
          {parseInlineMarkdown(match[19], `${key}-del`)}
        </del>
      );
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

// ---------------------------------------------------------------------------
// GFM Table Parser
// ---------------------------------------------------------------------------
interface TableData {
  headers: string[];
  alignments: Array<'left' | 'center' | 'right'>;
  rows: string[][];
}

function parseTable(lines: string[]): TableData | null {
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] => {
    let clean = line.trim();
    if (clean.startsWith('|')) clean = clean.slice(1);
    if (clean.endsWith('|')) clean = clean.slice(0, -1);
    return clean.split('|').map((col) => col.trim());
  };

  const headers = parseRow(lines[0]);
  const delimiterLine = lines[1].trim();
  const delimiterCols = parseRow(delimiterLine);

  if (headers.length === 0 || delimiterCols.length === 0) return null;

  // Check if delimiter row is valid GFM separator (e.g. :---, :---:, ---:)
  const isSeparator = delimiterCols.every((col) => /^:?-+:?$/.test(col));
  if (!isSeparator) return null;

  const alignments = delimiterCols.map((col) => {
    const left = col.startsWith(':');
    const right = col.endsWith(':');
    if (left && right) return 'center' as const;
    if (right) return 'right' as const;
    return 'left' as const;
  });

  const rows = lines.slice(2).map((line) => {
    const row = parseRow(line);
    // Pad or trim row to match headers count
    while (row.length < headers.length) row.push('');
    return row.slice(0, headers.length);
  });

  return { headers, alignments, rows };
}

// ---------------------------------------------------------------------------
// Main Markdown Renderer Component
// ---------------------------------------------------------------------------
export function MarkdownRenderer({ content, className = '', compact = false, variant = 'default' }: MarkdownRendererProps) {
  const instanceId = useId();
  const isDoc = variant === 'document';

  if (!content || typeof content !== 'string' || !content.trim()) {
    return (
      <div className="text-zinc-500 italic text-sm">
        No project description provided.
      </div>
    );
  }

  const rawLines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let elementIndex = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Skip completely empty lines between blocks
    if (!trimmed) {
      i++;
      continue;
    }

    const key = `${instanceId}-block-${elementIndex++}`;

    // 2. Fenced Code Block: ```lang
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) {
        i++; // Consume closing ```
      }
      elements.push(
        <CodeBlock
          key={key}
          code={codeLines.join('\n')}
          language={language}
        />
      );
      continue;
    }

    // 3. Headings: # to ######
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const parsedHeading = parseInlineMarkdown(headingText, `${key}-h`);

      switch (level) {
        case 1:
          elements.push(
            <h1
              key={key}
              className={
                isDoc
                  ? 'text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mt-8 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2'
                  : 'text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mt-8 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2'
              }
            >
              {parsedHeading}
            </h1>
          );
          break;
        case 2:
          elements.push(
            <h2
              key={key}
              className={
                isDoc
                  ? 'text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white mt-7 mb-3 pb-1 border-b border-zinc-100 dark:border-zinc-800/60'
                  : 'text-xl sm:text-2xl font-bold uppercase tracking-tight text-zinc-900 dark:text-white mt-7 mb-3 pb-1 border-b border-zinc-200 dark:border-zinc-800/60'
              }
            >
              {parsedHeading}
            </h2>
          );
          break;
        case 3:
          elements.push(
            <h3
              key={key}
              className={
                isDoc
                  ? 'text-lg sm:text-xl font-medium text-zinc-900 dark:text-zinc-100 mt-6 mb-2.5'
                  : 'text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-2.5'
              }
            >
              {parsedHeading}
            </h3>
          );
          break;
        case 4:
          elements.push(
            <h4
              key={key}
              className={
                isDoc
                  ? 'text-base sm:text-lg font-medium text-zinc-800 dark:text-zinc-200 mt-5 mb-2'
                  : 'text-base sm:text-lg font-semibold text-zinc-800 dark:text-zinc-200 mt-5 mb-2'
              }
            >
              {parsedHeading}
            </h4>
          );
          break;
        case 5:
        case 6:
        default:
          elements.push(
            <h5
              key={key}
              className={
                isDoc
                  ? 'text-sm sm:text-base font-medium font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mt-4 mb-2'
                  : 'text-sm sm:text-base font-semibold font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mt-4 mb-2'
              }
            >
              {parsedHeading}
            </h5>
          );
          break;
      }
      i++;
      continue;
    }

    // 4. Horizontal Rule: ---, ***, ___
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      elements.push(
        <hr key={key} className="my-6 border-zinc-200 dark:border-zinc-800" />
      );
      i++;
      continue;
    }

    // 5. Blockquote: > text
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote
          key={key}
          className={
            isDoc
              ? 'my-4 border-l-4 border-[#0057FF] bg-blue-50/50 dark:bg-zinc-900/40 px-4 py-3 rounded-r-lg text-zinc-700 dark:text-zinc-300 italic space-y-1 text-sm sm:text-base'
              : 'my-4 border-l-4 border-[#0057FF] bg-zinc-100 dark:bg-zinc-900/40 px-4 py-3 rounded-r-lg text-zinc-700 dark:text-zinc-300 italic space-y-1 text-sm sm:text-base'
          }
        >
          {quoteLines.map((ql, idx) => (
            <p key={`${key}-q-${idx}`}>
              {parseInlineMarkdown(ql, `${key}-qp-${idx}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 6. GFM Tables: lines starting with | or having | separators
    if (trimmed.startsWith('|') && rawLines[i + 1]?.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|')) {
        tableLines.push(rawLines[i]);
        i++;
      }

      const tableData = parseTable(tableLines);
      if (tableData) {
        elements.push(
          <div
            key={key}
            className="my-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 shadow-xs"
          >
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
                  {tableData.headers.map((header, hIdx) => {
                    const align = tableData.alignments[hIdx] || 'left';
                    return (
                      <th
                        key={`${key}-th-${hIdx}`}
                        className={`px-4 py-3 font-mono font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider text-[11px] sm:text-xs text-${align}`}
                      >
                        {parseInlineMarkdown(header, `${key}-th-txt-${hIdx}`)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {tableData.rows.map((row, rIdx) => (
                  <tr
                    key={`${key}-tr-${rIdx}`}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors even:bg-zinc-50/40 dark:even:bg-zinc-950/30"
                  >
                    {row.map((cell, cIdx) => {
                      const align = tableData.alignments[cIdx] || 'left';
                      return (
                        <td
                          key={`${key}-td-${rIdx}-${cIdx}`}
                          className={`px-4 py-3 text-zinc-800 dark:text-zinc-300 text-${align}`}
                        >
                          {parseInlineMarkdown(cell, `${key}-td-txt-${rIdx}-${cIdx}`)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 7. Lists (Ordered, Unordered, Task lists, Nested)
    const isUnordered = /^(\*|-|\+)\s+(.+)$/.test(trimmed);
    const isOrdered = /^\d+\.\s+(.+)$/.test(trimmed);

    if (isUnordered || isOrdered) {
      const listItems: Array<{
        type: 'unordered' | 'ordered';
        indent: number;
        content: string;
        isTask?: boolean;
        checked?: boolean;
      }> = [];

      while (i < rawLines.length) {
        const curLine = rawLines[i];
        const curTrimmed = curLine.trim();
        if (!curTrimmed) break;

        const uMatch = curLine.match(/^(\s*)(\*|-|\+)\s+(.+)$/);
        const oMatch = curLine.match(/^(\s*)(\d+)\.\s+(.+)$/);

        if (uMatch) {
          const indent = uMatch[1].length;
          let itemContent = uMatch[3];
          let isTask = false;
          let checked = false;

          const taskMatch = itemContent.match(/^\[([ xX])\]\s+(.+)$/);
          if (taskMatch) {
            isTask = true;
            checked = taskMatch[1].toLowerCase() === 'x';
            itemContent = taskMatch[2];
          }

          listItems.push({
            type: 'unordered',
            indent,
            content: itemContent,
            isTask,
            checked,
          });
          i++;
        } else if (oMatch) {
          const indent = oMatch[1].length;
          listItems.push({
            type: 'ordered',
            indent,
            content: oMatch[3],
          });
          i++;
        } else {
          // If continuation line of previous item, append to it
          if (listItems.length > 0 && /^\s{2,}/.test(curLine)) {
            listItems[listItems.length - 1].content += ' ' + curTrimmed;
            i++;
          } else {
            break;
          }
        }
      }

      elements.push(
        <div key={key} className="my-3 space-y-1.5 pl-1">
          {listItems.map((item, lIdx) => {
            const padLeft = item.indent > 0 ? (item.indent > 2 ? 'pl-8' : 'pl-4') : 'pl-0';

            if (item.isTask) {
              return (
                <div
                  key={`${key}-task-${lIdx}`}
                  className={`flex items-start gap-2.5 text-sm sm:text-base leading-relaxed ${
                    isDoc ? 'text-zinc-800 dark:text-zinc-300' : 'text-zinc-300'
                  } ${padLeft}`}
                >
                  <span className="mt-1 text-zinc-400 select-none">
                    {item.checked ? (
                      <CheckSquare className="w-4 h-4 text-[#0057FF]" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-600" />
                    )}
                  </span>
                  <span className={item.checked ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}>
                    {parseInlineMarkdown(item.content, `${key}-task-txt-${lIdx}`)}
                  </span>
                </div>
              );
            }

            if (item.type === 'ordered') {
              return (
                <div
                  key={`${key}-ol-${lIdx}`}
                  className={`flex items-start gap-2 text-sm sm:text-base leading-relaxed ${
                    isDoc ? 'text-zinc-800 dark:text-zinc-300' : 'text-zinc-300'
                  } ${padLeft}`}
                >
                  <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 mt-1 select-none shrink-0 min-w-[1.2rem]">
                    {lIdx + 1}.
                  </span>
                  <span>{parseInlineMarkdown(item.content, `${key}-ol-txt-${lIdx}`)}</span>
                </div>
              );
            }

            return (
              <div
                key={`${key}-ul-${lIdx}`}
                className={`flex items-start gap-2 text-sm sm:text-base leading-relaxed text-zinc-800 dark:text-zinc-300 ${padLeft}`}
              >
                <span className="text-[#0057FF] text-base leading-tight select-none shrink-0">•</span>
                <span>{parseInlineMarkdown(item.content, `${key}-ul-txt-${lIdx}`)}</span>
              </div>
            );
          })}
        </div>
      );
      continue;
    }

    // 8. Regular Paragraphs (preserves multi-line text and legacy plain text)
    const paragraphLines: string[] = [];
    while (i < rawLines.length) {
      const pLine = rawLines[i];
      const pTrimmed = pLine.trim();

      // End paragraph on empty line or start of other markdown structures
      if (!pTrimmed) break;
      if (pTrimmed.startsWith('```') || pTrimmed.startsWith('#') || pTrimmed.startsWith('>') || pTrimmed.startsWith('|')) {
        break;
      }
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(pTrimmed)) break;
      if (/^(\*|-|\+|\d+\.)\s+/.test(pTrimmed)) break;

      paragraphLines.push(pLine);
      i++;
    }

    if (paragraphLines.length > 0) {
      elements.push(
        <p
          key={key}
          className={`${
            compact ? 'text-xs' : 'text-sm sm:text-base'
          } leading-relaxed text-zinc-800 dark:text-zinc-300 my-3.5 font-sans break-words`}
        >
          {paragraphLines.map((pLine, pIdx) => (
            <React.Fragment key={`${key}-p-${pIdx}`}>
              {parseInlineMarkdown(pLine, `${key}-pl-${pIdx}`)}
              {pIdx < paragraphLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return (
    <div
      className={`nst-markdown-prose max-w-none text-zinc-800 dark:text-zinc-200 overflow-hidden ${className}`}
    >
      {elements}
    </div>
  );
}
