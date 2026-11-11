import { Outlet } from 'react-router'
import { useMeContext } from '../hooks/useMeContext'
import { useRefreshOnUploadsFlushed } from '../hooks/useRefreshOnUploadsFlushed'
import { useUploadFlush } from '../hooks/useUploadFlush'
import styles from './AppShell.module.css'
import { TabBar } from './TabBar'

export const AppShell = () => {
  const context = useMeContext()
  useUploadFlush(context.me.id)
  useRefreshOnUploadsFlushed()

  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        <Outlet context={context} />
      </main>
      <TabBar />
    </div>
  )
}
