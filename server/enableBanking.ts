import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { PsuType } from '../shared/types.ts';
import type { Aspsp, BankTransaction, Psu, Session } from './enableBankingTypes.ts';

const API = 'https://api.enablebanking.com';

export class EnableBankingError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createEnableBanking({ applicationId, keyFile }: { applicationId: string; keyFile: string }) {
  const privateKey = readFileSync(keyFile);

  function jwt() {
    function base64Url(value: object) {
      return Buffer.from(JSON.stringify(value)).toString('base64url');
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = { typ: 'JWT', alg: 'RS256', kid: applicationId };
    const claims = { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: issuedAt, exp: issuedAt + 3600 };
    const data = `${base64Url(header)}.${base64Url(claims)}`;
    return `${data}.${createSign('RSA-SHA256').update(data).sign(privateKey, 'base64url')}`;
  }

  async function call<T>(method: string, path: string, options: { body?: object; psu?: Psu | null } = {}): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' };
    if (options.psu) {
      headers['psu-ip-address'] = options.psu.ipAddress;
      headers['psu-user-agent'] = options.psu.userAgent;
    }
    const response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: options.body && JSON.stringify(options.body),
    });
    const text = await response.text();
    if (!response.ok)
      throw new EnableBankingError(response.status, `Enable Banking ${method} ${path}: ${response.status} ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    async aspsps(country: string): Promise<Aspsp[]> {
      return (await call<{ aspsps: Aspsp[] }>('GET', `/aspsps?country=${encodeURIComponent(country)}`)).aspsps;
    },

    async startAuth(body: {
      aspsp: { name: string; country: string };
      psuType: PsuType;
      validUntil: string;
      state: string;
      redirectUrl: string;
    }): Promise<string> {
      const { url } = await call<{ url: string }>('POST', '/auth', {
        body: {
          access: { valid_until: body.validUntil },
          aspsp: body.aspsp,
          state: body.state,
          redirect_url: body.redirectUrl,
          psu_type: body.psuType,
        },
      });
      return url;
    },

    createSession: (code: string) => call<Session>('POST', '/sessions', { body: { code } }),

    deleteSession: (sessionId: string) => call<void>('DELETE', `/sessions/${sessionId}`),

    /** Every page from dateFrom (YYYY-MM-DD) until today. */
    async transactions(accountUid: string, dateFrom: string, psu: Psu | null): Promise<BankTransaction[]> {
      const all: BankTransaction[] = [];
      let continuationKey: string | null | undefined;
      do {
        const query = new URLSearchParams({ date_from: dateFrom });
        if (continuationKey) query.set('continuation_key', continuationKey);
        // continuation_key: there is a next page, asked for with this key
        const page = await call<{ transactions: BankTransaction[]; continuation_key?: string | null }>(
          'GET',
          `/accounts/${accountUid}/transactions?${query}`,
          { psu },
        );
        all.push(...page.transactions);
        continuationKey = page.continuation_key;
      } while (continuationKey);
      return all;
    },
  };
}

export type EnableBanking = ReturnType<typeof createEnableBanking>;
