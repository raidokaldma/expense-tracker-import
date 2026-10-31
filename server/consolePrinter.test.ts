import { expect, it } from 'vitest';
import { createConsolePrinter } from './consolePrinter.ts';

it('prints the rows and imports nothing', async () => {
  const lines: string[] = [];
  const printer = createConsolePrinter((line) => lines.push(line));
  const result = await printer.importRows([
    {
      externalId: 'ref-1',
      account: 'swedbank',
      occurredAt: '2026-10-23T00:00:00.000+03:00',
      counterparty: 'JANE ROE',
      amount: -1180,
      description: 'Lunch',
    },
  ]);
  expect(result).toEqual({ printed: true });
  expect(lines).toEqual(['2026-10-23T00:00:00.000+03:00      -11.80  swedbank  ref-1  JANE ROE  Lunch']);
});
