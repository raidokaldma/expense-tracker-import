import { randomUUID } from 'node:crypto';
import type { Mode, PsuType } from '../shared/types.ts';
import { toBank, toConnection } from './apiMapping.ts';
import { createBankLogin, type LoginCallback } from './bankLogin.ts';
import { createAttemptStore } from './db/attemptStore.ts';
import { createConnectionStore, type StoredConnection } from './db/connectionStore.ts';
import type { Db } from './db/database.ts';
import type { EnableBanking } from './enableBanking.ts';
import type { Psu } from './enableBankingTypes.ts';
import { NotFoundError } from './errors.ts';
import type { ExpenseTracker } from './expenseTracker.ts';
import { createImporter } from './importer.ts';

interface ServiceOptions {
  db: Db;
  bank: EnableBanking;
  tracker: ExpenseTracker;
  redirectUrl: string;
  fetchDays: number;
  now?: () => Date;
  /** One line per fetch: what was imported, or why it failed */
  log?: (line: string) => void;
}

export function createService({
  db,
  bank,
  tracker,
  redirectUrl,
  fetchDays,
  now = () => new Date(),
  log = console.log,
}: ServiceOptions) {
  function timestamp() {
    return now().toISOString();
  }
  const connections = createConnectionStore(db, timestamp);
  const attempts = createAttemptStore(db, timestamp);
  const login = createBankLogin({ bank, connections, redirectUrl, now });
  const importConnection = createImporter({ bank, tracker, attempts, fetchDays, now, log });

  // a fetch runs inside one request: a running attempt at startup was cut off by a restart
  attempts.abandonRunning();

  function requireConnection(id: string): StoredConnection {
    const connection = connections.get(id);
    if (!connection) throw new NotFoundError('Connection not found');
    return connection;
  }

  function connectionForApi(connection: StoredConnection) {
    return toConnection(connection, attempts.lastOf(connection.id), now());
  }

  function getConnection(id: string) {
    return connectionForApi(requireConnection(id));
  }

  return {
    async listBanks(country: string) {
      return (await bank.aspsps(country)).map(toBank);
    },

    listConnections() {
      return connections.all().map(connectionForApi);
    },

    getConnection,

    async createConnection(input: { bank: string; country: string; psuType: PsuType; accountName?: string }) {
      const id = randomUUID();
      connections.insert({ ...input, id, accountName: input.accountName ?? input.bank.toLowerCase() });
      try {
        const authUrl = await login.start(requireConnection(id));
        return { connection: getConnection(id), authUrl };
      } catch (err) {
        connections.delete(id);
        throw err;
      }
    },

    /** A new bank login for an existing connection, e.g. when its access has expired. */
    async authorize(id: string) {
      return { authUrl: await login.start(requireConnection(id)) };
    },

    async completeAuth(callback: LoginCallback) {
      return getConnection(await login.complete(callback));
    },

    updateConnection(id: string, patch: { accountName?: string; enabled?: boolean }) {
      const connection = requireConnection(id);
      connections.update(id, {
        accountName: patch.accountName ?? connection.accountName,
        enabled: patch.enabled ?? connection.enabled,
      });
      return getConnection(id);
    },

    /** Revokes the bank access, then forgets the connection; its attempts stay in the log. */
    async deleteConnection(id: string) {
      await login.revoke(requireConnection(id));
      connections.delete(id);
    },

    /** The given connection, or every enabled one, one after another; psu is null for scheduled fetches. */
    async fetch({ mode, psu, connectionId }: { mode: Mode; psu: Psu | null; connectionId?: string }) {
      const toFetch = connectionId
        ? [requireConnection(connectionId)]
        : connections.all().filter((connection) => connection.enabled);
      const results = [];
      for (const connection of toFetch) results.push(await importConnection(connection, mode, psu));
      return results;
    },

    listAttempts: attempts.list,
  };
}

export type Service = ReturnType<typeof createService>;
