-- Timestamps are UTC ISO 8601 strings: 2026-10-20T11:30:00.000Z.

-- One bank login (an Enable Banking session); it may cover several bank accounts.
CREATE TABLE connections (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  -- the bank: an ASPSP (account servicing payment service provider) as Enable Banking names it
  aspsp_name TEXT NOT NULL CHECK (length(aspsp_name) BETWEEN 1 AND 100),
  aspsp_country TEXT NOT NULL CHECK (length(aspsp_country) = 2),
  -- the kind of customer login at the bank (PSU: payment service user)
  psu_type TEXT NOT NULL CHECK (psu_type IN ('personal', 'business')),
  -- the expense-tracker account the transactions are imported into
  account_name TEXT NOT NULL CHECK (length(account_name) BETWEEN 1 AND 100),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  -- pending: waiting for the first bank login; active: has a session; failed: the first login failed
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'failed')),
  -- the state of the bank login in progress, matched on the callback
  auth_state TEXT UNIQUE,
  session_id TEXT,
  valid_until TEXT,
  -- the response of POST /sessions: accounts, access, aspsp
  session TEXT CHECK (session IS NULL OR json_valid(session)),
  -- why the last bank login failed
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

-- Every fetch, with its outcome; kept when the connection is deleted.
CREATE TABLE attempts (
  id INTEGER PRIMARY KEY,
  connection_id TEXT REFERENCES connections (id) ON DELETE SET NULL,
  -- "Swedbank EE", readable after the connection is gone
  bank TEXT NOT NULL,
  -- user: a person asked for it now (sent to the bank as PSU headers); scheduled: unattended
  mode TEXT NOT NULL CHECK (mode IN ('user', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  -- transactions the bank returned
  fetched INTEGER,
  -- rows sent to expense-tracker; the rest had no id or another currency
  sent INTEGER,
  -- expense-tracker's answer; NULL when printed instead (no EXPENSE_TRACKER_URL)
  added INTEGER,
  skipped INTEGER,
  conflicts TEXT CHECK (conflicts IS NULL OR json_valid(conflicts)),
  error TEXT
) STRICT;

CREATE INDEX attempts_connection_id ON attempts (connection_id, id);
