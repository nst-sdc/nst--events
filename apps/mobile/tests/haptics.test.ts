// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

const selectionAsyncMock = vi.fn().mockResolvedValue(undefined);
const impactAsyncMock = vi.fn().mockResolvedValue(undefined);
const notificationAsyncMock = vi.fn().mockResolvedValue(undefined);

vi.mock('expo-haptics', () => ({
  selectionAsync: (...args: any[]) => selectionAsyncMock(...args),
  impactAsync: (...args: any[]) => impactAsyncMock(...args),
  notificationAsync: (...args: any[]) => notificationAsyncMock(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

import { haptics, setHapticsEnabled, isHapticsEnabled } from '../src/lib/haptics';
import { Button } from '../src/ui/Button';

describe('Disciplined Haptics Policy Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHapticsEnabled(true);
  });

  it('triggers selection, medium impact, and terminal notification haptics when enabled', async () => {
    expect(isHapticsEnabled()).toBe(true);

    await haptics.selection();
    expect(selectionAsyncMock).toHaveBeenCalledTimes(1);

    await haptics.impactMedium();
    expect(impactAsyncMock).toHaveBeenCalledWith('medium');

    await haptics.notifySuccess();
    expect(notificationAsyncMock).toHaveBeenCalledWith('success');

    await haptics.notifyWarning();
    expect(notificationAsyncMock).toHaveBeenCalledWith('warning');

    await haptics.notifyError();
    expect(notificationAsyncMock).toHaveBeenCalledWith('error');
  });

  it('does not trigger any haptics when disabled via in-app toggle', async () => {
    setHapticsEnabled(false);
    await haptics.selection();
    await haptics.impactMedium();
    await haptics.notifySuccess();
    await haptics.notifyWarning();
    await haptics.notifyError();

    expect(selectionAsyncMock).not.toHaveBeenCalled();
    expect(impactAsyncMock).not.toHaveBeenCalled();
    expect(notificationAsyncMock).not.toHaveBeenCalled();
  });

  it('gracefully handles unsupported device errors without throwing', async () => {
    impactAsyncMock.mockRejectedValueOnce(new Error('Haptics not available on simulator'));
    await expect(haptics.impactMedium()).resolves.toBeUndefined();
  });

  it('fires impactMedium on enabled Button press and never on mount or disabled press', async () => {
    const onPress = vi.fn();
    await render(
      React.createElement(Button, { title: 'CONFIRM', onPress })
    );

    // Zero haptic on mount
    expect(impactAsyncMock).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('CONFIRM'));
    expect(onPress).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(impactAsyncMock).toHaveBeenCalledTimes(1);
    });

    vi.clearAllMocks();
    await render(
      React.createElement(Button, { title: 'LOCKED', onPress, disabled: true })
    );
    fireEvent.press(screen.getByText('LOCKED'));
    await Promise.resolve();
    expect(onPress).not.toHaveBeenCalled();
    expect(impactAsyncMock).not.toHaveBeenCalled();
  });
});
