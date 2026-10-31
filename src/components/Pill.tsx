import type { ReactNode } from 'react';
import { cx } from './cx';

export type PillTone = 'ok' | 'bad' | 'info';

export function Pill({ tone, children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={cx('pill', tone)}>{children}</span>;
}
