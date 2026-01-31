import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import { useThemeStore } from '../hooks/useThemeStore'
import { Mail, FileText, History, Settings, LogOut, Sun, Moon, Menu, X } from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  { to: '/campaigns', label: 'Campaigns', icon: Mail },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-background border"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-48 bg-card border-r flex flex-col transform transition-transform duration-200 ease-in-out',
          'lg:relative lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-3 border-b">
          <h1 className="font-semibold text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Mailer
          </h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  'min-h-[44px]',
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
            className="flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors min-h-[44px]"
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
            className="flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors min-h-[44px]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay when mobile menu open */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <main
        id="main-content"
        className={cn(
          'flex-1 overflow-auto',
          'lg:ml-0',
          'pt-16 lg:pt-0'
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
