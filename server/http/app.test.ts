import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate, openDatabase } from '../db/database.ts';
import { type EnableBanking, EnableBankingError } from '../enableBanking.ts';
import type { ExpenseTracker, ImportResult } from '../expenseTracker.ts';
import { createService } from '../service.ts';
import { createApp } from './app.ts';

const NOW = new Date('2026-10-27T12:00:00Z');

const SWEDBANK = { name: 'Swedbank', country: 'EE', psu_types: ['personal'], maximum_consent_validity: 15_552_000 };

const SESSION = {
  session_id: 'session-1',
  access: { valid_until: '2027-04-25T12:00:00Z' },
  accounts: [{ uid: 'account-1', account_id: { iban: 'EE001' }, currency: 'EUR' }],
};

const TRANSACTIONS = [
  {
    entry_reference: '2026102300000002-1',
    transaction_amount: { currency: 'EUR', amount: '11.80' },
    credit_debit_indicator: 'DBIT' as const,
    booking_date: '2026-10-23',
    creditor: { name: 'JANE ROE' },
    remittance_information: ['Lunch'],
  },
  {
    entry_reference: null,
    transaction_amount: { currency: 'EUR', amount: '500.00' },
    credit_debit_indicator: 'DBIT' as const,
    status: 'PDNG',
  },
];

const IMPORTED_ONE: ImportResult = { printed: false, summary: { added: 1, skipped: 0, ignoredConflicts: [] } };

// what @hono/node-server passes: the client's socket
const CLIENT = { incoming: { socket: { remoteAddress: '192.168.1.5', remotePort: 50000, remoteFamily: 'IPv4' } } };

// biome-ignore lint/suspicious/noExplicitAny: test responses are checked by their assertions
type JsonResponse = Omit<Response, 'json'> & { json(): Promise<any> };

function setup() {
  const bank = {
    aspsps: vi.fn(async () => [SWEDBANK]),
    startAuth: vi.fn(async (_body: { state: string }) => 'https://bank.example/login'),
    createSession: vi.fn(async (_code: string) => SESSION),
    deleteSession: vi.fn(async (_sessionId: string) => {}),
    transactions: vi.fn(async (_uid: string, _dateFrom: string, _psu: unknown) => TRANSACTIONS),
  };
  const log = vi.fn((_line: string) => {});
  const tracker = {
    importRows: vi.fn(async (_rows: unknown[]): Promise<ImportResult> => IMPORTED_ONE),
  };
  const db = openDatabase(':memory:');
  migrate(db);
  const service = createService({
    db,
    bank: bank as unknown as EnableBanking,
    tracker: tracker as unknown as ExpenseTracker,
    redirectUrl: 'https://localhost:3000/api/import/connections/callback',
    fetchDays: 60,
    now: () => NOW,
    log,
  });
  const app = createApp({ service });
  function request(method: string, path: string, body?: object) {
    return app.request(
      path,
      {
        method,
        headers: { 'content-type': 'application/json', 'user-agent': 'test-agent' },
        body: body && JSON.stringify(body),
      },
      CLIENT,
    ) as Promise<JsonResponse>;
  }
  async function getJson(path: string) {
    return (await request('GET', path)).json();
  }
  return { bank, tracker, request, getJson, app, log };
}

type Fixture = ReturnType<typeof setup>;

/** Adds Swedbank and completes its login; returns the connection id. */
async function connect(fixture: Fixture) {
  const response = await fixture.request('POST', '/api/import/connections', { bank: 'Swedbank', country: 'EE' });
  const { connection } = await response.json();
  const { state } = fixture.bank.startAuth.mock.calls.at(-1)![0];
  await fixture.app.request(`/api/import/connections/callback?state=${state}&code=the-code`);
  return connection.id as string;
}

describe('connections', () => {
  let fixture: Fixture;
  beforeEach(() => {
    fixture = setup();
  });

  it('sends the browser back with the error of an unknown login', async () => {
    const response = await fixture.app.request('/api/import/connections/callback?state=nope&code=x');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      `/import?loginError=${encodeURIComponent('Unknown or already used login: start it again')}`,
    );
  });

  it('adds a bank, asking for the longest access it allows', async () => {
    const response = await fixture.request('POST', '/api/import/connections', { bank: 'Swedbank', country: 'EE' });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.authUrl).toBe('https://bank.example/login');
    expect(body.connection).toMatchObject({ bank: 'Swedbank', accountName: 'swedbank', status: 'pending' });
    expect(fixture.bank.startAuth.mock.calls[0][0]).toMatchObject({
      validUntil: '2027-04-25T12:00:00.000Z',
      redirectUrl: 'https://localhost:3000/api/import/connections/callback',
    });
  });

  it('refuses a bank Enable Banking does not have, and saves nothing', async () => {
    const response = await fixture.request('POST', '/api/import/connections', { bank: 'Nobank', country: 'EE' });
    expect(response.status).toBe(422);
    expect(await fixture.getJson('/api/import/connections')).toEqual([]);
  });

  it('redirects / to the page and answers 404 elsewhere', async () => {
    const response = await fixture.app.request('/');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/import');
    expect((await fixture.request('GET', '/elsewhere')).status).toBe(404);
  });

  it('stores the session from the callback and returns to the page', async () => {
    await fixture.request('POST', '/api/import/connections', { bank: 'Swedbank', country: 'EE' });
    const { state } = fixture.bank.startAuth.mock.calls[0][0];
    const response = await fixture.app.request(`/api/import/connections/callback?state=${state}&code=the-code`);
    const [{ id }] = await fixture.getJson('/api/import/connections');
    expect(response.headers.get('location')).toBe(`/import?connected=${id}`);
    const connection = await fixture.getJson(`/api/import/connections/${id}`);
    expect(connection).toMatchObject({
      status: 'active',
      validUntil: '2027-04-25T12:00:00Z',
      expired: false,
      accounts: [{ uid: 'account-1', iban: 'EE001', currency: 'EUR' }],
      lastAttempt: null,
    });
  });

  it('marks a refused login as failed', async () => {
    await fixture.request('POST', '/api/import/connections', { bank: 'Swedbank', country: 'EE' });
    const { state } = fixture.bank.startAuth.mock.calls[0][0];
    const response = await fixture.app.request(`/api/import/connections/callback?state=${state}&error=access_denied`);
    expect(response.headers.get('location')).toBe(
      `/import?loginError=${encodeURIComponent('Swedbank EE login failed: access_denied')}`,
    );
    const [connection] = await fixture.getJson('/api/import/connections');
    expect(connection).toMatchObject({ status: 'failed', error: 'access_denied' });
  });

  it('edits the account name and the enabled flag', async () => {
    const id = await connect(fixture);
    const response = await fixture.request('PATCH', `/api/import/connections/${id}`, {
      accountName: 'Swed',
      enabled: false,
    });
    expect(await response.json()).toMatchObject({ accountName: 'Swed', enabled: false });
  });

  it('revokes the session when deleting, and keeps the attempts', async () => {
    const id = await connect(fixture);
    await fixture.request('POST', '/api/import/fetch', { mode: 'scheduled' });
    expect((await fixture.request('DELETE', `/api/import/connections/${id}`)).status).toBe(204);
    expect(fixture.bank.deleteSession).toHaveBeenCalledWith('session-1');
    expect(await fixture.getJson('/api/import/connections')).toEqual([]);
    const [attempt] = await fixture.getJson('/api/import/attempts');
    expect(attempt).toMatchObject({ connectionId: null, bank: 'Swedbank EE' });
  });

  it('revokes the old session after logging in again', async () => {
    const id = await connect(fixture);
    fixture.bank.createSession.mockResolvedValueOnce({ ...SESSION, session_id: 'session-2' });
    await fixture.request('POST', `/api/import/connections/${id}/authorize`, {});
    const { state } = fixture.bank.startAuth.mock.calls.at(-1)![0];
    await fixture.app.request(`/api/import/connections/callback?state=${state}&code=new-code`);
    expect(fixture.bank.deleteSession).toHaveBeenCalledWith('session-1');
    expect(await fixture.getJson(`/api/import/connections/${id}`)).toMatchObject({ status: 'active' });
  });

  it('refuses writes that are not JSON', async () => {
    const response = await fixture.app.request('/api/import/fetch', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{"mode":"scheduled"}',
    });
    expect(response.status).toBe(415);
  });

  it('keeps the connection when the bank cannot revoke it', async () => {
    const id = await connect(fixture);
    fixture.bank.deleteSession.mockRejectedValueOnce(new EnableBankingError(503, 'down'));
    expect((await fixture.request('DELETE', `/api/import/connections/${id}`)).status).toBe(502);
    expect(await fixture.getJson('/api/import/connections')).toHaveLength(1);
  });
});

describe('fetch', () => {
  let fixture: Fixture;
  beforeEach(() => {
    fixture = setup();
  });

  it('imports the transformed rows and logs the attempt', async () => {
    const id = await connect(fixture);
    const response = await fixture.request('POST', '/api/import/fetch', { mode: 'scheduled' });
    const [attempt] = await response.json();
    expect(attempt).toMatchObject({
      connectionId: id,
      mode: 'scheduled',
      status: 'success',
      fetched: 2,
      sent: 1,
      added: 1,
      skipped: 0,
      conflicts: [],
    });
    expect(fixture.bank.transactions).toHaveBeenCalledWith('account-1', '2026-08-28', null);
    expect(fixture.tracker.importRows).toHaveBeenCalledWith([
      {
        externalId: '2026102300000002',
        account: 'swedbank',
        occurredAt: '2026-10-23T00:00:00.000+03:00',
        counterparty: 'JANE ROE',
        amount: -1180,
        description: 'Lunch',
      },
    ]);
    const connection = await fixture.getJson(`/api/import/connections/${id}`);
    expect(connection.lastAttempt.id).toBe(attempt.id);
    expect(fixture.log).toHaveBeenCalledWith(
      'Swedbank EE (scheduled) → swedbank: 2 fetched, 1 sent, 1 added, 0 skipped, 0 conflicts',
    );
  });

  it('logs no import result when the rows are only printed', async () => {
    await connect(fixture);
    fixture.tracker.importRows.mockResolvedValueOnce({ printed: true });
    const [attempt] = await (await fixture.request('POST', '/api/import/fetch', { mode: 'scheduled' })).json();
    expect(attempt).toMatchObject({
      status: 'success',
      printed: true,
      fetched: 2,
      sent: 1,
      added: null,
      skipped: null,
      conflicts: null,
    });
    expect(fixture.log).toHaveBeenCalledWith(
      'Swedbank EE (scheduled) → swedbank: 2 fetched, 1 sent, printed, not imported',
    );
  });

  it('sends the PSU headers only when a user asks', async () => {
    await connect(fixture);
    await fixture.request('POST', '/api/import/fetch', { mode: 'user' });
    expect(fixture.bank.transactions.mock.calls[0]).toEqual([
      'account-1',
      '2026-08-28',
      { ipAddress: '192.168.1.5', userAgent: 'test-agent' },
    ]);
  });

  it('logs a failure with its error', async () => {
    await connect(fixture);
    fixture.bank.transactions.mockRejectedValueOnce(new Error('ASPSP rate limit exceeded'));
    const [attempt] = await (await fixture.request('POST', '/api/import/fetch', { mode: 'scheduled' })).json();
    expect(attempt).toMatchObject({ status: 'error', error: 'ASPSP rate limit exceeded', fetched: null });
    expect(fixture.log).toHaveBeenCalledWith('Swedbank EE (scheduled) → swedbank: failed: ASPSP rate limit exceeded');
  });

  it('reports expired access instead of fetching', async () => {
    fixture.bank.createSession.mockResolvedValueOnce({ ...SESSION, access: { valid_until: '2026-10-01T00:00:00Z' } });
    const id = await connect(fixture);
    expect(await fixture.getJson(`/api/import/connections/${id}`)).toMatchObject({ expired: true });
    const [attempt] = await (await fixture.request('POST', '/api/import/fetch', { mode: 'scheduled' })).json();
    expect(attempt).toMatchObject({
      status: 'error',
      error: 'Bank access expired 2026-10-01T00:00:00Z: authorize again',
    });
    expect(fixture.bank.transactions).not.toHaveBeenCalled();
  });

  it('skips disabled connections and reports one that has no session', async () => {
    const id = await connect(fixture);
    await fixture.request('PATCH', `/api/import/connections/${id}`, { enabled: false });
    expect(await (await fixture.request('POST', '/api/import/fetch', { mode: 'scheduled' })).json()).toEqual([]);

    const response = await fixture.request('POST', '/api/import/connections', { bank: 'Swedbank', country: 'EE' });
    const pending = (await response.json()).connection.id;
    const [attempt] = await (
      await fixture.request('POST', '/api/import/fetch', { mode: 'scheduled', connectionId: pending })
    ).json();
    expect(attempt).toMatchObject({ status: 'error', error: 'Not connected yet: finish the bank login first' });
  });
});
