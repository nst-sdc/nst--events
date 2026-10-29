import { describe, it, expect } from 'vitest';
import { renderMarkdownToSafeHtml, sanitizeUrl } from '../lib/server-markdown';

describe('Server-Safe Markdown & URL Sanitization Suite', () => {
  describe('sanitizeUrl', () => {
    it('accepts safe schemes (https, http, mailto, relative, anchor)', () => {
      expect(sanitizeUrl('https://nstsdc.org')).toBe('https://nstsdc.org');
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
      expect(sanitizeUrl('mailto:support@nstsdc.com')).toBe('mailto:support@nstsdc.com');
      expect(sanitizeUrl('/student/home')).toBe('/student/home');
      expect(sanitizeUrl('#section-2')).toBe('#section-2');
    });

    it('strictly rejects malicious schemes (javascript, data, vbscript, file, blob)', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBeNull();
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
      expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
      expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
      expect(sanitizeUrl('blob:https://example.com/uuid')).toBeNull();
    });
  });

  describe('renderMarkdownToSafeHtml', () => {
    it('escapes raw HTML tags to prevent XSS injection', () => {
      const malicious = '<script>alert("xss")</script><img src="x" onerror="stealCookies()">';
      const rendered = renderMarkdownToSafeHtml(malicious);

      expect(rendered).not.toContain('<script>');
      expect(rendered).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(rendered).not.toContain('<img');
      expect(rendered).toContain('&lt;img src=&quot;x&quot; onerror=&quot;stealCookies()&quot;&gt;');
    });

    it('neutralizes unsafe links into non-clickable struck-through text', () => {
      const input = '[Click Here](javascript:alert("hacked"))';
      const rendered = renderMarkdownToSafeHtml(input);

      expect(rendered).not.toContain('href=');
      expect(rendered).toContain('line-through');
      expect(rendered).toContain('Click Here');
    });

    it('renders safe markdown links properly', () => {
      const input = '[Support Email](mailto:support@nstsdc.com)';
      const rendered = renderMarkdownToSafeHtml(input);

      expect(rendered).toContain('<a href="mailto:support@nstsdc.com"');
      expect(rendered).toContain('rel="noopener noreferrer"');
      expect(rendered).toContain('Support Email</a>');
    });

    it('renders headings, lists, bold, italics, code blocks, and hr', () => {
      const input = `# Heading 1

## Heading 2

- Item 1
- Item 2

1. First
2. Second

**Bold Text** and *Italic Text*

\`\`\`ts
const x = 10;
\`\`\`

---`;

      const rendered = renderMarkdownToSafeHtml(input);

      expect(rendered).toContain('<h1');
      expect(rendered).toContain('<h2');
      expect(rendered).toContain('<ul');
      expect(rendered).toContain('<li>Item 1</li>');
      expect(rendered).toContain('<ol');
      expect(rendered).toContain('<li>First</li>');
      expect(rendered).toContain('<strong>Bold Text</strong>');
      expect(rendered).toContain('<em>Italic Text</em>');
      expect(rendered).toContain('<pre');
      expect(rendered).toContain('const x = 10;');
      expect(rendered).toContain('<hr');
    });
  });
});
