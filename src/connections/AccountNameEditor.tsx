import { useState } from 'react';
import type { Connection } from '../../shared/types';
import { cx } from '../components/cx';
import { Icon } from '../components/Icon';
import { updateConnection } from '../store';
import styles from './AccountNameEditor.module.css';

export function AccountNameEditor({ connection }: { connection: Connection }) {
  const [draft, setDraft] = useState<string | null>(null);

  async function save() {
    const name = draft?.trim();
    setDraft(null);
    if (name && name !== connection.accountName) await updateConnection(connection.id, { accountName: name });
  }

  if (draft === null)
    return (
      <button
        type="button"
        className={styles.nameButton}
        title="Rename"
        onClick={() => setDraft(connection.accountName)}
      >
        {connection.accountName}
        <Icon name="pen" size={12} />
      </button>
    );

  return (
    <input
      className={cx('input', styles.nameInput)}
      aria-label="Expense tracker account"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') void save();
        if (event.key === 'Escape') setDraft(null);
      }}
      onBlur={() => void save()}
      // biome-ignore lint/a11y/noAutofocus: the field opens on a click and is typed into right away
      autoFocus
      spellCheck={false}
    />
  );
}
