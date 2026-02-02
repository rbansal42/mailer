import { useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './hooks/useAuthStore'
import { useThemeStore } from './hooks/useThemeStore'
import { applyTheme } from './lib/theme'
import Layout from './components/Layout'

// Eagerly loaded - needed immediately
import Login from './pages/Login'

// Lazy loaded pages - code split into separate chunks
const Campaigns = lazy(() => import('./pages/Campaigns'))
const MailLibrary = lazy(() => import('./pages/MailLibrary'))
const Lists = lazy(() => import('./pages/Lists'))
const ListDetail = lazy(() => import('./pages/ListDetail'))
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))
const Certificates = lazy(() => import('./pages/Certificates'))
const SuppressionList = lazy(() => import('./pages/SuppressionList'))

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

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
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
          <Route path="campaigns" element={<Suspense fallback={<PageLoader />}><Campaigns /></Suspense>} />
          <Route path="templates" element={<Suspense fallback={<PageLoader />}><MailLibrary /></Suspense>} />
          <Route path="lists" element={<Suspense fallback={<PageLoader />}><Lists /></Suspense>} />
          <Route path="lists/:id" element={<Suspense fallback={<PageLoader />}><ListDetail /></Suspense>} />
          <Route path="certificates" element={<Suspense fallback={<PageLoader />}><Certificates /></Suspense>} />
          <Route path="history" element={<Suspense fallback={<PageLoader />}><History /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          <Route path="suppression" element={<Suspense fallback={<PageLoader />}><SuppressionList /></Suspense>} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
