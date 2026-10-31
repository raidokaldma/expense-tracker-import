import type { BankTransaction } from '../enableBankingTypes.ts';
import {
  amountOf,
  cleanCounterparty,
  cleanDescription,
  midnight,
  otherParty,
  type RowWithoutAccount,
} from './common.ts';

function merchantOf(code: string | null | undefined, details: string | undefined) {
  switch (code) {
    case 'CARD_PAYMENT':
      return details;
    case 'CARD_REFUND':
      return details?.replace(/^Refund from /, '');
    default:
      return undefined;
  }
}

/**
 * Close to what Revolut's own API gives. Enable Banking has less: no time of day, no merchant city or country, no
 * separate fee. So:
 * - id: Revolut's transaction id, the same as in its own API
 * - description: the first line of the details (Revolut's description, or the sender's comment)
 * - counterparty: for card payments and refunds the merchant from the details, otherwise the other person
 */
export function revolut(transaction: BankTransaction): RowWithoutAccount | null {
  const id = transaction.entry_reference ?? transaction.transaction_id;
  const date = transaction.booking_date ?? transaction.value_date;
  if (!id || !date) return null;
  const [first] = transaction.remittance_information ?? [];
  const merchant = merchantOf(transaction.bank_transaction_code?.code, first);
  return {
    externalId: id,
    occurredAt: midnight(date),
    counterparty: cleanCounterparty(merchant ?? otherParty(transaction) ?? first) ?? 'Revolut',
    amount: amountOf(transaction),
    description: cleanDescription(first),
  };
}
