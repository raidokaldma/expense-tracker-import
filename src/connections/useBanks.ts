import { useEffect, useState } from 'react';
import { messageOf } from '../../shared/errors';
import type { Bank } from '../../shared/types';
import { api } from '../api';
import { showToast } from '../toast';

/** Sorted by name; null while loading */
export function useBanks(country: string) {
  const [banks, setBanks] = useState<Bank[] | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setBanks(null);
    api
      .banks(country)
      .then((list) => {
        if (isCurrent) setBanks(list.sort((left, right) => left.name.localeCompare(right.name)));
      })
      .catch((err) => showToast(messageOf(err), { warn: true }));
    return () => {
      isCurrent = false;
    };
  }, [country]);

  return banks;
}
