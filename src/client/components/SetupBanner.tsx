import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, X } from 'lucide-react'
import { api, listsApi } from '../lib/api'
import { Button } from './ui/button'

const DISMISS_KEY = 'mailer_setup_dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isDismissedRecently(): boolean {
  const dismissed = localStorage.getItem(DISMISS_KEY)
  if (!dismissed) return false
  const dismissedAt = new Date(dismissed).getTime()
  if (isNaN(dismissedAt)) return false
  return Date.now() - dismissedAt < DISMISS_DURATION_MS
}

export default function SetupBanner() {
  const [dismissed, setDismissed] = useState(isDismissedRecently)

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
    staleTime: 5 * 60 * 1000,
  })

  const { data: lists } = useQuery({
    queryKey: ['lists'],
    queryFn: listsApi.getAll,
    staleTime: 5 * 60 * 1000,
  })

  const hasAccounts = accounts && accounts.length > 0
  const hasLists = lists && lists.length > 0

  // Setup is complete — never show
  if (hasAccounts && hasLists) return null

  // Still loading
  if (accounts === undefined || lists === undefined) return null

  // Dismissed recently
  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setDismissed(true)
  }

  const message = !hasAccounts
    ? 'Setup incomplete: Configure a sender account to start sending emails.'
    : 'Get started: Create a contact list to organize your recipients.'

  const linkTo = !hasAccounts ? '/settings' : '/lists'
  const linkLabel = !hasAccounts ? 'Go to Settings' : 'Go to Lists'

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3 shrink-0">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">{message}</p>
      <Button variant="ghost" size="sm" asChild className="text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 gap-1 shrink-0">
        <Link to={linkTo}>
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shrink-0"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
