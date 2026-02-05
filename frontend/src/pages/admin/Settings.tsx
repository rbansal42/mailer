import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { auth } from '../../lib/firebase'

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchSettings() {
      try {
        const token = await auth.currentUser?.getIdToken()
        const response = await fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (!response.ok) throw new Error('Failed to fetch settings')
        
        const data = await response.json()
        setSettings(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    
    try {
      const token = await auth.currentUser?.getIdToken()
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      })
      
      if (!response.ok) throw new Error('Failed to save settings')
      
      const data = await response.json()
      setSettings(data)
      setSuccess('Settings saved successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSuccess('')
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">System Settings</h1>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Default Settings</CardTitle>
          <CardDescription>
            These settings apply to all users by default. Users can override them in their own settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="defaultFromName">Default From Name</Label>
            <Input
              id="defaultFromName"
              value={settings.defaultFromName || ''}
              onChange={(e) => updateSetting('defaultFromName', e.target.value)}
              placeholder="My Company"
            />
            <p className="text-xs text-muted-foreground">
              Default sender name for email campaigns
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultReplyTo">Default Reply-To Email</Label>
            <Input
              id="defaultReplyTo"
              type="email"
              value={settings.defaultReplyTo || ''}
              onChange={(e) => updateSetting('defaultReplyTo', e.target.value)}
              placeholder="reply@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Default reply-to address for email campaigns
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trackingEnabled">Email Tracking</Label>
            <select
              id="trackingEnabled"
              className="w-full p-2 border rounded-md bg-background"
              value={settings.trackingEnabled || 'true'}
              onChange={(e) => updateSetting('trackingEnabled', e.target.value)}
            >
              <option value="true">Enabled by default</option>
              <option value="false">Disabled by default</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Whether open and click tracking is enabled by default
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
