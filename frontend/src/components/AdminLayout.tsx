import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import { cn } from '../lib/utils'
import { LayoutDashboard, Users, Settings, ArrowLeft } from 'lucide-react'

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout() {
  const location = useLocation()
  const { user } = useAuthStore()

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-lg">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {adminNavItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              to={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                location.pathname === href
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
