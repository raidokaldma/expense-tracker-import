import './styles/global.css';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from './components/Toaster';
import { showLoginOutcome } from './loginOutcome';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { refresh, useStore } from './store';

function App() {
  const status = useStore((state) => state.status);
  const error = useStore((state) => state.error);

  // coming back to the window reads the data again, so a scheduled fetch done meanwhile shows
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  return (
    <div className="app">
      {status === 'loading' && <p className="status-message">Loading…</p>}
      {status === 'error' && <p className="status-message">Could not reach the server: {error}</p>}
      {status === 'ready' && <ConnectionsPage />}
      <Toaster />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void refresh().then(showLoginOutcome);
