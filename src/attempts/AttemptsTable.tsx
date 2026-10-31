import { Fragment, useState } from 'react';
import { formatAmount } from '../../shared/format';
import type { Attempt, AttemptStatus, Conflict } from '../../shared/types';
import { cx } from '../components/cx';
import { Pill, type PillTone } from '../components/Pill';
import { formatDate, formatTime } from '../model/format';
import { useStore } from '../store';
import styles from './AttemptsTable.module.css';

const COLUMNS = ['Started', 'Bank', 'Mode', 'Status', 'Fetched', 'Sent', 'Added', 'Conflicts', 'Error'];
const NUMBER_COLUMNS = ['Fetched', 'Sent', 'Added', 'Conflicts'];
const STATUS_TONE: Record<AttemptStatus, PillTone> = { success: 'ok', error: 'bad', running: 'info' };

function orDash(value: number | null) {
  return value === null ? '—' : value;
}

function describeConflictRow(conflict: Conflict) {
  if (!conflict.row) return conflict.externalId;
  const { occurredAt, counterparty, description } = conflict.row;
  return [formatDate(occurredAt), counterparty, description].filter(Boolean).join(' · ');
}

function ConflictList({ conflicts }: { conflicts: Conflict[] }) {
  return (
    <tr>
      <td colSpan={COLUMNS.length} className={styles.conflicts}>
        <ul>
          {conflicts.map((conflict) => (
            <li key={conflict.externalId}>
              {describeConflictRow(conflict)}
              {' — '}
              <span className="mono">
                sent {formatAmount(conflict.sentAmount)}, saved {formatAmount(conflict.savedAmount)}
              </span>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

function ConflictCount(props: { conflicts: Conflict[] | null; expanded: boolean; onToggle: () => void }) {
  if (props.conflicts === null) return orDash(null);
  if (!props.conflicts.length) return 0;
  return (
    <button type="button" className={styles.conflictToggle} aria-expanded={props.expanded} onClick={props.onToggle}>
      {props.conflicts.length}
    </button>
  );
}

function AttemptRow(props: { attempt: Attempt; expanded: boolean; onToggle: () => void }) {
  const { attempt } = props;
  const numberCell = cx(styles.number, 'mono');
  return (
    <tr>
      <td className={styles.noWrap}>{formatTime(attempt.startedAt)}</td>
      <td className={styles.noWrap}>{attempt.bank}</td>
      <td>{attempt.mode}</td>
      <td>
        <Pill tone={STATUS_TONE[attempt.status]}>{attempt.status}</Pill>
      </td>
      <td className={numberCell}>{orDash(attempt.fetched)}</td>
      <td className={numberCell}>{orDash(attempt.sent)}</td>
      <td className={numberCell}>{orDash(attempt.added)}</td>
      <td className={cx(numberCell, !!attempt.conflicts?.length && 'error-text')}>
        <ConflictCount conflicts={attempt.conflicts} expanded={props.expanded} onToggle={props.onToggle} />
      </td>
      <td className={styles.error}>{attempt.error}</td>
    </tr>
  );
}

export function AttemptsTable() {
  const attempts = useStore((state) => state.attempts);
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null);

  function toggle(attemptId: number) {
    setExpandedAttemptId(expandedAttemptId === attemptId ? null : attemptId);
  }

  if (!attempts.length) return <p className={cx('card', styles.empty)}>Nothing fetched yet</p>;

  return (
    <div className={cx('card', styles.scroller)}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} className={cx(NUMBER_COLUMNS.includes(column) && styles.number)}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => {
            const expanded = expandedAttemptId === attempt.id && !!attempt.conflicts?.length;
            return (
              <Fragment key={attempt.id}>
                <AttemptRow attempt={attempt} expanded={expanded} onToggle={() => toggle(attempt.id)} />
                {expanded && <ConflictList conflicts={attempt.conflicts!} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
