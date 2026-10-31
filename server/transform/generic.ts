import type { BankTransaction } from '../enableBankingTypes.ts';
import {
  amountOf,
  cleanCounterparty,
  cleanDescription,
  midnight,
  otherParty,
  type RowWithoutAccount,
} from './common.ts';

/** Any other bank: the standard fields, nothing bank-specific. */
export function generic(transaction: BankTransaction): RowWithoutAccount | null {
  const id = transaction.entry_reference ?? transaction.transaction_id;
  const date = transaction.transaction_date ?? transaction.booking_date ?? transaction.value_date;
  if (!id || !date) return null;
  const details = transaction.remittance_information ?? [];
  const counterparty = cleanCounterparty(otherParty(transaction) ?? details[0]) ?? 'Unknown';
  const description = cleanDescription(details.join(' '));
  return {
    externalId: id,
    occurredAt: midnight(date),
    counterparty,
    amount: amountOf(transaction),
    description: description === counterparty ? undefined : description,
  };
}
