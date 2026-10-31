import { create } from 'zustand';
import { messageOf } from '../shared/errors';
import type { Attempt, Connection, PsuType } from '../shared/types';
import { api } from './api';
import { describeFetch } from './model/format';
import { showToast } from './toast';

interface State {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  connections: Connection[];
  attempts: Attempt[];
  fetchingAll: boolean;
  fetchingIds: string[];
}

export const useStore = create<State>(() => ({
  status: 'loading',
  error: null,
  connections: [],
  attempts: [],
  fetchingAll: false,
  fetchingIds: [],
}));

export function isFetching(state: State, connectionId: string) {
  return state.fetchingAll || state.fetchingIds.includes(connectionId);
}

/** Reads the connections and the log again; quietly, so it can run whenever the window regains focus. */
export async function refresh() {
  try {
    const [connections, attempts] = await Promise.all([api.connections(), api.attempts()]);
    useStore.setState({ status: 'ready', error: null, connections, attempts });
  } catch (err) {
    if (useStore.getState().status === 'loading') useStore.setState({ status: 'error', error: messageOf(err) });
    else showToast('Could not reach the server', { warn: true });
  }
}

/** Shows the action's error as a toast and reloads either way; null when it failed. */
async function run<T>(action: () => Promise<T>): Promise<{ value: T } | null> {
  try {
    return { value: await action() };
  } catch (err) {
    showToast(messageOf(err), { warn: true });
    return null;
  } finally {
    await refresh();
  }
}

function setFetching(connectionId: string | undefined, fetching: boolean) {
  if (connectionId === undefined) {
    useStore.setState({ fetchingAll: fetching });
    return;
  }
  useStore.setState((state) => ({
    fetchingIds: fetching
      ? [...state.fetchingIds, connectionId]
      : state.fetchingIds.filter((id) => id !== connectionId),
  }));
}

/** Fetches and imports now, as the user: the bank doesn't count it toward its daily limit. */
export async function fetchNow(connectionId?: string) {
  setFetching(connectionId, true);
  const result = await run(() => api.fetch('user', connectionId));
  setFetching(connectionId, false);
  if (!result) return;
  const { text, warn } = describeFetch(result.value);
  showToast(text, { warn });
}

async function goToBankLogin(startLogin: () => Promise<{ authUrl: string }>) {
  try {
    const { authUrl } = await startLogin();
    window.location.assign(authUrl);
  } catch (err) {
    showToast(messageOf(err), { warn: true });
  }
}

export function addBank(input: { bank: string; country: string; psuType: PsuType; accountName?: string }) {
  return goToBankLogin(() => api.addConnection(input));
}

export function logInAgain(id: string) {
  return goToBankLogin(() => api.authorize(id));
}

export async function updateConnection(id: string, patch: { accountName?: string; enabled?: boolean }) {
  return (await run(() => api.updateConnection(id, patch))) !== null;
}

export async function deleteConnection(id: string) {
  return (await run(() => api.deleteConnection(id))) !== null;
}
