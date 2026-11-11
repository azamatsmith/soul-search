import { Button } from '../components/Button'
import { CategoryEditor } from '../components/CategoryEditor'
import { ConnectionError } from '../components/ConnectionError'
import { LoadError } from '../components/LoadError'
import { PushedScreen } from '../components/PushedScreen'
import { Stepper } from '../components/Stepper'
import { usePointRulesForm } from '../hooks/usePointRulesForm'
import styles from './PointsScreen.module.css'

export const PointsScreen = () => {
  const { handleSave, retry, rules, saveFailed, saving, status, update } =
    usePointRulesForm()

  const handleRegularChange = (regular: number) => update({ regular })
  const handleSpecialChange = (special: number) => update({ special })
  const handleFalseCallChange = (false_call: number) => update({ false_call })
  const handleCategoriesChange = (categories: string[]) =>
    update({ categories })
  const handleSaveClick = () => {
    void handleSave()
  }

  return (
    <PushedScreen
      backLabel="Admin tools"
      backTo="/admin"
      kicker="Admins only"
      title="Points & categories"
    >
      {status === 'error' && !rules && (
        <LoadError onRetry={retry} thing="the point rules" />
      )}
      {rules && (
        <>
          <div className={styles.steppers}>
            <Stepper
              label="Regular Soul"
              max={10}
              min={1}
              onChange={handleRegularChange}
              value={rules.regular}
            />
            <Stepper
              label="Special Soul"
              max={10}
              min={1}
              onChange={handleSpecialChange}
              value={rules.special}
            />
            <Stepper
              label="False call"
              max={0}
              min={-10}
              onChange={handleFalseCallChange}
              value={rules.false_call}
            />
          </div>
          <CategoryEditor
            categories={rules.categories}
            onChange={handleCategoriesChange}
          />
          <p className={styles.note}>
            Changes apply to new photos from now on. Past points stay the same.
          </p>
          {saveFailed && <ConnectionError kind="save" />}
          <div className={styles.spacer} />
          <Button disabled={saving} onClick={handleSaveClick}>
            Save changes
          </Button>
        </>
      )}
    </PushedScreen>
  )
}
