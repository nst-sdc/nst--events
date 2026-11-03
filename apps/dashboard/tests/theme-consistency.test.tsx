import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { lightTheme, darkTheme } from '../providers/ThemeProvider';

describe('NST Events Light Theme Redesign & Theme Consistency Suite', () => {
  describe('1. Global Semantic Design Tokens (globals.css)', () => {
    const globalsCssPath = path.resolve(__dirname, '../app/globals.css');
    const cssContent = fs.readFileSync(globalsCssPath, 'utf8');

    it('defines semantic surface tokens for light (:root) and dark (.dark)', () => {
      // Light surface tokens
      expect(cssContent).toContain('--surface-canvas: #F8F9FA;');
      expect(cssContent).toContain('--surface-card: #FFFFFF;');
      expect(cssContent).toContain('--surface-raised: #FFFFFF;');

      // Dark surface tokens
      expect(cssContent).toContain('--surface-canvas: #050505;');
      expect(cssContent).toContain('--surface-card: #0D0E12;');
      expect(cssContent).toContain('--surface-raised: #141721;');
    });

    it('defines semantic text tokens satisfying WCAG AA in both themes', () => {
      // Light text tokens
      expect(cssContent).toContain('--text-primary: #0A0D14;');
      expect(cssContent).toContain('--text-secondary: #475467;');
      expect(cssContent).toContain('--text-muted: #667085;');

      // Dark text tokens
      expect(cssContent).toContain('--text-primary: #F5F5F2;');
      expect(cssContent).toContain('--text-secondary: #A0A4B8;');
      expect(cssContent).toContain('--text-muted: #71768A;');
    });

    it('defines brutalist border and shadow tokens for high graphical contrast', () => {
      expect(cssContent).toContain('--border-default: #D0D5DD;');
      expect(cssContent).toContain('--border-subtle: #E4E7EC;');
      expect(cssContent).toContain('--border-strong: #0A0D14;');
      expect(cssContent).toContain('--shadow-brutal-sm: 2px 2px 0px #0A0D14;');
      expect(cssContent).toContain('--shadow-brutal-md: 4px 4px 0px #0A0D14;');
      expect(cssContent).toContain('--shadow-brutal-lg: 8px 8px 0px #0057FF;');
    });

    it('exposes Tailwind v4 theme inline definitions for semantic utilities', () => {
      expect(cssContent).toContain('--color-surface-canvas: var(--surface-canvas);');
      expect(cssContent).toContain('--color-surface-card: var(--surface-card);');
      expect(cssContent).toContain('--color-text-primary: var(--text-primary);');
      expect(cssContent).toContain('--color-text-secondary: var(--text-secondary);');
      expect(cssContent).toContain('--color-brand-primary: var(--brand-primary);');
    });
  });

  describe('2. Ant Design Theme Provider Token Mapping', () => {
    it('configures lightTheme tokens with high contrast and clean light surfaces', () => {
      expect(lightTheme.token.colorPrimary).toBe('#0057FF');
      expect(lightTheme.token.colorBgLayout).toBe('#F8F9FA');
      expect(lightTheme.token.colorBgContainer).toBe('#FFFFFF');
      expect(lightTheme.token.colorText).toBe('#0A0D14');
      expect(lightTheme.token.colorTextSecondary).toBe('#475467');
      expect(lightTheme.components.Layout.siderBg).toBe('#FFFFFF');
      expect(lightTheme.components.Layout.headerBg).toBe('#FFFFFF');
      expect(lightTheme.components.Table.headerBg).toBe('#F8F9FA');
    });

    it('preserves darkTheme fidelity with deep blacks and legible neon accents', () => {
      expect(darkTheme.token.colorPrimary).toBe('#0057FF');
      expect(darkTheme.token.colorBgLayout).toBe('#050505');
      expect(darkTheme.token.colorBgContainer).toBe('#0D0E12');
      expect(darkTheme.token.colorText).toBe('#F5F5F2');
      expect(darkTheme.token.colorTextSecondary).toBe('#A0A4B8');
      expect(darkTheme.components.Layout.siderBg).toBe('#090A0F');
      expect(darkTheme.components.Layout.headerBg).toBe('#0D0E12');
    });
  });

  describe('3. Kiosk Mode Forced-Dark Presentation Isolation', () => {
    it('enforces forced-dark data-theme and classes on the admin attendance kiosk page', () => {
      const attendancePagePath = path.resolve(__dirname, '../app/(app)/events/[id]/attendance/page.tsx');
      const pageContent = fs.readFileSync(attendancePagePath, 'utf8');

      // The auditorium check-in kiosk MUST be dark-isolated to avoid blinding auditoriums
      expect(pageContent).toContain('data-theme="dark"');
      expect(pageContent).toContain('className="dark select-none');
    });

    it('enforces forced-dark isolation on the student manage fullscreen QR modal', () => {
      const studentAttendancePath = path.resolve(
        __dirname,
        '../app/(student)/student/events/[id]/manage/attendance/page.tsx'
      );
      const studentPageContent = fs.readFileSync(studentAttendancePath, 'utf8');

      // The fullscreen projection modal MUST be dark-isolated
      expect(studentPageContent).toContain('data-theme="dark"');
      expect(studentPageContent).toContain('className="dark select-none fixed inset-0 z-50');
    });
  });

  describe('4. Component Adaptive Styling Verifications', () => {
    it('verifies StudentAppShell contains adaptive canvas and header classes', () => {
      const shellPath = path.resolve(__dirname, '../components/layout/StudentAppShell.tsx');
      const shellContent = fs.readFileSync(shellPath, 'utf8');

      expect(shellContent).toContain('bg-[#F8F9FA]');
      expect(shellContent).toContain('dark:bg-[#050505]');
      expect(shellContent).toContain('text-[#0A0D14]');
      expect(shellContent).toContain('dark:text-[#F5F5F2]');
      expect(shellContent).toContain('bg-white/95 dark:bg-[#050505]');
    });

    it('verifies DevClubCreditsModal uses WCAG AA compliant text colors on light backgrounds', () => {
      const creditsModalPath = path.resolve(__dirname, '../components/brand/DevClubCreditsModal.tsx');
      const modalContent = fs.readFileSync(creditsModalPath, 'utf8');

      // Light text must use #475467 (WCAG AA compliant) rather than faint #94a3b8
      expect(modalContent).toContain('color: #475467;');
    });

    it('verifies Skeleton loader uses light and dark adaptive pulse colors', () => {
      const skeletonPath = path.resolve(__dirname, '../components/ui/Skeleton.tsx');
      const skeletonContent = fs.readFileSync(skeletonPath, 'utf8');

      expect(skeletonContent).toContain('bg-zinc-200 dark:bg-white/10');
    });
  });
});
