import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Mail, Users, ArrowRight, Rocket } from 'lucide-react'
import { api } from '../lib/api'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

const ONBOARDING_KEY = 'mailer_onboarding_completed'

export default function OnboardingDialog() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
    staleTime: 5 * 60 * 1000,
  })

  // Show when: not completed before AND has no sender accounts (new user)
  const completed = localStorage.getItem(ONBOARDING_KEY)
  const shouldShow = !completed && !isLoading && accounts !== undefined && accounts.length === 0

  const [open, setOpen] = useState(true)

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setOpen(false)
  }

  const handleNavigate = (path: string) => {
    handleComplete()
    navigate(path)
  }

  if (!shouldShow || !open) return null

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) handleComplete() }}>
      <DialogContent className="sm:max-w-md">
        {step === 0 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center text-xl">Welcome to Mailer!</DialogTitle>
              <DialogDescription className="text-center">
                Send email campaigns, build automated sequences, and generate certificates — all from one place.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center pt-2">
              <Button onClick={() => setStep(1)} className="gap-1">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 1 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center text-xl">Set up your email sender</DialogTitle>
              <DialogDescription className="text-center">
                Configure a Gmail or SMTP account to start sending emails.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0 pt-2">
              <Button onClick={() => handleNavigate('/settings')} className="w-full gap-1">
                Go to Settings
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)} className="w-full text-muted-foreground">
                Skip for now
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center text-xl">Add your contacts</DialogTitle>
              <DialogDescription className="text-center">
                Import a CSV or add contacts manually to create your first list.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0 pt-2">
              <Button onClick={() => handleNavigate('/lists')} className="w-full gap-1">
                Go to Lists
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={handleComplete} className="w-full text-muted-foreground">
                Skip for now
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 pt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
