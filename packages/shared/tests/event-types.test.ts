import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPES,
  EVENT_TYPE_VALUES,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_DESCRIPTIONS,
  EventTypeEnum,
  EventType,
} from '../src/dto/events';
import { EventType as PrismaEventType } from '@nst/database';

describe('Canonical Event Types & Drift Prevention Suite (TASK P4)', () => {
  it('matches the Prisma enum exactly and fails if they drift', () => {
    const prismaEnumValues = Object.values(PrismaEventType);
    const sharedValues = EVENT_TYPES.map(t => t.value);

    // 1. Array lengths must match exactly
    expect(sharedValues.length).toBe(prismaEnumValues.length);

    // 2. Both sets of values sorted must match 1:1
    expect([...sharedValues].sort()).toEqual([...prismaEnumValues].sort());
    expect([...EVENT_TYPE_VALUES].sort()).toEqual([...prismaEnumValues].sort());

    // 3. Every Prisma enum value must exist in EVENT_TYPES
    for (const prismaVal of prismaEnumValues) {
      expect(sharedValues).toContain(prismaVal);
      expect(EVENT_TYPE_LABELS[prismaVal as EventType]).toBeDefined();
      expect(EVENT_TYPE_DESCRIPTIONS[prismaVal as EventType]).toBeDefined();
    }

    // 4. Invented SOCIAL enum must strictly NOT exist in either
    expect(sharedValues).not.toContain('SOCIAL');
    expect((prismaEnumValues as string[])).not.toContain('SOCIAL');
  });

  it('validates all canonical event types against the Zod EventTypeEnum', () => {
    const canonicalTypes = [
      'WORKSHOP',
      'SEMINAR',
      'COMPETITION',
      'MEETUP',
      'HACKATHON',
      'OTHER',
      'CULTURAL',
      'SPORTS',
    ];

    for (const type of canonicalTypes) {
      const result = EventTypeEnum.safeParse(type);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(type);
      }
    }
  });

  it('rejects invented SOCIAL and other invalid event types', () => {
    const invalidTypes = ['SOCIAL', 'PARTY', 'MEETING', 'GAMING', 'DESIGN', '', undefined, null];

    for (const invalid of invalidTypes) {
      const result = EventTypeEnum.safeParse(invalid);
      expect(result.success).toBe(false);
    }
  });

  it('provides complete display labels, descriptions, and desc aliases for all types', () => {
    expect(EVENT_TYPES.length).toBe(8);

    for (const item of EVENT_TYPES) {
      expect(item.value).toBeDefined();
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.description).toBe('string');
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.desc).toBe(item.description);
    }
  });
});
