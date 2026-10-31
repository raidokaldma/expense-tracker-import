/** Settings from the environment (see .env.example). */
export function readConfig(env = process.env) {
  function required(name: string) {
    const value = env[name];
    if (!value) throw new Error(`Set ${name}`);
    return value;
  }
  const fetchDays = Number(env.FETCH_DAYS || 60);
  if (!Number.isInteger(fetchDays) || fetchDays < 1) throw new Error('FETCH_DAYS must be a whole number of days');
  const tlsCert = env.TLS_CERT_FILE || null;
  const tlsKey = env.TLS_KEY_FILE || null;
  if (!tlsCert !== !tlsKey) throw new Error('Set both TLS_CERT_FILE and TLS_KEY_FILE, or neither');
  return {
    dbPath: env.DB_PATH || './data/importer.db',
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT) || 3000,
    /** The built frontend (npm run build) */
    staticDir: env.STATIC_DIR || 'dist',
    /** Serves HTTPS when set: the bank sends the browser back to an https:// callback. */
    tls: tlsCert && tlsKey ? { certFile: tlsCert, keyFile: tlsKey } : null,
    enableBanking: {
      applicationId: required('ENABLE_BANKING_APP_ID'),
      keyFile: required('ENABLE_BANKING_KEY_FILE'),
      /** Must be one of the application's redirect URLs in the Enable Banking control panel. */
      redirectUrl: env.REDIRECT_URL || 'https://localhost:3000/api/import/connections/callback',
    },
    /** Where the rows are imported; null prints them to the console instead. */
    expenseTracker: env.EXPENSE_TRACKER_URL ? { url: env.EXPENSE_TRACKER_URL } : null,
    /** How many days back each fetch asks for; the import skips rows it already has. */
    fetchDays,
  };
}
