import { useToast } from '../toast';
import { cx } from './cx';

/** At the bottom of the page; it never takes the focus. */
export function Toaster() {
  const toast = useToast((state) => state.toast);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={cx('toast', toast.warn && 'warn')}>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
