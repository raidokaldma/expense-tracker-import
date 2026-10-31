import { useStore } from './store';
import { showToast } from './toast';

/** The bank login sends the browser back with ?connected= or ?loginError=; shown once, then removed. */
export function showLoginOutcome() {
  const params = new URLSearchParams(window.location.search);
  const connected = params.get('connected');
  const loginError = params.get('loginError');
  if (!connected && !loginError) return;
  window.history.replaceState(null, '', window.location.pathname);
  if (loginError) {
    showToast(loginError, { warn: true });
    return;
  }
  const connection = useStore.getState().connections.find((candidate) => candidate.id === connected);
  showToast(connection ? `${connection.bank} ${connection.country} connected` : 'Bank connected');
}
