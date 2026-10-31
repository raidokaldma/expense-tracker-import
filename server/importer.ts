import { messageOf } from '../shared/errors.ts';
import { DAY_MS } from '../shared/time.ts';
import type { Attempt, Mode } from '../shared/types.ts';
import type { AttemptStore } from './db/attemptStore.ts';
import { bankLabel, isExpired, type StoredConnection } from './db/connectionStore.ts';
import type { EnableBanking } from './enableBanking.ts';
import type { BankTransaction, Psu } from './enableBankingTypes.ts';
import type { ExpenseTracker, ImportResult, ImportRow } from './expenseTracker.ts';
import { toImportRows } from './transform/index.ts';

const NOTHING_IMPORTED: ImportResult = { printed: false, summary: { added: 0, skipped: 0, ignoredConflicts: [] } };

function describeResult(result: ImportResult) {
  if (result.printed) return 'printed, not imported';
  const { added, skipped, ignoredConflicts } = result.summary;
  return `${added} added, ${skipped} skipped, ${ignoredConflicts.length} conflicts`;
}

export function createImporter({
  bank,
  tracker,
  attempts,
  fetchDays,
  now,
  log,
}: {
  bank: EnableBanking;
  tracker: ExpenseTracker;
  attempts: AttemptStore;
  fetchDays: number;
  now: () => Date;
  log: (line: string) => void;
}) {
  function activeSession(connection: StoredConnection) {
    const { session } = connection;
    if (connection.status !== 'active' || !session) throw new Error('Not connected yet: finish the bank login first');
    if (isExpired(connection, now())) throw new Error(`Bank access expired ${connection.validUntil}: authorize again`);
    return session;
  }

  async function fetchTransactions(connection: StoredConnection, psu: Psu | null) {
    const dateFrom = new Date(now().getTime() - fetchDays * DAY_MS).toISOString().slice(0, 10);
    const transactions: BankTransaction[] = [];
    for (const account of activeSession(connection).accounts)
      transactions.push(...(await bank.transactions(account.uid, dateFrom, psu)));
    return transactions;
  }

  async function importRows(rows: ImportRow[]) {
    return rows.length ? tracker.importRows(rows) : NOTHING_IMPORTED;
  }

  return async function importConnection(connection: StoredConnection, mode: Mode, psu: Psu | null): Promise<Attempt> {
    const id = attempts.start({ connectionId: connection.id, bank: bankLabel(connection), mode });
    const logPrefix = `${bankLabel(connection)} (${mode}) → ${connection.accountName}`;
    try {
      const transactions = await fetchTransactions(connection, psu);
      const rows = toImportRows(
        { name: connection.bank, country: connection.country },
        connection.accountName,
        transactions,
      );
      const result = await importRows(rows);
      attempts.succeeded(id, { fetched: transactions.length, rows, result });
      log(`${logPrefix}: ${transactions.length} fetched, ${rows.length} sent, ${describeResult(result)}`);
    } catch (err) {
      attempts.failed(id, messageOf(err));
      log(`${logPrefix}: failed: ${messageOf(err)}`);
    }
    return attempts.get(id);
  };
}
