import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './hooks/useAuthStore'
import { useThemeStore } from './hooks/useThemeStore'
import { applyTheme } from './lib/theme'
import Layout from './components/Layout'
import Login from './pages/Login'
import Campaigns from './pages/Campaigns'
import MailLibrary from './pages/MailLibrary'
import History from './pages/History'
import Settings from './pages/Settings'
import Certificates from './pages/Certificates'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((state) => state.mode)
  const primaryColor = useThemeStore((state) => state.primaryColor)

  useEffect(() => {
    applyTheme(mode, primaryColor)
  }, [mode, primaryColor])

  return <>{children}</>
}

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/campaigns" replace />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="templates" element={<MailLibrary />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
