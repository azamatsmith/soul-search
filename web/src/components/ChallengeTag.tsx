import styles from './ChallengeTag.module.css'

export interface ChallengeTagProps {
  name: string
}

export const ChallengeTag = ({ name }: ChallengeTagProps) => (
  <span className={styles.tag}>{name}</span>
)
