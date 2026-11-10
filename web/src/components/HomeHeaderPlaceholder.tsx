import { AvatarButton } from './AvatarButton'
import { Shimmer } from './Shimmer'
import styles from './HomeHeaderPlaceholder.module.css'

export interface HomeHeaderPlaceholderProps {
  name: string | null
}

export const HomeHeaderPlaceholder = ({ name }: HomeHeaderPlaceholderProps) => (
  <header
    aria-busy="true"
    aria-label="Loading your points"
    className={styles.header}
  >
    <div className={styles.row}>
      <div className={styles.lines}>
        <Shimmer className={styles.kicker} tone="dark" />
        <Shimmer className={styles.left} tone="dark" />
      </div>
      <AvatarButton name={name} />
    </div>
    <div className={`${styles.row} ${styles.scores}`}>
      <Shimmer className={styles.points} tone="dark" />
      <Shimmer className={styles.rank} tone="dark" />
    </div>
  </header>
)
