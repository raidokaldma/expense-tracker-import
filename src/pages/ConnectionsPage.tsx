import { useState } from 'react';
import { AttemptsTable } from '../attempts/AttemptsTable';
import { cx } from '../components/cx';
import { Icon } from '../components/Icon';
import { AddBankForm } from '../connections/AddBankForm';
import { ConnectionCard } from '../connections/ConnectionCard';
import { canFetch } from '../model/connection';
import { plural } from '../model/format';
import { fetchNow, useStore } from '../store';
import styles from './ConnectionsPage.module.css';

function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-title">
        <Icon name="bank" size={20} weight={1.8} />
        <h1>Expense Importer</h1>
      </div>
    </header>
  );
}

function FetchAllButton({ fetchableCount }: { fetchableCount: number }) {
  const fetchingAll = useStore((state) => state.fetchingAll);
  return (
    <button
      type="button"
      className="btn primary"
      disabled={fetchingAll || !fetchableCount}
      title="Fetch and import every active connection"
      onClick={() => void fetchNow()}
    >
      <Icon name="refresh" />
      {fetchingAll ? 'Fetching…' : 'Fetch all'}
    </button>
  );
}

export function ConnectionsPage() {
  const connections = useStore((state) => state.connections);
  const [adding, setAdding] = useState(false);
  const fetchableCount = connections.filter((connection) => connection.enabled && canFetch(connection)).length;

  return (
    <>
      <AppHeader />
      <main className={cx('page', styles.page)}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Connections</h2>
            <p className="subtitle">
              {connections.length
                ? `${plural(connections.length, 'bank')}, ${fetchableCount} ready to fetch`
                : 'No banks yet: add one to start importing'}
            </p>
          </div>
          <div className={styles.headerButtons}>
            {!adding && (
              <button type="button" className="btn" onClick={() => setAdding(true)}>
                <Icon name="plus" />
                Add bank
              </button>
            )}
            <FetchAllButton fetchableCount={fetchableCount} />
          </div>
        </div>

        {adding && <AddBankForm onClose={() => setAdding(false)} />}

        {connections.length > 0 && (
          <div className={styles.connectionGrid}>
            {connections.map((connection) => (
              <ConnectionCard key={connection.id} connection={connection} />
            ))}
          </div>
        )}

        <div className={styles.sectionHeader}>
          <h2>Import log</h2>
        </div>
        <AttemptsTable />
      </main>
    </>
  );
}
