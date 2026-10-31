// What the API returns; the server builds these, the browser shows them.

/** user: someone asked for the fetch just now; scheduled: unattended */
export type Mode = 'user' | 'scheduled';

/** The kind of customer login at the bank (PSU: payment service user) */
export type PsuType = 'personal' | 'business';

/** pending: waiting for the first bank login; failed: that login failed */
export type ConnectionStatus = 'pending' | 'active' | 'failed';

export type AttemptStatus = 'running' | 'success' | 'error';

export interface Bank {
  name: string;
  country: string;
  psuTypes: PsuType[];
  /** How long the access (consent) the user gives can last */
  maximumConsentDays: number;
}

export interface Attempt {
  id: number;
  /** null once the connection is deleted */
  connectionId: string | null;
  /** "Swedbank EE" */
  bank: string;
  mode: Mode;
  status: AttemptStatus;
  startedAt: string;
  finishedAt: string | null;
  /** Transactions the bank returned */
  fetched: number | null;
  /** Rows sent to expense-tracker */
  sent: number | null;
  /** The console printer stood in for expense-tracker; added, skipped and conflicts are then null */
  printed: boolean;
  added: number | null;
  skipped: number | null;
  conflicts: Conflict[] | null;
  error: string | null;
}

/** A row expense-tracker already has with another amount; it kept its own. */
export interface Conflict {
  externalId: string;
  /** Hundredths */
  sentAmount: number;
  savedAmount: number;
  /** Missing on older attempts */
  row?: { occurredAt: string; counterparty: string; description?: string };
}

export interface BankAccount {
  uid: string;
  iban: string | null;
  currency: string | null;
  name: string | null;
}

export interface Connection {
  id: string;
  bank: string;
  country: string;
  psuType: PsuType;
  /** The expense-tracker account the rows go to */
  accountName: string;
  enabled: boolean;
  status: ConnectionStatus;
  validUntil: string | null;
  expired: boolean;
  accounts: BankAccount[];
  /** Why the last bank login failed */
  error: string | null;
  createdAt: string;
  updatedAt: string;
  lastAttempt: Attempt | null;
}
