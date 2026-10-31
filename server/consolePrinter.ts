import { formatAmount } from '../shared/format.ts';
import type { ExpenseTracker } from './expenseTracker.ts';

/** Instead of expense-tracker: prints the rows and imports nothing. */
export function createConsolePrinter(log = console.log): ExpenseTracker {
  return {
    async importRows(rows) {
      for (const row of rows)
        log(
          [
            row.occurredAt,
            formatAmount(row.amount).padStart(10),
            row.account,
            row.externalId,
            row.counterparty,
            row.description ?? '',
          ]
            .join('  ')
            .trim(),
        );
      return { printed: true };
    },
  };
}
