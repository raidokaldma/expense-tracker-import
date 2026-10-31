import { TZDate } from '@date-fns/tz';
import type { BankTransaction } from '../enableBankingTypes.ts';
import type { ImportRow } from '../expenseTracker.ts';

/** Banks give dates without a time; they become midnight here. */
const TIME_ZONE = 'Europe/Tallinn';

export type RowWithoutAccount = Omit<ImportRow, 'account'>;

/** null when the transaction can't be imported */
export type Transform = (transaction: BankTransaction) => RowWithoutAccount | null;

/** Collapses whitespace and control characters (expense-tracker rejects the latter); undefined when empty. */
function clean(value: string | null | undefined, maxLength: number): string | undefined {
  const text = (value ?? '').replace(/[\p{Cc}\s]+/gu, ' ').trim();
  return text.slice(0, maxLength).trim() || undefined;
}

export function cleanCounterparty(value: string | null | undefined) {
  return clean(value, 200);
}

export function cleanDescription(value: string | null | undefined) {
  return clean(value, 1000);
}

/** "2026-07-29" → "2026-07-29T00:00:00.000+03:00" */
export function midnight(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new TZDate(year, month - 1, day, TIME_ZONE).toISOString();
}

/** Hundredths, negative when money leaves the account. */
export function amountOf(transaction: BankTransaction) {
  const sign = transaction.credit_debit_indicator === 'DBIT' ? -1 : 1;
  return Math.round(Math.abs(Number(transaction.transaction_amount.amount)) * 100) * sign;
}

/** The payee of a payment, the payer of an incoming one. */
export function otherParty(transaction: BankTransaction) {
  return transaction.credit_debit_indicator === 'DBIT' ? transaction.creditor?.name : transaction.debtor?.name;
}
