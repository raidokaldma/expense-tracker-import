import { DAY_MS } from '../../shared/time';
import type { Attempt } from '../../shared/types';

/** plural(3, 'conflict') → "3 conflicts" */
export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "25 Apr 2027" */
export function formatDate(timestamp: string) {
  return dateFormat.format(new Date(timestamp));
}

/** "today 14:05", "yesterday 09:30", "12 Oct 2026 14:05" */
export function formatTime(timestamp: string, now = new Date()) {
  const date = new Date(timestamp);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  const day = days === 0 ? 'today' : days === 1 ? 'yesterday' : dateFormat.format(date);
  return `${day} ${timeFormat.format(date)}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole days until the moment, 0 once it has passed. */
export function daysUntil(timestamp: string, now = new Date()) {
  return Math.max(0, Math.floor((new Date(timestamp).getTime() - now.getTime()) / DAY_MS));
}

/** "3 added, 172 skipped", "118 printed, not imported", or the error */
export function describeAttempt(attempt: Attempt): string {
  if (attempt.status === 'running') return 'Fetching…';
  if (attempt.status === 'error') return attempt.error ?? 'Failed';
  if (attempt.printed) return `${plural(attempt.sent ?? 0, 'row')} printed, not imported`;
  const conflicts = attempt.conflicts?.length ?? 0;
  return [`${attempt.added} added`, `${attempt.skipped} skipped`, conflicts && plural(conflicts, 'conflict')]
    .filter(Boolean)
    .join(', ');
}

export function describeFetch(attempts: Attempt[]): { text: string; warn: boolean } {
  if (!attempts.length) return { text: 'No enabled connections to fetch', warn: false };
  if (attempts.length === 1) {
    const [attempt] = attempts;
    return { text: `${attempt.bank}: ${describeAttempt(attempt)}`, warn: attempt.status === 'error' };
  }
  const failed = attempts.filter((attempt) => attempt.status === 'error').length;
  if (failed) return { text: `${failed} of ${attempts.length} fetches failed`, warn: true };
  return { text: `Fetched ${attempts.length} connections`, warn: false };
}
