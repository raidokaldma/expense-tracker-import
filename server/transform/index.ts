import type { BankTransaction } from '../enableBankingTypes.ts';
import type { ImportRow } from '../expenseTracker.ts';
import type { Transform } from './common.ts';
import { generic } from './generic.ts';
import { revolut } from './revolut.ts';
import { swedbank } from './swedbank.ts';

/** expense-tracker keeps amounts without a currency; they are all euros. */
const CURRENCY = 'EUR';

function transformFor(bank: { name: string; country: string }): Transform {
  if (bank.name === 'Swedbank' && bank.country === 'EE') return swedbank;
  if (bank.name === 'Revolut') return revolut;
  return generic;
}

/** Rows for expense-tracker's import; transactions without an id or in another currency are left out. */
export function toImportRows(
  bank: { name: string; country: string },
  account: string,
  transactions: BankTransaction[],
): ImportRow[] {
  const transform = transformFor(bank);
  return transactions
    .filter((transaction) => transaction.transaction_amount.currency === CURRENCY)
    .map(transform)
    .filter((row) => row !== null)
    .map((row) => ({ ...row, account }));
}
