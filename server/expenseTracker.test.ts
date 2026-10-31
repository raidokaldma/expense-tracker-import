import { afterEach, expect, it, vi } from 'vitest';
import { createExpenseTracker, type ImportRow } from './expenseTracker.ts';

const TRACKER_URL = 'http://tracker.example/';

function rows(count: number): ImportRow[] {
  return Array.from({ length: count }, (_, index) => ({
    externalId: `ref-${index}`,
    account: 'swedbank',
    occurredAt: '2026-10-23T00:00:00.000+03:00',
    counterparty: 'JANE ROE',
    amount: -100,
  }));
}

function answer(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it('sends at most 1000 rows per request and adds up the answers', async () => {
  const conflict = { externalId: 'ref-5', savedAmount: -120, sentAmount: -100, saved: [] };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(answer({ added: 990, skipped: ['ref-1'], ignoredConflicts: [conflict] }))
    .mockResolvedValueOnce(answer({ added: 1000, skipped: [], ignoredConflicts: [] }))
    .mockResolvedValueOnce(answer({ added: 498, skipped: ['ref-2001', 'ref-2002'], ignoredConflicts: [] }));
  vi.stubGlobal('fetch', fetch);

  const result = await createExpenseTracker({ url: TRACKER_URL }).importRows(rows(2500));

  const sentSizes = fetch.mock.calls.map(([, init]) => JSON.parse(init.body).length);
  expect(sentSizes).toEqual([1000, 1000, 500]);
  expect(String(fetch.mock.calls[0][0])).toBe('http://tracker.example/api/transactions/import');
  expect(result).toEqual({ printed: false, summary: { added: 2488, skipped: 3, ignoredConflicts: [conflict] } });
});

it("fails with expense-tracker's answer when it refuses the rows", async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('bad account', { status: 422 })));
  await expect(createExpenseTracker({ url: TRACKER_URL }).importRows(rows(1))).rejects.toThrow(
    'Expense tracker import: 422 bad account',
  );
});
