// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MarkdownRenderer, sanitizeUrl } from '../components/projects/MarkdownRenderer';
import { MarkdownEditor, STARTER_PROJECT_TEMPLATE } from '../components/projects/MarkdownEditor';
import { ProjectForm } from '../components/projects/ProjectForm';
import { projectsApi, ProjectDetail } from '../lib/projects-api';
import * as authStoreModule from '../lib/auth-store';
import PublicProjectDetailPage from '../app/(public)/projects/[slug]/page';

// Mock Next.js navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({
    slug: 'campus-transit-tracker',
  }),
  notFound: vi.fn(),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

// Mock layout providers
vi.mock('../components/layout/StudentAppShell', () => ({
  StudentAppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="student-app-shell">{children}</div>,
}));

vi.mock('../components/layout/ClubAdminProvider', () => ({
  ClubAdminProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="club-admin-provider">{children}</div>,
}));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: 'user-public-1', email: 'priya@adypu.edu.in', role: 'STUDENT' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe('Rich Markdown Authoring & Rendering Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. MarkdownRenderer Unit Tests: Formatting, GFM, Syntax
  // =========================================================================
  describe('MarkdownRenderer: Headings & Hierarchy', () => {
    it('renders H1, H2, H3, H4 with appropriate heading tags', () => {
      const doc = `# Level One Heading\n## Level Two Heading\n### Level Three Heading\n#### Level Four Heading`;
      render(<MarkdownRenderer content={doc} />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Level One Heading');

      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2).toHaveTextContent('Level Two Heading');

      const h3 = screen.getByRole('heading', { level: 3 });
      expect(h3).toHaveTextContent('Level Three Heading');

      const h4 = screen.getByRole('heading', { level: 4 });
      expect(h4).toHaveTextContent('Level Four Heading');
    });

    it('renders inline bold, italic, and strikethrough styling', () => {
      const doc = `This has **bold statement**, *italic thought*, and ~~deprecated feature~~.`;
      const { container } = render(<MarkdownRenderer content={doc} />);

      const boldEl = container.querySelector('strong');
      expect(boldEl).toHaveTextContent('bold statement');

      const italicEl = container.querySelector('em');
      expect(italicEl).toHaveTextContent('italic thought');

      const strikeEl = container.querySelector('del');
      expect(strikeEl).toHaveTextContent('deprecated feature');
    });
  });

  describe('MarkdownRenderer: Lists & Task Lists', () => {
    it('renders unordered and ordered lists with correct items', () => {
      const doc = `- First item\n- Second item\n- Third item\n\n1. Step one\n2. Step two`;
      render(<MarkdownRenderer content={doc} />);

      expect(screen.getByText('First item')).toBeInTheDocument();
      expect(screen.getByText('Second item')).toBeInTheDocument();
      expect(screen.getByText('Third item')).toBeInTheDocument();
      expect(screen.getByText('Step one')).toBeInTheDocument();
      expect(screen.getByText('Step two')).toBeInTheDocument();
    });

    it('renders GFM task list items with checked and unchecked indicators', () => {
      const doc = `- [x] Completed task\n- [ ] Pending task`;
      const { container } = render(<MarkdownRenderer content={doc} />);

      expect(screen.getByText('Completed task')).toBeInTheDocument();
      expect(screen.getByText('Pending task')).toBeInTheDocument();
      expect(container.querySelector('.line-through')).toHaveTextContent('Completed task');
    });

    it('supports nested indented list items', () => {
      const doc = `- Parent feature\n  - Sub-task detail\n  - Another sub-task`;
      render(<MarkdownRenderer content={doc} />);

      expect(screen.getByText('Parent feature')).toBeInTheDocument();
      expect(screen.getByText('Sub-task detail')).toBeInTheDocument();
      expect(screen.getByText('Another sub-task')).toBeInTheDocument();
    });
  });

  describe('MarkdownRenderer: Code Blocks & Syntax Highlighting', () => {
    it('renders fenced code blocks with language indicator and copy button', () => {
      const doc = "```typescript\nconst greeting: string = 'Hello NST';\nfunction run() { return true; }\n```";
      render(<MarkdownRenderer content={doc} />);

      expect(screen.getByText('TYPESCRIPT')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
      expect(screen.getByText(/'Hello NST'/)).toBeInTheDocument();
    });

    it('renders inline code with monospace styling', () => {
      const doc = 'Run `pnpm dev` to start the cluster.';
      const { container } = render(<MarkdownRenderer content={doc} />);

      const codeEl = container.querySelector('code');
      expect(codeEl).toHaveTextContent('pnpm dev');
      expect(codeEl).toHaveClass('font-mono');
    });
  });

  describe('MarkdownRenderer: GFM Responsive Tables', () => {
    it('renders structured tables with headers, alignments, and rows', () => {
      const tableDoc = `| Metric | Target | Status |\n| :--- | :---: | ---: |\n| Latency | < 20ms | Verified |\n| Uptime | 99.9% | Target |`;
      const { container } = render(<MarkdownRenderer content={tableDoc} />);

      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();

      const headers = container.querySelectorAll('th');
      expect(headers).toHaveLength(3);
      expect(headers[0]).toHaveTextContent('Metric');
      expect(headers[1]).toHaveTextContent('Target');
      expect(headers[2]).toHaveTextContent('Status');

      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Latency');
      expect(rows[0]).toHaveTextContent('< 20ms');
      expect(rows[0]).toHaveTextContent('Verified');

      // Check responsive scroll wrapper
      const wrapper = container.querySelector('.overflow-x-auto');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('MarkdownRenderer: Blockquotes & Dividers', () => {
    it('renders blockquotes with accent borders and italics', () => {
      const doc = `> Innovation distinguishes between a leader and a follower.\n> Always verify edge cases.`;
      const { container } = render(<MarkdownRenderer content={doc} />);

      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeInTheDocument();
      expect(blockquote).toHaveTextContent(/Innovation distinguishes/);
      expect(blockquote).toHaveTextContent(/Always verify edge cases/);
    });

    it('renders horizontal divider rules', () => {
      const doc = `Section Alpha\n\n---\n\nSection Beta`;
      const { container } = render(<MarkdownRenderer content={doc} />);

      const hr = container.querySelector('hr');
      expect(hr).toBeInTheDocument();
      expect(screen.getByText('Section Alpha')).toBeInTheDocument();
      expect(screen.getByText('Section Beta')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Data Compatibility & Unicode Support
  // =========================================================================
  describe('MarkdownRenderer: Data Compatibility & Unicode', () => {
    it('preserves legacy plain-text descriptions with multi-line paragraphs', () => {
      const legacyText = `This is a legacy plain text project description written before markdown.\nIt has line breaks that should be preserved.\n\nAnd a second paragraph explaining the student motivation.`;
      render(<MarkdownRenderer content={legacyText} />);

      expect(screen.getByText(/This is a legacy plain text/)).toBeInTheDocument();
      expect(screen.getByText(/And a second paragraph explaining/)).toBeInTheDocument();
    });

    it('preserves Unicode, Devanagari, emojis, currency symbols, and math notation', () => {
      const unicodeDoc = `### प्रोजेक्ट विज़न (Project Vision) 🚀\n- Budget: ₹1,50,000 / $1,800\n- Algorithm complexity: O(N log N) with 99.9% precision ⚡\n- Team: Newton School of Technology, Pune Campus 🎯`;
      render(<MarkdownRenderer content={unicodeDoc} />);

      expect(screen.getByText(/प्रोजेक्ट विज़न/)).toBeInTheDocument();
      expect(screen.getByText(/₹1,50,000/)).toBeInTheDocument();
      expect(screen.getByText(/O\(N log N\)/)).toBeInTheDocument();
      expect(screen.getByText(/Newton School of Technology/)).toBeInTheDocument();
    });

    it('handles empty or null content gracefully without throwing', () => {
      render(<MarkdownRenderer content={null} />);
      expect(screen.getByText(/No project description provided/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Security, URL Sanitization & XSS Protections
  // =========================================================================
  describe('Security & XSS Protections', () => {
    it('allows valid safe URLs for links', () => {
      expect(sanitizeUrl('https://github.com/nst-project')).toBe('https://github.com/nst-project');
      expect(sanitizeUrl('http://demo.example.com')).toBe('http://demo.example.com');
      expect(sanitizeUrl('mailto:student@adypu.edu.in')).toBe('mailto:student@adypu.edu.in');
      expect(sanitizeUrl('/projects/campus-transit')).toBe('/projects/campus-transit');
      expect(sanitizeUrl('#section-two')).toBe('#section-two');
    });

    it('strictly blocks malicious link schemes', () => {
      expect(sanitizeUrl('javascript:alert(document.cookie)')).toBeNull();
      expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBeNull();
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
      expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
      expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
    });

    it('neutralizes malicious markdown links with javascript: protocol', () => {
      const maliciousDoc = `Click [here for free points](javascript:alert('pwned')) immediately!`;
      const { container } = render(<MarkdownRenderer content={maliciousDoc} />);

      // Verify no anchor tag has javascript: href
      const anchors = container.querySelectorAll('a');
      anchors.forEach((a) => {
        expect(a.getAttribute('href')).not.toMatch(/^javascript:/i);
      });

      // The text is rendered safely neutralized
      expect(screen.getByText('here for free points')).toBeInTheDocument();
    });

    it('escapes and prevents raw HTML injection payloads from executing', () => {
      const maliciousPayload = `<script>window.__injected = true;</script><img src="x" onerror="window.__injected=true" /><iframe src="https://attacker.com"></iframe>`;
      const { container } = render(<MarkdownRenderer content={maliciousPayload} />);

      // Verify no script or iframe elements are created in the DOM
      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('iframe')).toBeNull();

      // Ensure window.__injected was NOT set
      expect((window as any).__injected).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. MarkdownEditor: View Modes, Toolbar Controls & Templates
  // =========================================================================
  describe('MarkdownEditor Component', () => {
    it('renders in Write mode by default with multiline textarea', () => {
      const onChangeMock = vi.fn();
      render(
        <MarkdownEditor
          value="Initial project documentation"
          onChange={onChangeMock}
          placeholder="Custom placeholder..."
        />
      );

      const textarea = screen.getByDisplayValue('Initial project documentation');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(screen.getByText('3 words')).toBeInTheDocument();
    });

    it('switches between Write, Split, and Preview modes seamlessly', () => {
      const onChangeMock = vi.fn();
      render(
        <MarkdownEditor
          value="# Dynamic Architecture\n\nHigh performance caching layer."
          onChange={onChangeMock}
        />
      );

      // Switch to Split mode
      fireEvent.click(screen.getByRole('button', { name: /split/i }));
      expect(screen.getByText('Live Render Preview')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dynamic Architecture');

      // Switch to Preview mode
      fireEvent.click(screen.getByRole('button', { name: /preview/i }));
      expect(screen.getByText('Public Presentation Preview')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dynamic Architecture');

      // Switch back to Write mode
      fireEvent.click(screen.getByRole('button', { name: /write/i }));
      expect(screen.getByDisplayValue(/# Dynamic Architecture/)).toBeInTheDocument();
    });

    it('toolbar buttons insert formatting syntax into markdown content', () => {
      let currentVal = '';
      const onChangeMock = vi.fn((val) => {
        currentVal = val;
      });

      render(<MarkdownEditor value={currentVal} onChange={onChangeMock} />);

      // Click Bold button
      const boldBtn = screen.getByRole('button', { name: /^bold$/i });
      fireEvent.click(boldBtn);
      expect(onChangeMock).toHaveBeenCalledWith('**bold text**');

      // Click Heading 1
      const h1Btn = screen.getByRole('button', { name: /^heading 1$/i });
      fireEvent.click(h1Btn);
      expect(onChangeMock).toHaveBeenCalledWith('# Heading 1');

      // Click Table button
      const tableBtn = screen.getByRole('button', { name: /insert table/i });
      fireEvent.click(tableBtn);
      expect(onChangeMock).toHaveBeenCalled();
    });

    it('inserts full technical documentation starter template', () => {
      const onChangeMock = vi.fn();
      render(<MarkdownEditor value="" onChange={onChangeMock} />);

      const templateBtn = screen.getByRole('button', { name: /insert template/i });
      fireEvent.click(templateBtn);

      expect(onChangeMock).toHaveBeenCalledWith(STARTER_PROJECT_TEMPLATE);
    });
  });

  // =========================================================================
  // 5. ProjectForm Integration: Authoring, Prepopulation & Preservation
  // =========================================================================
  describe('ProjectForm Markdown Integration', () => {
    const mockMarkdownProject: ProjectDetail = {
      id: 'proj-md-1',
      owner_id: 'user-1',
      title: 'Distributed Autonomous Fleet',
      slug: 'autonomous-fleet',
      tagline: 'Multi-agent robotic consensus protocol.',
      description: `# Distributed Autonomous Fleet\n\nConsensus protocol for aerial swarms.\n\n## Benchmarks\n\n| Nodes | Latency |\n| :--- | ---: |\n| 10 | 12ms |\n| 100 | 28ms |\n\n\`\`\`ts\nexport function sync() { return true; }\n\`\`\``,
      category: 'Robotics / Hardware',
      tags: ['robotics', 'swarm', 'ai'],
      project_type: 'RESEARCH',
      development_status: 'LIVE',
      visibility: 'PUBLISHED',
      published_at: '2026-10-18T10:00:00Z',
      cover_image_url: 'https://images.unsplash.com/robot.jpg',
      like_count: 32,
      view_count: 420,
      links: [
        { id: 'l1', type: 'DEMO', url: 'https://fleet.live', label: 'Live Fleet', order: 0 },
      ],
      author: {
        name: 'Dev Student',
        slug: 'dev-student',
        avatar_url: null,
      },
      contributors: [],
    };

    it('preserves full multi-section Markdown document when reopening for editing', () => {
      authStoreModule.getWebAuthStore().setAccessToken('mock-token');

      render(<ProjectForm mode="edit" initialData={mockMarkdownProject} />);

      // Verify the textarea contains the exact multi-section markdown
      const textarea = screen.getByDisplayValue(/# Distributed Autonomous Fleet/);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue(mockMarkdownProject.description);
    });

    it('allows toggling to Preview inside ProjectForm before saving', () => {
      authStoreModule.getWebAuthStore().setAccessToken('mock-token');

      render(<ProjectForm mode="edit" initialData={mockMarkdownProject} />);

      // Switch to preview mode
      const previewBtn = screen.getByRole('button', { name: /preview/i });
      fireEvent.click(previewBtn);

      // Verify that the markdown rendered properly in preview
      expect(screen.getByRole('heading', { level: 1, name: /Distributed Autonomous Fleet/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Benchmarks/i })).toBeInTheDocument();
      expect(screen.getByText('Nodes')).toBeInTheDocument();
      expect(screen.getByText('Latency')).toBeInTheDocument();
      expect(screen.getByText('12ms')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 6. Public Page Rendering: /projects/:slug
  // =========================================================================
  describe('Public Project Detail Page Markdown Rendering', () => {
    it('renders project description as structured Markdown on /projects/:slug while keeping metadata distinct', async () => {
      const mockProject = {
        id: 'proj-public-1',
        owner_id: 'user-public-1',
        title: 'Neural Audio Synthesizer',
        slug: 'neural-synth',
        tagline: 'Real-time neural audio DSP running in WebAssembly.',
        description: `# Architecture Overview\n\nThe neural audio engine synthesizes low-latency spatial audio.\n\n## Features\n- Direct convolution pipeline\n- HRTF filters\n\n> Zero audio latency overhead.\n\n\`\`\`rust\nfn synthesize() -> Result<(), AudioError> {\n    Ok(())\n}\n\`\`\``,
        category: 'AI / Machine Learning',
        tags: ['audio', 'wasm', 'neural'],
        project_type: 'PERSONAL',
        development_status: 'LIVE',
        visibility: 'PUBLISHED',
        published_at: '2026-10-19T10:00:00Z',
        cover_image_url: 'https://images.unsplash.com/synth.jpg',
        like_count: 55,
        view_count: 980,
        author: {
          id: 'user-public-1',
          name: 'Priya Patel',
          slug: 'priya-patel',
          avatar_url: null,
        },
        links: [
          { id: 'lnk-1', type: 'DEMO', url: 'https://synth.live', label: 'Try Synth', order: 0 },
          { id: 'lnk-2', type: 'REPOSITORY', url: 'https://github.com/priya/synth', label: 'Source', order: 1 },
        ],
        contributors: [],
      };

      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(mockProject as any);

      const pageElement = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'neural-synth' }),
      });

      render(pageElement);

      // Verify Markdown document rendered
      expect(screen.getByRole('heading', { level: 1, name: /Architecture Overview/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Features/i })).toBeInTheDocument();
      expect(screen.getByText('Direct convolution pipeline')).toBeInTheDocument();
      expect(screen.getByText(/Zero audio latency overhead/)).toBeInTheDocument();
      expect(screen.getByText('RUST')).toBeInTheDocument();

      // Verify metadata remains distinct
      expect(screen.getAllByText('AI / Machine Learning').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('LIVE').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('@priya-patel ↗')).toBeInTheDocument();
      expect(screen.getByText('Try Synth')).toBeInTheDocument();
      expect(screen.getByText('Source')).toBeInTheDocument();
    });
  });
});
