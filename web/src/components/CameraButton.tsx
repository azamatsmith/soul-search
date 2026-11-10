import { Link } from 'react-router'
import styles from './CameraButton.module.css'

export const CameraButton = () => (
  <Link
    aria-label="Take photo of a Soul"
    className={styles.button}
    to="/capture"
  >
    <span aria-hidden className={styles.glyph}>
      <span className={styles.lens} />
    </span>
    <span aria-hidden className={styles.label}>
      Snap a Soul
    </span>
  </Link>
)
