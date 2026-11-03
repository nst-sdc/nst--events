// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FilterChip } from '../src/ui/FilterChip';
import { StudentCalendarView } from '../src/ui/StudentCalendarView';

vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', props, props.name),
  };
});

function getAttr(element: any, attrName: string): string | null {
  return element && typeof element.getAttribute === 'function'
    ? element.getAttribute(attrName)
    : null;
}

describe('TASK P7: Mobile Touch Targets & Accessibility Compliance', () => {
  describe('1. Shared FilterChip Component', () => {
    it('enforces min 44x44pt touch target via default hitSlop', () => {
      const onPress = vi.fn();
      render(
        <FilterChip
          label="WORKSHOP"
          onPress={onPress}
          testID="test-filter-chip"
        />
      );

      const chip = screen.getByTestId('test-filter-chip');
      expect(chip).toBeTruthy();

      // hitSlop is applied to expand touch target to at least 44x44pt
      const hitSlopAttr = getAttr(chip, 'data-hitslop');
      expect(hitSlopAttr).toBeDefined();
      const hitSlop = JSON.parse(hitSlopAttr!);
      expect(hitSlop.top).toBeGreaterThanOrEqual(10);
      expect(hitSlop.bottom).toBeGreaterThanOrEqual(10);
      expect(hitSlop.left).toBeGreaterThanOrEqual(8);
      expect(hitSlop.right).toBeGreaterThanOrEqual(8);
    });

    it('sets accessibilityRole, accessibilityLabel, and accessibilityState when selected/disabled', () => {
      const onPress = vi.fn();
      render(
        <FilterChip
          label="HACKATHON"
          selected={true}
          disabled={false}
          accessibilityRole="button"
          accessibilityLabel="Filter by HACKATHON"
          onPress={onPress}
          testID="selected-chip"
        />
      );

      const chip = screen.getByTestId('selected-chip');
      expect(getAttr(chip, 'role')).toBe('button');
      expect(getAttr(chip, 'aria-label')).toBe('Filter by HACKATHON');
      expect(getAttr(chip, 'aria-selected')).toBe('true');
      expect(getAttr(chip, 'aria-disabled')).toBe('false');

      fireEvent.press(chip);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('supports tab role for segment controls and shortcut variants', () => {
      const onPress = vi.fn();
      render(
        <FilterChip
          label="MY CLUBS"
          variant="segment"
          selected={false}
          accessibilityRole="tab"
          accessibilityLabel="Show my clubs events"
          onPress={onPress}
          testID="segment-chip"
        />
      );

      const segment = screen.getByTestId('segment-chip');
      expect(getAttr(segment, 'role')).toBe('tab');
      expect(getAttr(segment, 'aria-label')).toBe('Show my clubs events');
      expect(getAttr(segment, 'aria-selected')).toBe('false');
    });

    it('supports directory shortcut chips with bracket stripping for clean accessibility labels', () => {
      const onPress = vi.fn();
      render(
        <FilterChip
          label="[ 👥 CLUBS ]"
          variant="shortcut"
          onPress={onPress}
          testID="shortcut-clubs-chip"
        />
      );

      const shortcut = screen.getByTestId('shortcut-clubs-chip');
      expect(getAttr(shortcut, 'role')).toBe('button');
      // Bracket notation stripped automatically if accessibilityLabel not manually overridden
      expect(getAttr(shortcut, 'aria-label')).toBe('👥 CLUBS');
    });
  });

  describe('2. StudentCalendarView Navigation & Day Cells Touch Targets', () => {
    it('month navigation buttons have minimum touch target hitSlop and clear accessibility labels', () => {
      render(
        <StudentCalendarView
          events={[]}
          registrations={[]}
          userClubMemberships={[]}
        />
      );

      const prevBtn = screen.getByTestId('btn-prev-month');
      expect(prevBtn).toBeTruthy();
      expect(getAttr(prevBtn, 'role')).toBe('button');
      expect(getAttr(prevBtn, 'aria-label')).toBe('Previous month');
      const prevHitSlop = JSON.parse(getAttr(prevBtn, 'data-hitslop')!);
      expect(prevHitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });

      const nextBtn = screen.getByTestId('btn-next-month');
      expect(nextBtn).toBeTruthy();
      expect(getAttr(nextBtn, 'role')).toBe('button');
      expect(getAttr(nextBtn, 'aria-label')).toBe('Next month');
      const nextHitSlop = JSON.parse(getAttr(nextBtn, 'data-hitslop')!);
      expect(nextHitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
    });

    it('calendar day cells have accessibilityRole and accessibilityState', () => {
      render(
        <StudentCalendarView
          events={[]}
          registrations={[]}
          userClubMemberships={[]}
        />
      );

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      // Today day cell is selected by default in StudentCalendarView
      const dayCell = screen.getByTestId(`calendar-day-${todayStr}`);
      expect(dayCell).toBeTruthy();
      expect(getAttr(dayCell, 'role')).toBe('button');
      expect(getAttr(dayCell, 'aria-selected')).toBe('true');
      expect(getAttr(dayCell, 'aria-label')).toContain(String(today.getDate()));
    });
  });

  describe('3. Minimum Touch Target (44x44pt) Enforcement on Buttons', () => {
    it('verifies FilterChip and pressable buttons meet minimum height and touch bounds', () => {
      render(
        <FilterChip
          label="ALL PROGRAMS"
          selected={true}
          accessibilityRole="button"
          accessibilityLabel="Filter by all programs"
          onPress={() => {}}
          testID="program-chip"
        />
      );

      const chip = screen.getByTestId('program-chip');
      expect(chip).toBeTruthy();
      expect(getAttr(chip, 'role')).toBe('button');
      expect(getAttr(chip, 'aria-label')).toBe('Filter by all programs');
      expect(getAttr(chip, 'aria-selected')).toBe('true');

      const hitSlop = JSON.parse(getAttr(chip, 'data-hitslop')!);
      // Total touch area: ~24px height + 12px top + 12px bottom = 48px >= 44pt
      expect(hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(20);
    });
  });
});
