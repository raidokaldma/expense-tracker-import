import type { Connection } from '../../shared/types';

export function canFetch(connection: Connection) {
  return connection.status === 'active' && !connection.expired;
}
