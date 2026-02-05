import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Mail, CheckCircle } from 'lucide-react'

export default function VerifyEmail() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { resendVerification, firebaseUser } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (firebaseUser?.emailVerified) {
      navigate('/')
    }
  }, [firebaseUser, navigate])

  const handleResend = async () => {
    setError('')
    setLoading(true)
    try {
      await resendVerification()
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to{' '}
            <span className="font-medium">{firebaseUser?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {sent && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Verification email sent! Check your inbox.</AlertDescription>
            </Alert>
          )}
          
          <p className="text-sm text-muted-foreground text-center">
            Click the link in the email to verify your account. 
            If you don't see it, check your spam folder.
          </p>
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleResend}
            disabled={loading || sent}
          >
            {loading ? 'Sending...' : sent ? 'Email sent' : 'Resend verification email'}
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already verified?{' '}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
