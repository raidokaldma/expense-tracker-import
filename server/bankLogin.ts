import { randomUUID } from 'node:crypto';
import { messageOf } from '../shared/errors.ts';
import { bankLabel, type ConnectionStore, type StoredConnection } from './db/connectionStore.ts';
import { type EnableBanking, EnableBankingError } from './enableBanking.ts';
import type { Session } from './enableBankingTypes.ts';
import { BankUnavailableError, InvalidRequestError, LoginError } from './errors.ts';

export interface LoginCallback {
  state?: string;
  code?: string;
  error?: string;
  errorDescription?: string;
}

export function createBankLogin({
  bank,
  connections,
  redirectUrl,
  now,
}: {
  bank: EnableBanking;
  connections: ConnectionStore;
  redirectUrl: string;
  now: () => Date;
}) {
  async function aspspOf(connection: StoredConnection) {
    const aspsps = await bank.aspsps(connection.country);
    const aspsp = aspsps.find((candidate) => candidate.name === connection.bank);
    if (!aspsp)
      throw new InvalidRequestError(`Enable Banking has no bank “${connection.bank}” in ${connection.country}`);
    return aspsp;
  }

  function secondsFromNow(seconds: number) {
    return new Date(now().getTime() + seconds * 1000).toISOString();
  }

  async function createSession(connection: StoredConnection, code: string): Promise<Session> {
    try {
      return await bank.createSession(code);
    } catch (err) {
      connections.loginFailed(connection.id, messageOf(err));
      throw err;
    }
  }

  // the new login replaces the old one; it would otherwise stay valid until it expires
  async function revokeReplaced(connection: StoredConnection, session: Session) {
    if (connection.sessionId && connection.sessionId !== session.session_id)
      await bank.deleteSession(connection.sessionId).catch((err) => console.warn(`Revoking the old session: ${err}`));
  }

  return {
    /** Returns the bank's login page; the bank then sends the browser to the callback. */
    async start(connection: StoredConnection): Promise<string> {
      const aspsp = await aspspOf(connection);
      const state = randomUUID();
      const url = await bank.startAuth({
        aspsp: { name: aspsp.name, country: aspsp.country },
        psuType: connection.psuType,
        validUntil: secondsFromNow(aspsp.maximum_consent_validity),
        state,
        redirectUrl,
      });
      connections.setAuthState(connection.id, state);
      return url;
    },

    /** Turns the code from the callback into a session; returns the connection's id. */
    async complete(callback: LoginCallback): Promise<string> {
      const connection = callback.state ? connections.byAuthState(callback.state) : null;
      if (!connection) throw new LoginError('Unknown or already used login: start it again');
      if (!callback.code) {
        const error = [callback.error, callback.errorDescription].filter(Boolean).join(': ') || 'No code from the bank';
        connections.loginFailed(connection.id, error);
        throw new LoginError(`${bankLabel(connection)} login failed: ${error}`);
      }
      const session = await createSession(connection, callback.code);
      connections.authorized(connection.id, session);
      await revokeReplaced(connection, session);
      return connection.id;
    },

    async revoke(connection: StoredConnection) {
      if (!connection.sessionId) return;
      try {
        await bank.deleteSession(connection.sessionId);
      } catch (err) {
        // a 4xx: the session is already gone or expired, nothing left to revoke
        if (!(err instanceof EnableBankingError && err.status < 500))
          throw new BankUnavailableError(`Could not revoke the bank access, kept the connection: ${err}`);
      }
    },
  };
}
