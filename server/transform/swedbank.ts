import type { BankTransaction } from '../enableBankingTypes.ts';
import {
  amountOf,
  cleanCounterparty,
  cleanDescription,
  midnight,
  otherParty,
  type RowWithoutAccount,
} from './common.ts';

/** "516737******1234 29.07.26 THE SHOP TALLINN" → the purchase date and the shop */
const CARD_PAYMENT = /^'?\d{6}\*+\d{4}\s+(\d{2})\.(\d{2})\.(\d{2})\s+(.+)/s;
/** "49.99 USD VAHETUSKURSS: 1.156908, KONVERTEERIMISTASU 0.43 EUR WEB SHOP NEW YORK" → the shop */
const FOREIGN_CURRENCY = /^[\d.]+ [A-Z]{3} VAHETUSKURSS: [\d.]+, KONVERTEERIMISTASU [\d.]+ EUR (.+)/s;

function parseCardPayment(details: string): { date: string; shop: string; description?: string } | null {
  const card = details.match(CARD_PAYMENT);
  if (!card) return null;
  const [, day, month, year, rest] = card;
  const date = `20${year}-${month}-${day}`;
  const foreign = rest.match(FOREIGN_CURRENCY);
  return foreign ? { date, shop: foreign[1], description: rest } : { date, shop: rest };
}

/**
 * Matches Swedbank's CSV export, so rows imported from it are recognized:
 * - id: the bank's reference without the "-1" Enable Banking adds (the CSV's "Transfer reference")
 * - description: the first line of the details; a second one is the reference number, a separate CSV column
 * - card payments: the shop is the counterparty, the purchase date (not the booking date) is the date;
 *   in another currency the details with the exchange rate are the description
 * - no counterparty: "Swedbank" (fees, interest); description dropped when it repeats the counterparty
 */
export function swedbank(transaction: BankTransaction): RowWithoutAccount | null {
  if (!transaction.entry_reference) return null; // pending card payments have no id yet
  const [details = ''] = transaction.remittance_information ?? [];
  const card = parseCardPayment(details);
  const date = card?.date ?? transaction.booking_date ?? transaction.value_date;
  if (!date) return null;
  const counterparty = cleanCounterparty(card ? card.shop : otherParty(transaction)) ?? 'Swedbank';
  const description = cleanDescription(card ? card.description : details);
  return {
    externalId: transaction.entry_reference.replace(/-1$/, ''),
    occurredAt: midnight(date),
    counterparty,
    amount: amountOf(transaction),
    description: description === counterparty ? undefined : description,
  };
}
