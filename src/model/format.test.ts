import { describe, expect, it } from 'vitest';
import type { Attempt } from '../../shared/types';
import { daysUntil, describeAttempt, formatTime } from './format.ts';

function attempt(overrides: Partial<Attempt>): Attempt {
  return {
    id: 1,
    connectionId: 'c',
    bank: 'Swedbank EE',
    mode: 'user',
    status: 'success',
    startedAt: '2026-10-27T10:00:00Z',
    finishedAt: '2026-10-27T10:00:02Z',
    fetched: 176,
    sent: 175,
    added: 3,
    skipped: 172,
    conflicts: [],
    error: null,
    printed: false,
    ...overrides,
  };
}

describe('describeAttempt', () => {
  it('counts what the import did, conflicts only when there are some', () => {
    expect(describeAttempt(attempt({}))).toBe('3 added, 172 skipped');
    expect(describeAttempt(attempt({ conflicts: [{ externalId: 'x', sentAmount: -100, savedAmount: -120 }] }))).toBe(
      '3 added, 172 skipped, 1 conflict',
    );
  });

  it('says when the rows were only printed', () => {
    expect(describeAttempt(attempt({ printed: true, added: null, skipped: null, conflicts: null }))).toBe(
      '175 rows printed, not imported',
    );
  });

  it('shows the error of a failed fetch', () => {
    expect(describeAttempt(attempt({ status: 'error', error: 'Bank access expired' }))).toBe('Bank access expired');
  });
});

describe('dates', () => {
  const now = new Date(2026, 9, 27, 15, 0);

  it('names today and yesterday', () => {
    expect(formatTime(new Date(2026, 9, 27, 9, 5).toISOString(), now)).toBe('today 09:05');
    expect(formatTime(new Date(2026, 9, 26, 23, 30).toISOString(), now)).toBe('yesterday 23:30');
    expect(formatTime(new Date(2026, 9, 12, 8, 0).toISOString(), now)).toBe('12 Oct 2026 08:00');
  });

  it('counts whole days left, never below 0', () => {
    expect(daysUntil('2027-04-25T12:00:00Z', new Date('2026-10-27T12:00:00Z'))).toBe(180);
    expect(daysUntil('2026-10-01T00:00:00Z', new Date('2026-10-27T12:00:00Z'))).toBe(0);
  });
});
