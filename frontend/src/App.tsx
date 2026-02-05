import { useEffect, Suspense, lazy, Component, ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './hooks/useAuthStore'
import { useThemeStore } from './hooks/useThemeStore'
import { applyTheme } from './lib/theme'
import Layout from './components/Layout'

// Eagerly loaded - needed immediately
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'

// Lazy loaded pages - code split into separate chunks
const Campaigns = lazy(() => import('./pages/Campaigns'))
const MailLibrary = lazy(() => import('./pages/MailLibrary'))
const Lists = lazy(() => import('./pages/Lists'))
const ListDetail = lazy(() => import('./pages/ListDetail'))
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))
const Certificates = lazy(() => import('./pages/Certificates'))
const SuppressionList = lazy(() => import('./pages/SuppressionList'))
const Sequences = lazy(() => import('./pages/Sequences'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))

// Error Boundary for catching lazy loading failures
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4">
          <p className="text-destructive">Failed to load page</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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

// Helper component for lazy-loaded routes with error boundary and suspense
function LazyRoute({ component: LazyComponent }: { component: React.LazyExoticComponent<() => JSX.Element> }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <LazyComponent />
      </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  const { isLoading, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Show a loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100" />
      </div>
    )
  }

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/campaigns" replace />} />
          <Route path="campaigns" element={<LazyRoute component={Campaigns} />} />
          <Route path="templates" element={<LazyRoute component={MailLibrary} />} />
          <Route path="lists" element={<LazyRoute component={Lists} />} />
          <Route path="lists/:id" element={<LazyRoute component={ListDetail} />} />
          <Route path="certificates" element={<LazyRoute component={Certificates} />} />
          <Route path="history" element={<LazyRoute component={History} />} />
          <Route path="settings" element={<LazyRoute component={Settings} />} />
          <Route path="suppression" element={<LazyRoute component={SuppressionList} />} />
          <Route path="sequences" element={<LazyRoute component={Sequences} />} />
          <Route path="settings/account" element={<LazyRoute component={AccountSettings} />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
