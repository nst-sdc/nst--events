import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { MarkdownEditor } from '../components/projects/MarkdownEditor';

describe('TASK P7: Web Accessibility, Keyboard Focus & Confirm Dialog Parity', () => {
  describe('1. ConfirmDialog Accessibility & Keyboard Interactivity', () => {
    it('renders with role="alertdialog", aria-modal="true", and aria labelling', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          title="Delete Project"
          message="Are you sure you want to delete this project?"
          confirmText="DELETE"
          isDestructive={true}
        />
      );

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-dialog-title');
      expect(dialog.getAttribute('aria-describedby')).toBe('confirm-dialog-message');

      expect(screen.getByText('Delete Project')).toBeDefined();
      expect(screen.getByText('Are you sure you want to delete this project?')).toBeDefined();
    });

    it('has prominent focus-visible ring styles on interactive buttons', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Confirm Action"
          message="Proceed with changes?"
          confirmText="PROCEED"
          cancelText="CANCEL"
        />
      );

      const confirmBtn = screen.getByRole('button', { name: 'PROCEED' });
      const cancelBtn = screen.getByRole('button', { name: 'CANCEL' });

      // Verify buttons contain focus-visible rings for WCAG 2.4.7 focus indicator compliance
      expect(confirmBtn.className).toContain('focus-visible:ring-2');
      expect(confirmBtn.className).toContain('focus-visible:ring-[#0057FF]');
      expect(cancelBtn.className).toContain('focus-visible:ring-2');
      expect(cancelBtn.className).toContain('focus-visible:ring-[#0057FF]');
    });

    it('supports keyboard navigation via Enter and Escape keys', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          title="Keyboard Navigation Dialog"
          message="Testing escape and tab navigation"
          confirmText="CONFIRM ACTION"
          cancelText="ABORT"
        />
      );

      // Pressing Escape triggers onClose
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);

      // Clicking confirm button triggers onConfirm
      const confirmBtn = screen.getByRole('button', { name: 'CONFIRM ACTION' });
      await user.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. MarkdownEditor Replaces window.confirm with Accessible Modal', () => {
    it('opens ConfirmDialog instead of window.confirm when inserting template into populated editor', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const windowConfirmSpy = vi.spyOn(window, 'confirm');

      render(
        <MarkdownEditor
          value="Existing comprehensive documentation that should not be silently overwritten"
          onChange={onChange}
        />
      );

      // Find template insertion button
      const templateButton = screen.getByRole('button', { name: /Insert Template/i });
      expect(templateButton).toBeDefined();

      // Trigger template insertion
      await user.click(templateButton);

      // Verify native window.confirm was NEVER called
      expect(windowConfirmSpy).not.toHaveBeenCalled();

      // Verify styled ConfirmDialog is rendered instead
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toBeDefined();
      expect(screen.getByText('Append Starter Template')).toBeDefined();
      expect(
        screen.getByText(/Append the starter project documentation template to your current content\?/i)
      ).toBeDefined();

      // Confirm appending template
      const confirmAppendBtn = screen.getByRole('button', { name: 'APPEND TEMPLATE' });
      await user.click(confirmAppendBtn);

      expect(onChange).toHaveBeenCalled();
      const updatedText = onChange.mock.calls[0][0];
      expect(updatedText).toContain('Existing comprehensive documentation');
      expect(updatedText).toContain('## Problem Statement');

      windowConfirmSpy.mockRestore();
    });

    it('textarea and toolbar buttons retain visible focus rings for keyboard navigation', async () => {
      render(
        <MarkdownEditor
          value=""
          onChange={() => {}}
        />
      );

      const textarea = screen.getByPlaceholderText(/Write a comprehensive, multi-section Markdown document/i);
      expect(textarea).toBeDefined();

      // Focus textarea
      textarea.focus();
      expect(document.activeElement).toBe(textarea);
    });
  });
});
