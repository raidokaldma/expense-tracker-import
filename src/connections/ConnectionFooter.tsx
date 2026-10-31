import type { Connection } from '../../shared/types';
import { Icon } from '../components/Icon';
import { canFetch } from '../model/connection';
import { deleteConnection, fetchNow, isFetching, logInAgain, useStore } from '../store';
import styles from './ConnectionFooter.module.css';

function DeleteConfirmation({ connectionId, onCancel }: { connectionId: string; onCancel: () => void }) {
  async function confirm() {
    if (!(await deleteConnection(connectionId))) onCancel();
  }

  return (
    <>
      <span className={styles.confirmText}>Delete, and revoke the bank access?</span>
      <button type="button" className="btn sm danger" onClick={confirm}>
        Delete
      </button>
      <button type="button" className="btn sm" onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}

function FetchButton({ connectionId }: { connectionId: string }) {
  const busy = useStore((state) => isFetching(state, connectionId));
  return (
    <button type="button" className="btn sm" disabled={busy} onClick={() => void fetchNow(connectionId)}>
      <Icon name="refresh" size={13} />
      {busy ? 'Fetching…' : 'Fetch now'}
    </button>
  );
}

function LoginButton({ connection }: { connection: Connection }) {
  return (
    <button type="button" className="btn sm primary" onClick={() => void logInAgain(connection.id)}>
      <Icon name="login" size={13} />
      Log in to {connection.bank}
    </button>
  );
}

export function ConnectionFooter({
  connection,
  confirmingDelete,
  onCancelDelete,
}: {
  connection: Connection;
  confirmingDelete: boolean;
  onCancelDelete: () => void;
}) {
  return <footer className={styles.footer}>{footerContent(connection, confirmingDelete, onCancelDelete)}</footer>;
}

function footerContent(connection: Connection, confirmingDelete: boolean, onCancelDelete: () => void) {
  if (confirmingDelete) return <DeleteConfirmation connectionId={connection.id} onCancel={onCancelDelete} />;
  if (canFetch(connection)) return <FetchButton connectionId={connection.id} />;
  return <LoginButton connection={connection} />;
}
