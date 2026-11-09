import { Outlet } from 'react-router'
import styles from './AppShell.module.css'
import { TabBar } from './TabBar'

export const AppShell = () => (
  <div className={styles.shell}>
    <main className={styles.content}>
      <Outlet />
    </main>
    <TabBar />
  </div>
)
