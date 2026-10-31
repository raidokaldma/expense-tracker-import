import type { PsuType } from '../shared/types.ts';

/**
 * The PSU (payment service user, the account holder) present right now: sent as PSU headers, so the bank doesn't
 * count the call toward its 4/day limit for unattended access.
 */
export interface Psu {
  ipAddress: string;
  userAgent: string;
}

/** An ASPSP (account servicing payment service provider): a bank whose accounts Enable Banking can read. */
export interface Aspsp {
  name: string;
  country: string;
  /** The kinds of customer it has a login for */
  psu_types: PsuType[];
  /** The longest the access (consent) the user gives can last, in seconds */
  maximum_consent_validity: number;
}

export interface SessionAccount {
  /** Enable Banking's id for the account, used to fetch its transactions */
  uid: string;
  account_id?: { iban?: string | null } | null;
  currency?: string;
  name?: string | null;
}

/** The access a bank login gives: the accounts it covers, until the consent expires. */
export interface Session {
  session_id: string;
  accounts: SessionAccount[];
  access: { valid_until: string };
}

/** The fields the transforms use; the API returns more. */
export interface BankTransaction {
  /** The bank's own reference for the entry */
  entry_reference?: string | null;
  transaction_id?: string | null;
  /** Always positive; credit_debit_indicator gives the direction */
  transaction_amount: { currency: string; amount: string };
  /** CRDT: money came in; DBIT: money went out */
  credit_debit_indicator: 'CRDT' | 'DBIT';
  /** BOOK: booked; PDNG: pending */
  status?: string;
  /** When the bank booked it */
  booking_date?: string | null;
  /** When the money counts as moved, for interest */
  value_date?: string | null;
  /** When it happened, e.g. the card purchase */
  transaction_date?: string | null;
  /** Who received the money */
  creditor?: { name?: string | null } | null;
  /** Who paid */
  debtor?: { name?: string | null } | null;
  /** The payment details as free text lines: description, reference number */
  remittance_information?: string[] | null;
  /** The kind of transaction in the bank's own codes, e.g. Revolut's CARD_PAYMENT */
  bank_transaction_code?: { code?: string | null } | null;
}
