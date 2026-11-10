import { Outlet } from 'react-router'
import { useMeContext } from '../hooks/useMeContext'
import styles from './AppShell.module.css'
import { TabBar } from './TabBar'

export const AppShell = () => {
  const context = useMeContext()

  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        <Outlet context={context} />
      </main>
      <TabBar />
    </div>
  )
}
