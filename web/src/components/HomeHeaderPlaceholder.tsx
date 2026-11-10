import { AvatarButton } from './AvatarButton'
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
        <span className={`${styles.block} ${styles.kicker}`} />
        <span className={`${styles.block} ${styles.left}`} />
      </div>
      <AvatarButton name={name} />
    </div>
    <div className={`${styles.row} ${styles.scores}`}>
      <span className={`${styles.block} ${styles.points}`} />
      <span className={`${styles.block} ${styles.rank}`} />
    </div>
  </header>
)
