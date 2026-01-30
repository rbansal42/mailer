import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import { useThemeStore } from '../hooks/useThemeStore'
import { Mail, FileText, History, Settings, LogOut, Sun, Moon } from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  { to: '/campaigns', label: 'Campaigns', icon: Mail },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const mode = useThemeStore((state) => state.mode)
  const toggleMode = useThemeStore((state) => state.toggleMode)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-48 border-r bg-card flex flex-col">
        <div className="p-3 border-b">
          <h1 className="font-semibold text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Mailer
          </h1>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t space-y-1">
          <button
            onClick={toggleMode}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
