import { z } from 'zod';

export const COUNTRY_CODE = /^[A-Z]{2}$/;

const name = z.string().trim().min(1).max(100);

export const createConnectionSchema = z.strictObject({
  /** The bank's name as in GET /api/import/connections/banks, e.g. "Swedbank" */
  bank: name,
  country: z.string().regex(COUNTRY_CODE, 'must be a country code, e.g. EE'),
  psuType: z.enum(['personal', 'business']).default('personal'),
  /** The expense-tracker account; defaults to the bank name in lower case */
  accountName: name.optional(),
});

export const patchConnectionSchema = z.strictObject({
  accountName: name.optional(),
  enabled: z.boolean().optional(),
});

export const fetchSchema = z.strictObject({
  mode: z.enum(['user', 'scheduled']),
  connectionId: z.uuid().optional(),
});
