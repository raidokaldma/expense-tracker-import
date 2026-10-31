import { useState } from 'react';
import type { Attempt, Connection } from '../../shared/types';
import { cx } from '../components/cx';
import { IconButton } from '../components/IconButton';
import { Pill, type PillTone } from '../components/Pill';
import { daysUntil, describeAttempt, formatDate, formatTime } from '../model/format';
import { logInAgain, updateConnection } from '../store';
import { AccountNameEditor } from './AccountNameEditor';
import styles from './ConnectionCard.module.css';
import { ConnectionFooter } from './ConnectionFooter';

function statusOf(connection: Connection): { label: string; tone?: PillTone } {
  if (connection.status === 'pending') return { label: 'Waiting for login', tone: 'info' };
  if (connection.status === 'failed') return { label: 'Login failed', tone: 'bad' };
  if (connection.expired) return { label: 'Access expired', tone: 'bad' };
  if (!connection.enabled) return { label: 'Paused' };
  return { label: 'Active', tone: 'ok' };
}

function BankAccounts({ connection }: { connection: Connection }) {
  if (!connection.accounts.length) return '—';
  return connection.accounts.map((account) => (
    <div key={account.uid}>{[account.iban ?? account.name ?? account.uid, account.currency].join(' ')}</div>
  ));
}

function Access({ connection }: { connection: Connection }) {
  if (connection.status === 'failed') return <span className="error-text">{connection.error}</span>;
  if (!connection.validUntil) return <span className="muted">not logged in yet</span>;
  if (connection.expired) return <span className="error-text">expired {formatDate(connection.validUntil)}</span>;
  return (
    <span>
      until {formatDate(connection.validUntil)}
      <span className="muted"> · {daysUntil(connection.validUntil)} days left</span>
    </span>
  );
}

function LastImport({ attempt }: { attempt: Attempt | null }) {
  if (!attempt) return <span className="muted">never</span>;
  return (
    <>
      <span className={cx(attempt.status === 'error' && 'error-text')}>{describeAttempt(attempt)}</span>
      <div className="muted">
        {formatTime(attempt.startedAt)} · {attempt.mode}
        {attempt.fetched !== null && ` · ${attempt.fetched} fetched`}
      </div>
    </>
  );
}

export function ConnectionCard({ connection }: { connection: Connection }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const status = statusOf(connection);

  return (
    <article className={cx('card', styles.card, !connection.enabled && styles.paused)}>
      <header className={styles.header}>
        <h3>
          {connection.bank} <span className={styles.country}>{connection.country}</span>
        </h3>
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="spacer" />
        <span className={styles.actions}>
          <IconButton
            icon={connection.enabled ? 'pause' : 'play'}
            title={connection.enabled ? 'Pause: leave out of Fetch all and scheduled fetches' : 'Resume'}
            onClick={() => void updateConnection(connection.id, { enabled: !connection.enabled })}
          />
          <IconButton icon="login" title="Log in to the bank again" onClick={() => void logInAgain(connection.id)} />
          <IconButton icon="bin" title="Delete" danger onClick={() => setConfirmingDelete(true)} />
        </span>
      </header>

      <dl className={styles.facts}>
        <dt>Imports into</dt>
        <dd>
          <AccountNameEditor connection={connection} />
        </dd>
        <dt>Bank accounts</dt>
        <dd className="mono">
          <BankAccounts connection={connection} />
        </dd>
        <dt>Access</dt>
        <dd>
          <Access connection={connection} />
        </dd>
        <dt>Last import</dt>
        <dd>
          <LastImport attempt={connection.lastAttempt} />
        </dd>
      </dl>

      <ConnectionFooter
        connection={connection}
        confirmingDelete={confirmingDelete}
        onCancelDelete={() => setConfirmingDelete(false)}
      />
    </article>
  );
}
