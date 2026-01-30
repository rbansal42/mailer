import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../hooks/useAuthStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Mail, Loader2 } from 'lucide-react'

export default function Login() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const { data: setupCheck, isLoading: checkingSetup } = useQuery({
    queryKey: ['auth-check'],
    queryFn: api.checkSetup,
  })

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      login(data.token)
      navigate('/')
    },
    onError: (err: Error) => {
      setError(err.message || 'Invalid password')
    },
  })

  const setupMutation = useMutation({
    mutationFn: api.setup,
    onSuccess: (data) => {
      login(data.token)
      navigate('/')
    },
    onError: (err: Error) => {
      setError(err.message || 'Setup failed')
    },
  })

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (setupCheck?.needsSetup) {
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters')
        return
      }
      setupMutation.mutate(password)
    } else {
      loginMutation.mutate(password)
    }
  }

  const isLoading = loginMutation.isPending || setupMutation.isPending

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const needsSetup = setupCheck?.needsSetup

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{needsSetup ? 'Set Up Mailer' : 'Welcome Back'}</CardTitle>
          <CardDescription>
            {needsSetup
              ? 'Create a password to secure your app'
              : 'Enter your password to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={needsSetup ? 'Create a password' : 'Enter password'}
                required
                autoFocus
              />
            </div>
            {needsSetup && (
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {needsSetup ? 'Create Password' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
