import { Shimmer } from './Shimmer'
import styles from './LeaderboardPlaceholder.module.css'

const ROWS = [0, 1, 2, 3, 4, 5]

export const LeaderboardPlaceholder = () => (
  <ol aria-busy="true" aria-label="Loading the scores" className={styles.list}>
    {ROWS.map((row) => (
      <li className={styles.row} key={row}>
        <Shimmer className={styles.rank} />
        <Shimmer className={styles.avatar} />
        <span className={styles.who}>
          <Shimmer className={styles.name} />
          <Shimmer className={styles.souls} />
        </span>
        <Shimmer className={styles.points} />
      </li>
    ))}
  </ol>
)
