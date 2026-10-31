import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

export function IconButton(props: { icon: IconName; title: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cx(styles.button, props.danger && styles.danger)}
      aria-label={props.title}
      title={props.title}
      onClick={props.onClick}
    >
      <Icon name={props.icon} size={15} />
    </button>
  );
}
