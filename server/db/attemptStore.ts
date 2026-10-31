import type { Attempt, AttemptStatus, Mode } from '../../shared/types.ts';
import type { ImportResult, ImportRow, ImportSummary } from '../expenseTracker.ts';
import type { Db } from './database.ts';

interface AttemptRow {
  id: number;
  connection_id: string | null;
  bank: string;
  mode: Mode;
  status: AttemptStatus;
  started_at: string;
  finished_at: string | null;
  fetched: number | null;
  sent: number | null;
  added: number | null;
  skipped: number | null;
  conflicts: string | null;
  error: string | null;
}

function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    connectionId: row.connection_id,
    bank: row.bank,
    mode: row.mode,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    fetched: row.fetched,
    sent: row.sent,
    added: row.added,
    skipped: row.skipped,
    conflicts: row.conflicts ? JSON.parse(row.conflicts) : null,
    printed: row.status === 'success' && row.added === null,
    error: row.error,
  };
}

/** Each conflict with the row sent, so it can be found by date and counterparty. */
function conflictsWithRows(summary: ImportSummary, rows: ImportRow[]) {
  return summary.ignoredConflicts.map((conflict) => ({
    ...conflict,
    row: rows.find((row) => row.externalId === conflict.externalId),
  }));
}

export function createAttemptStore(db: Db, timestamp: () => string) {
  const sql = {
    get: db.prepare('SELECT * FROM attempts WHERE id = ?'),
    lastOf: db.prepare('SELECT * FROM attempts WHERE connection_id = ? ORDER BY id DESC LIMIT 1'),
    list: db.prepare(
      'SELECT * FROM attempts WHERE (:connection_id IS NULL OR connection_id = :connection_id) ORDER BY id DESC LIMIT :limit',
    ),
    start: db.prepare(
      `INSERT INTO attempts (connection_id, bank, mode, status, started_at) VALUES (?, ?, ?, 'running', ?)`,
    ),
    succeeded: db.prepare(
      `UPDATE attempts SET status = 'success', finished_at = :now, fetched = :fetched, sent = :sent, added = :added,
       skipped = :skipped, conflicts = :conflicts WHERE id = :id`,
    ),
    failed: db.prepare(`UPDATE attempts SET status = 'error', finished_at = :now, error = :error WHERE id = :id`),
    abandonRunning: db.prepare(
      `UPDATE attempts SET status = 'error', finished_at = ?, error = 'The server stopped during the fetch'
       WHERE status = 'running'`,
    ),
  };

  return {
    get(id: number) {
      return toAttempt(sql.get.get(id) as unknown as AttemptRow);
    },

    lastOf(connectionId: string) {
      const row = sql.lastOf.get(connectionId) as AttemptRow | undefined;
      return row ? toAttempt(row) : null;
    },

    list({ connectionId, limit }: { connectionId?: string; limit: number }) {
      const rows = sql.list.all({ connection_id: connectionId ?? null, limit }) as unknown as AttemptRow[];
      return rows.map(toAttempt);
    },

    start(attempt: { connectionId: string; bank: string; mode: Mode }) {
      return Number(sql.start.run(attempt.connectionId, attempt.bank, attempt.mode, timestamp()).lastInsertRowid);
    },

    /** A printed import keeps added, skipped and conflicts NULL. */
    succeeded(id: number, outcome: { fetched: number; rows: ImportRow[]; result: ImportResult }) {
      const summary = outcome.result.printed ? null : outcome.result.summary;
      sql.succeeded.run({
        id,
        now: timestamp(),
        fetched: outcome.fetched,
        sent: outcome.rows.length,
        added: summary?.added ?? null,
        skipped: summary?.skipped ?? null,
        conflicts: summary && JSON.stringify(conflictsWithRows(summary, outcome.rows)),
      });
    },

    failed(id: number, error: string) {
      sql.failed.run({ id, now: timestamp(), error });
    },

    abandonRunning() {
      sql.abandonRunning.run(timestamp());
    },
  };
}

export type AttemptStore = ReturnType<typeof createAttemptStore>;
