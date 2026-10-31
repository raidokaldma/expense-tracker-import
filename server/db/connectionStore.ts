import type { ConnectionStatus, PsuType } from '../../shared/types.ts';
import type { Session } from '../enableBankingTypes.ts';
import type { Db } from './database.ts';

interface ConnectionRow {
  id: string;
  /** The bank: an ASPSP (account servicing payment service provider) as Enable Banking names it */
  aspsp_name: string;
  aspsp_country: string;
  psu_type: PsuType;
  account_name: string;
  enabled: 0 | 1;
  status: ConnectionStatus;
  auth_state: string | null;
  session_id: string | null;
  valid_until: string | null;
  session: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredConnection {
  id: string;
  bank: string;
  country: string;
  psuType: PsuType;
  accountName: string;
  enabled: boolean;
  status: ConnectionStatus;
  sessionId: string | null;
  validUntil: string | null;
  session: Session | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

function toStoredConnection(row: ConnectionRow): StoredConnection {
  return {
    id: row.id,
    bank: row.aspsp_name,
    country: row.aspsp_country,
    psuType: row.psu_type,
    accountName: row.account_name,
    enabled: row.enabled === 1,
    status: row.status,
    sessionId: row.session_id,
    validUntil: row.valid_until,
    session: row.session ? (JSON.parse(row.session) as Session) : null,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredConnectionOrNull(row: unknown) {
  return row ? toStoredConnection(row as ConnectionRow) : null;
}

export function isExpired(connection: StoredConnection, now: Date) {
  return connection.validUntil !== null && connection.validUntil <= now.toISOString();
}

/** "Swedbank EE" */
export function bankLabel(connection: StoredConnection) {
  return `${connection.bank} ${connection.country}`;
}

export function createConnectionStore(db: Db, timestamp: () => string) {
  const sql = {
    all: db.prepare('SELECT * FROM connections ORDER BY created_at'),
    get: db.prepare('SELECT * FROM connections WHERE id = ?'),
    byAuthState: db.prepare('SELECT * FROM connections WHERE auth_state = ?'),
    insert: db.prepare(
      `INSERT INTO connections (id, aspsp_name, aspsp_country, psu_type, account_name, enabled, status, created_at, updated_at)
       VALUES (:id, :aspsp_name, :aspsp_country, :psu_type, :account_name, 1, 'pending', :now, :now)`,
    ),
    setAuthState: db.prepare('UPDATE connections SET auth_state = ?, updated_at = ? WHERE id = ?'),
    authorized: db.prepare(
      `UPDATE connections SET status = 'active', auth_state = NULL, session_id = :session_id, valid_until = :valid_until,
       session = :session, error = NULL, updated_at = :now WHERE id = :id`,
    ),
    loginFailed: db.prepare(
      `UPDATE connections SET status = CASE status WHEN 'pending' THEN 'failed' ELSE status END, auth_state = NULL,
       error = :error, updated_at = :now WHERE id = :id`,
    ),
    update: db.prepare(
      'UPDATE connections SET account_name = :account_name, enabled = :enabled, updated_at = :now WHERE id = :id',
    ),
    delete: db.prepare('DELETE FROM connections WHERE id = ?'),
  };

  return {
    all() {
      return (sql.all.all() as unknown as ConnectionRow[]).map(toStoredConnection);
    },

    get(id: string) {
      return toStoredConnectionOrNull(sql.get.get(id));
    },

    byAuthState(state: string) {
      return toStoredConnectionOrNull(sql.byAuthState.get(state));
    },

    insert(connection: { id: string; bank: string; country: string; psuType: PsuType; accountName: string }) {
      sql.insert.run({
        id: connection.id,
        aspsp_name: connection.bank,
        aspsp_country: connection.country,
        psu_type: connection.psuType,
        account_name: connection.accountName,
        now: timestamp(),
      });
    },

    setAuthState(id: string, state: string) {
      sql.setAuthState.run(state, timestamp(), id);
    },

    authorized(id: string, session: Session) {
      sql.authorized.run({
        id,
        session_id: session.session_id,
        valid_until: session.access.valid_until,
        session: JSON.stringify(session),
        now: timestamp(),
      });
    },

    loginFailed(id: string, error: string) {
      sql.loginFailed.run({ id, error, now: timestamp() });
    },

    update(id: string, changes: { accountName: string; enabled: boolean }) {
      sql.update.run({ id, account_name: changes.accountName, enabled: Number(changes.enabled), now: timestamp() });
    },

    delete(id: string) {
      sql.delete.run(id);
    },
  };
}

export type ConnectionStore = ReturnType<typeof createConnectionStore>;
