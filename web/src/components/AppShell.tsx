import { Outlet } from 'react-router'
import { useTextSize } from '../hooks/useTextSize'
import styles from './AppShell.module.css'
import { TabBar } from './TabBar'

export const AppShell = () => {
  useTextSize('standard')

  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
