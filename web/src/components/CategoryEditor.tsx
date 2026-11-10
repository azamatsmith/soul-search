import { useId, useState } from 'react'
import { AddCategoryField } from './AddCategoryField'
import { Button } from './Button'
import styles from './CategoryEditor.module.css'

export interface CategoryEditorProps {
  categories: string[]
  onChange: (categories: string[]) => void
}

export const CategoryEditor = ({
  categories,
  onChange,
}: CategoryEditorProps) => {
  const [adding, setAdding] = useState(false)
  const headingId = useId()
  const canRemove = categories.length > 1

  const handleAdd = (name: string) => {
    onChange([...categories, name])
    setAdding(false)
  }

  const handleAddClick = () => setAdding(true)
  const handleCancel = () => setAdding(false)

  const removeHandler = (name: string) => () =>
    onChange(categories.filter((category) => category !== name))

  return (
    <section className={styles.section}>
      <h2 className={styles.heading} id={headingId}>
        Special categories
      </h2>
      <ul aria-labelledby={headingId} className={styles.list}>
        {categories.map((name) => (
          <li className={styles.row} key={name}>
            <span className={styles.name}>{name}</span>
            {canRemove && (
              <button
                className={styles.remove}
                onClick={removeHandler(name)}
                type="button"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <AddCategoryField
          existing={categories}
          onAdd={handleAdd}
          onCancel={handleCancel}
        />
      ) : (
        <Button onClick={handleAddClick} variant="secondary">
          + Add a category
        </Button>
      )}
    </section>
  )
}
