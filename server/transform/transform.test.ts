import { describe, expect, it } from 'vitest';
import type { BankTransaction } from '../enableBankingTypes.ts';
import { toImportRows } from './index.ts';

function tx(overrides: Partial<BankTransaction>): BankTransaction {
  return {
    entry_reference: 'ref-1',
    transaction_amount: { currency: 'EUR', amount: '12.50' },
    credit_debit_indicator: 'DBIT',
    status: 'BOOK',
    booking_date: '2026-07-31',
    value_date: '2026-07-31',
    ...overrides,
  };
}

function swedbank(overrides: Partial<BankTransaction>) {
  return toImportRows({ name: 'Swedbank', country: 'EE' }, 'swedbank', [tx(overrides)]);
}

function revolut(overrides: Partial<BankTransaction>) {
  return toImportRows({ name: 'Revolut', country: 'LT' }, 'revolut', [tx(overrides)]);
}

function generic(overrides: Partial<BankTransaction>) {
  return toImportRows({ name: 'LHV Pank', country: 'EE' }, 'lhv', [tx(overrides)]);
}

describe('Swedbank', () => {
  it('takes the shop and purchase date from a card payment', () => {
    expect(
      swedbank({
        entry_reference: '2026073100000001-1',
        transaction_date: '2026-07-29',
        debtor: { name: 'JOHN DOE' },
        remittance_information: ['516737******1234 29.07.26 APPLE.COM/BILL   CORK'],
      }),
    ).toEqual([
      {
        externalId: '2026073100000001',
        account: 'swedbank',
        occurredAt: '2026-07-29T00:00:00.000+03:00',
        counterparty: 'APPLE.COM/BILL CORK',
        amount: -1250,
        description: undefined,
      },
    ]);
  });

  it('keeps the exchange rate of a card payment in another currency as the description', () => {
    const [row] = swedbank({
      remittance_information: [
        '516737******1234 07.10.26 49.99 USD VAHETUSKURSS: 1.156908, KONVERTEERIMISTASU 0.43 EUR WEB SHOP NEW YORK',
      ],
    });
    expect(row.counterparty).toBe('WEB SHOP NEW YORK');
    expect(row.description).toBe('49.99 USD VAHETUSKURSS: 1.156908, KONVERTEERIMISTASU 0.43 EUR WEB SHOP NEW YORK');
    expect(row.occurredAt).toBe('2026-10-07T00:00:00.000+03:00');
  });

  it('uses the payer and the first line of the details for an incoming payment', () => {
    const [row] = swedbank({
      credit_debit_indicator: 'CRDT',
      creditor: { name: 'JOHN DOE' },
      debtor: { name: 'City Office' },
      remittance_information: ['School allowance', '1234567890'],
    });
    expect(row).toMatchObject({
      counterparty: 'City Office',
      amount: 1250,
      description: 'School allowance',
    });
  });

  it('falls back to Swedbank as the counterparty and drops a repeated description', () => {
    expect(swedbank({ remittance_information: ['Monthly fee'] })[0].counterparty).toBe('Swedbank');
    expect(
      swedbank({ creditor: { name: 'PHONE CO' }, remittance_information: ['PHONE CO'] })[0].description,
    ).toBeUndefined();
  });

  it('skips a pending payment without an id', () => {
    expect(swedbank({ entry_reference: null, status: 'PDNG', booking_date: null })).toEqual([]);
  });
});

describe('Revolut', () => {
  it('uses the merchant from the details for a card payment', () => {
    expect(
      revolut({
        entry_reference: '00000000-0000-4000-8000-000000000001',
        bank_transaction_code: { code: 'CARD_PAYMENT' },
        creditor: { name: 'Store Legal Name Ou' },
        debtor: { name: 'John Doe' },
        remittance_information: ['The Store'],
        booking_date: '2026-10-14',
      }),
    ).toEqual([
      {
        externalId: '00000000-0000-4000-8000-000000000001',
        account: 'revolut',
        occurredAt: '2026-10-14T00:00:00.000+03:00',
        counterparty: 'The Store',
        amount: -1250,
        description: 'The Store',
      },
    ]);
  });

  it('names the merchant of a refund', () => {
    const [row] = revolut({
      credit_debit_indicator: 'CRDT',
      bank_transaction_code: { code: 'CARD_REFUND' },
      debtor: { name: 'John Doe' },
      remittance_information: ['Refund from The Cafe'],
    });
    expect(row).toMatchObject({ counterparty: 'The Cafe', amount: 1250 });
  });

  it('uses the sender and their comment for an incoming transfer', () => {
    const [row] = revolut({
      credit_debit_indicator: 'CRDT',
      bank_transaction_code: { code: 'TRANSFER' },
      debtor: { name: 'Jane Roe' },
      remittance_information: ['Kebab', 'From Jane R'],
    });
    expect(row).toMatchObject({ counterparty: 'Jane Roe', description: 'Kebab' });
  });

  it('imports a pending transaction that has an id', () => {
    expect(revolut({ status: 'PDNG', remittance_information: ['Top-Up'] })).toHaveLength(1);
  });

  it('skips other currencies', () => {
    expect(revolut({ transaction_amount: { currency: 'USD', amount: '1.00' } })).toEqual([]);
  });
});

describe('other banks', () => {
  it('uses the standard fields', () => {
    expect(
      generic({
        transaction_id: 'tx-9',
        entry_reference: null,
        transaction_date: '2026-03-01',
        creditor: { name: 'Landlord' },
        remittance_information: ['Rent', 'March'],
      }),
    ).toEqual([
      {
        externalId: 'tx-9',
        account: 'lhv',
        occurredAt: '2026-03-01T00:00:00.000+02:00',
        counterparty: 'Landlord',
        amount: -1250,
        description: 'Rent March',
      },
    ]);
  });

  it('removes control characters and falls back to Unknown', () => {
    const [row] = generic({ remittance_information: null, creditor: { name: ' \u0007 ' } });
    expect(row.counterparty).toBe('Unknown');
    expect(row.description).toBeUndefined();
  });
});
