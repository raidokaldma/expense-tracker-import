/** One row of expense-tracker's POST /api/transactions/import. */
export interface ImportRow {
  externalId: string;
  account: string;
  /** ISO 8601 with a zone */
  occurredAt: string;
  counterparty: string;
  /** Hundredths */
  amount: number;
  description?: string;
}

interface ImportConflict {
  externalId: string;
  savedAmount: number;
  sentAmount: number;
  saved: unknown[];
}

export interface ImportSummary {
  added: number;
  skipped: number;
  ignoredConflicts: ImportConflict[];
}

/** printed: the console printer stood in for expense-tracker */
export type ImportResult = { printed: true } | { printed: false; summary: ImportSummary };

export interface ExpenseTracker {
  importRows(rows: ImportRow[]): Promise<ImportResult>;
}

interface ImportResponse {
  added: number;
  skipped: string[];
  ignoredConflicts: ImportConflict[];
}

const MAX_ROWS_PER_REQUEST = 1000;

export function createExpenseTracker({ url }: { url: string }): ExpenseTracker {
  async function postChunk(rows: ImportRow[]): Promise<ImportResponse> {
    const response = await fetch(new URL('api/transactions/import', url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new Error(`Expense tracker import: ${response.status} ${await response.text()}`);
    return (await response.json()) as ImportResponse;
  }

  return {
    async importRows(rows) {
      const summary: ImportSummary = { added: 0, skipped: 0, ignoredConflicts: [] };
      for (let i = 0; i < rows.length; i += MAX_ROWS_PER_REQUEST) {
        const response = await postChunk(rows.slice(i, i + MAX_ROWS_PER_REQUEST));
        summary.added += response.added;
        summary.skipped += response.skipped.length;
        summary.ignoredConflicts.push(...response.ignoredConflicts);
      }
      return { printed: false, summary };
    },
  };
}
