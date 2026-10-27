'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  FileCode,
  Link as LinkIcon,
  Table as TableIcon,
  Minus,
  CheckSquare,
  Eye,
  PenSquare,
  Columns,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string | null;
  minHeight?: string;
  id?: string;
}

export const STARTER_PROJECT_TEMPLATE = `# Project Title & Overview

A comprehensive, production-grade engineering case study designed to solve high-impact student problems across campus.

## Problem Statement
What specific engineering or operational challenge does this project solve? Include context, scale, and why existing alternatives fall short.

## Engineered Solution & Key Features
- **Core Capability:** High-throughput event processing and responsive real-time data sync.
- **Offline Resilience:** Client-side local caching with seamless background re-synchronization.
- **Zero-Trust Security:** Strict row-level security and cryptographically verified sessions.

## Technical Architecture & System Design
Describe the high-level architecture, services, data pipeline, and system boundaries.

\`\`\`ts
// Core Architecture Pipeline Example
interface EventStreamConfig {
  clusterNodes: string[];
  maxReplicationLagMs: number;
  encryptionMode: 'TLS_1_3';
}
\`\`\`

## Performance Benchmarks & Milestones

| Capability | Module / Layer | Status | Performance Benchmark |
| :--- | :--- | :---: | ---: |
| Real-time Sync | WebSockets / Redis | Complete | < 25ms p99 latency |
| Offline Cache | IndexedDB / ServiceWorker | Active | 100% offline access |
| RLS Isolation | PostgreSQL Policies | Verified | 0 data leakage |

## Technical Stack & Dependencies
- **Backend:** NestJS, Prisma ORM, PostgreSQL, Redis Pub/Sub
- **Frontend:** Next.js App Router, React 19, Tailwind CSS
- **Observability:** OpenTelemetry, Prometheus metrics

> **Design Principle:** Student-first UX, zero friction, and uncompromising zero-trust security.

## Engineering Challenges & Trade-offs
Document non-obvious engineering decisions, race-condition mitigation, and distributed state consensus.

## Limitations & Future Plans
Outline current architectural boundaries, known edge cases, and upcoming feature enhancements.
`;

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write a comprehensive, multi-section Markdown document for your project...',
  label = 'Comprehensive Overview / Description',
  required = true,
  error = null,
  minHeight = '380px',
  id = 'project-description-markdown-editor',
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<'write' | 'split' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute word and character count
  const charCount = value ? value.length : 0;
  const wordCount = value ? (value.trim().match(/\S+/g)?.length || 0) : 0;

  // Insert or wrap text at current textarea selection
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value ? `${value}\n\n${prefix}${defaultText}${suffix}` : `${prefix}${defaultText}${suffix}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    const replacement = selectedText
      ? `${prefix}${selectedText}${suffix}`
      : `${prefix}${defaultText}${suffix}`;

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    // Reposition cursor and refocus
    setTimeout(() => {
      textarea.focus();
      const cursorPosition = selectedText
        ? start + replacement.length
        : start + prefix.length + defaultText.length;
      textarea.setSelectionRange(
        selectedText ? cursorPosition : start + prefix.length,
        selectedText ? cursorPosition : start + prefix.length + defaultText.length
      );
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Keyboard shortcuts
    const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', 'bold text');
    } else if (modifier && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', 'italic text');
    } else if (modifier && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      insertFormatting('[', '](https://example.com)', 'link title');
    } else if (e.key === 'Tab') {
      // Support 2-space indentation instead of blurring textarea
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  const handleInsertTemplate = () => {
    if (value && value.trim().length > 10) {
      const confirmReplace = window.confirm(
        'Append the starter project documentation template to your current content?'
      );
      if (confirmReplace) {
        onChange(`${value}\n\n${STARTER_PROJECT_TEMPLATE}`);
      }
    } else {
      onChange(STARTER_PROJECT_TEMPLATE);
    }
  };

  return (
    <div className="space-y-2">
      {/* Label and Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="block text-xs font-mono uppercase text-zinc-300 font-bold tracking-wider"
        >
          {label} {required && <span className="text-blue-400">*</span>}
        </label>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('write')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
              viewMode === 'write'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Write mode: Full-width editing area"
          >
            <PenSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Write</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
              viewMode === 'split'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Split mode: Side-by-side editor and live preview"
          >
            <Columns className="w-3.5 h-3.5 text-cyan-400" />
            <span>Split</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
              viewMode === 'preview'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Preview mode: Full-width published preview"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm focus-within:border-[#0057FF] transition-colors">
        {/* Formatting Toolbar (Visible in Write and Split modes) */}
        {viewMode !== 'preview' && (
          <div className="flex flex-wrap items-center gap-1 p-2 bg-zinc-900/90 border-b border-zinc-800/80 text-zinc-300">
            {/* Headings */}
            <button
              type="button"
              onClick={() => insertFormatting('# ', '', 'Heading 1')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Heading 1 (#)"
              aria-label="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('## ', '', 'Heading 2')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Heading 2 (##)"
              aria-label="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('### ', '', 'Heading 3')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Heading 3 (###)"
              aria-label="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

            {/* Inline styles */}
            <button
              type="button"
              onClick={() => insertFormatting('**', '**', 'bold text')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Bold (**text**)"
              aria-label="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*', 'italic text')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Italic (*text*)"
              aria-label="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('~~', '~~', 'strikethrough text')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Strikethrough (~~text~~)"
              aria-label="Strikethrough"
            >
              <Strikethrough className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

            {/* Lists & Quotes */}
            <button
              type="button"
              onClick={() => insertFormatting('- ', '', 'List item')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Unordered List (-)"
              aria-label="Unordered List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('1. ', '', 'First item')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Ordered List (1.)"
              aria-label="Ordered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('- [ ] ', '', 'Task item')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Task List (- [ ])"
              aria-label="Task List"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('> ', '', 'Quoted insight or highlight')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Blockquote (>)"
              aria-label="Blockquote"
            >
              <Quote className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

            {/* Code & Links */}
            <button
              type="button"
              onClick={() => insertFormatting('`', '`', 'const x = 1')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Inline Code (`code`)"
              aria-label="Inline Code"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('```ts\n', '\n```', '// implementation snippet')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Fenced Code Block (```lang)"
              aria-label="Code Block"
            >
              <FileCode className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('[', '](https://example.com)', 'Link Title')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Link ([text](url))"
              aria-label="Insert Link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                insertFormatting(
                  '\n| Feature | Description | Status |\n| :--- | :--- | :---: |\n| ',
                  ' | Value | Complete |\n',
                  'Item'
                )
              }
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Table (| Col 1 | Col 2 |)"
              aria-label="Insert Table"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('\n---\n')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
              title="Horizontal Divider (---)"
              aria-label="Horizontal Rule"
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* Template Starter Button */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleInsertTemplate}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-mono transition-colors border border-zinc-700/60"
                title="Insert standard technical documentation template"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Insert Template</span>
              </button>
            </div>
          </div>
        )}

        {/* Editor Body */}
        <div className="relative">
          {/* Write Mode */}
          {viewMode === 'write' && (
            <textarea
              id={id}
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              style={{ minHeight }}
              className="w-full p-4 sm:p-5 bg-transparent text-white text-sm outline-none font-mono leading-relaxed placeholder:text-zinc-600 resize-y"
            />
          )}

          {/* Split Mode: Left Textarea, Right Preview */}
          {viewMode === 'split' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
              <div className="flex flex-col">
                <div className="px-4 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Markdown Source
                </div>
                <textarea
                  id={id}
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  style={{ minHeight }}
                  className="w-full p-4 bg-transparent text-white text-xs sm:text-sm outline-none font-mono leading-relaxed placeholder:text-zinc-600 resize-y"
                />
              </div>
              <div className="flex flex-col bg-zinc-950/40">
                <div className="px-4 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60 text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                  <span>Live Render Preview</span>
                  <span className="text-zinc-500 text-[10px]">GFM Safe</span>
                </div>
                <div
                  style={{ minHeight }}
                  className="p-4 sm:p-6 overflow-y-auto max-h-[600px]"
                >
                  <MarkdownRenderer content={value} />
                </div>
              </div>
            </div>
          )}

          {/* Preview Mode */}
          {viewMode === 'preview' && (
            <div
              style={{ minHeight }}
              className="p-6 sm:p-8 bg-zinc-950/60 overflow-y-auto"
            >
              <div className="mb-4 pb-3 border-b border-zinc-900 flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Public Presentation Preview</span>
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  Exact rendering as shown on /projects/:slug
                </span>
              </div>
              <MarkdownRenderer content={value} />
            </div>
          )}
        </div>

        {/* Footer Bar: Stats & Format hints */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-zinc-900/80 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-3">
            <span>
              {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
            </span>
            <span className="text-zinc-600">•</span>
            <span>
              {charCount.toLocaleString()} {charCount === 1 ? 'character' : 'characters'}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-blue-400">GitHub Flavored Markdown</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-500 text-[10px]">
            <span>Tip: Use Cmd/Ctrl+B for bold, Cmd/Ctrl+K for links, Tab to indent</span>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-400 font-mono mt-1">{error}</p>
      )}
    </div>
  );
}
