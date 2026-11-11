import type { Rules } from '../lib/api'
import { rulesText } from '../lib/leaderboardCopy'
import styles from './RulesStrip.module.css'

export interface RulesStripProps {
  rules: Rules
}

export const RulesStrip = ({ rules }: RulesStripProps) => (
  <p className={styles.strip}>{rulesText(rules)}</p>
)
