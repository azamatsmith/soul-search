import { Fragment, useState } from 'react'
import { useParams } from 'react-router'
import { ConnectionError } from '../components/ConnectionError'
import { FormError } from '../components/FormError'
import { LoadError } from '../components/LoadError'
import { Photo } from '../components/Photo'
import { PhotoViewer } from '../components/PhotoViewer'
import { PushedScreen } from '../components/PushedScreen'
import { ReviewChoiceButton } from '../components/ReviewChoiceButton'
import { CategoryPicker } from '../components/CategoryPicker'
import { useReviewPhoto } from '../hooks/useReviewPhoto'
import { SAVE_FAILED } from '../lib/errorCopy'
import {
  claimSummary,
  type ReviewChoice,
  reviewCard,
  reviewChoices,
} from '../lib/reviewCopy'
import { viewerTime } from '../lib/sightingsCopy'
import { PACIFIC } from '../lib/zonedTime'
import styles from './ReviewPhotoScreen.module.css'

export const ReviewPhotoScreen = () => {
  const { id = '' } = useParams()
  const review = useReviewPhoto(id)
  const [picking, setPicking] = useState(false)
  const [viewing, setViewing] = useState(false)
  const { item } = review
  const isFalseCall = item?.status === 'false_call'

  const handleChoose = ({ action }: ReviewChoice) => {
    if (action === 'category') setPicking(true)
    else void review.submit(action, null)
  }
  const handleCategory = (category: string) => {
    void review.submit('category', category)
  }
  const handleOpenPhoto = () => setViewing(true)
  const handleClosePhoto = () => setViewing(false)

  return (
    <PushedScreen
      backLabel="Flagged photos"
      backTo={review.backTo}
      title={isFalseCall ? 'Auto false call' : 'Flagged photo'}
    >
      {review.gone && (
        <p className={styles.note}>
          Someone already looked at this photo. Go back to see what's left.
        </p>
      )}
      {review.status === 'error' && !review.gone && (
        <LoadError onRetry={review.retry} thing="this photo" />
      )}
      {item && (
        <>
          <button
            aria-label={`Enlarge photo from ${item.display_name}`}
            className={styles.photo}
            onClick={handleOpenPhoto}
            type="button"
          >
            {item.photo_url && (
              <Photo alt="" className={styles.image} src={item.photo_url} />
            )}
          </button>
          <div className={styles.who}>
            <span className={styles.name}>{item.display_name}</span>
            <span className={styles.time}>
              {viewerTime(item.taken_at, PACIFIC)}
            </span>
          </div>
          <section className={styles.card}>
            <h2 className={styles.label}>Player's claim</h2>
            <p className={styles.claim}>{claimSummary(item)}</p>
          </section>
          {item.verification_notes && (
            <section className={`${styles.card} ${styles.notes}`}>
              <h2 className={styles.label}>Photo check notes</h2>
              <p className={styles.reasoning}>{item.verification_notes}</p>
            </section>
          )}
          <h2 className={styles.label}>What should it count as?</h2>
          {review.saveError &&
            (review.saveError === 'already_reviewed' ? (
              <FormError title={SAVE_FAILED}>
                Someone else already looked at this photo.
              </FormError>
            ) : (
              <ConnectionError kind="save" />
            ))}
          {reviewChoices(item, item.rules).map((choice) => (
            <Fragment key={choice.action}>
              <ReviewChoiceButton
                choice={choice}
                disabled={review.saving}
                onChoose={handleChoose}
              />
              {picking && choice.action === 'category' && (
                <CategoryPicker
                  disabled={review.saving}
                  initial={item.categories[0] ?? null}
                  onConfirm={handleCategory}
                  rules={item.rules}
                />
              )}
            </Fragment>
          ))}
          {viewing && (
            <PhotoViewer
              card={reviewCard(item)}
              onClose={handleClosePhoto}
              zone={PACIFIC}
            />
          )}
        </>
      )}
    </PushedScreen>
  )
}
