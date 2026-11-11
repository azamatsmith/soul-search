import type { HistoryEntry } from '../lib/api'
import { historyLine, historyTag, historyTime } from '../lib/historyCopy'
import styles from './HistoryRow.module.css'
import { PlayerAvatar } from './PlayerAvatar'

export interface HistoryRowProps {
  entry: HistoryEntry
  now: number
}

export const HistoryRow = ({ entry, now }: HistoryRowProps) => (
  <li className={styles.row}>
    <PlayerAvatar id={entry.admin.id} name={entry.admin.display_name} />
    <div className={styles.text}>
      <span className={styles.line}>
        <b>{entry.admin.display_name}</b> {historyLine(entry)}
      </span>
      <span className={styles.meta}>
        <span className={styles.tag}>{historyTag(entry.type)}</span>
        {historyTime(entry.created_at, now)}
      </span>
    </div>
  </li>
)
