import { DAY_SECONDS } from '../shared/time.ts';
import type { Attempt, Bank, Connection } from '../shared/types.ts';
import { isExpired, type StoredConnection } from './db/connectionStore.ts';
import type { Aspsp, SessionAccount } from './enableBankingTypes.ts';

export function toBank(aspsp: Aspsp): Bank {
  return {
    name: aspsp.name,
    country: aspsp.country,
    psuTypes: aspsp.psu_types,
    maximumConsentDays: Math.floor(aspsp.maximum_consent_validity / DAY_SECONDS),
  };
}

function toBankAccount(account: SessionAccount) {
  return {
    uid: account.uid,
    iban: account.account_id?.iban ?? null,
    currency: account.currency ?? null,
    name: account.name ?? null,
  };
}

export function toConnection(connection: StoredConnection, lastAttempt: Attempt | null, now: Date): Connection {
  return {
    id: connection.id,
    bank: connection.bank,
    country: connection.country,
    psuType: connection.psuType,
    accountName: connection.accountName,
    enabled: connection.enabled,
    status: connection.status,
    validUntil: connection.validUntil,
    expired: isExpired(connection, now),
    accounts: (connection.session?.accounts ?? []).map(toBankAccount),
    error: connection.error,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
    lastAttempt,
  };
}
