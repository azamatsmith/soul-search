import { Camera, List, Trophy, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import styles from './TabBar.module.css'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
}

const tabs: Tab[] = [
  { to: '/', label: 'Take photo', icon: Camera },
  { to: '/sightings', label: 'Sightings', icon: List },
  { to: '/scores', label: 'Scores', icon: Trophy },
]

const tabClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.tab} ${styles.active}` : styles.tab

export const TabBar = () => (
  <nav aria-label="Main" className={styles.bar}>
    {tabs.map(({ icon: Icon, label, to }) => (
      <NavLink className={tabClassName} end key={to} to={to}>
        <Icon aria-hidden="true" size={26} strokeWidth={2.5} />
        {label}
      </NavLink>
    ))}
  </nav>
)
