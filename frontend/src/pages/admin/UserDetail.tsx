import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog'
import { ArrowLeft, Mail, FileText, Users, Trash2, UserCog, Loader2 } from 'lucide-react'
import { auth } from '../../lib/firebase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { toast } from 'sonner'

interface UserDetail {
  id: string
  email: string
  name: string
  isAdmin: boolean
  avatarUrl: string | null
  createdAt: string
  stats: {
    campaigns: number
    contacts: number
    emailsSent: number
  }
}

export default function AdminUserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, startImpersonation } = useAuthStore()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [name, setName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function fetchUser() {
      try {
        const token = await auth.currentUser?.getIdToken()
        const response = await fetch(`/api/admin/users/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (!response.ok) throw new Error('User not found')
        
        const data = await response.json()
        setUser(data)
        setName(data.name)
        setIsAdmin(data.isAdmin)
      } catch (err) {
        console.error('Failed to fetch user:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, isAdmin })
      })
      
      if (!response.ok) throw new Error('Failed to update user')
      
      const data = await response.json()
      setUser(prev => prev ? { ...prev, name: data.name, isAdmin: data.isAdmin } : null)
    } catch (err) {
      console.error('Failed to update user:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      const token = await auth.currentUser?.getIdToken()
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!response.ok) throw new Error('Failed to delete user')
      
      navigate('/admin/users')
    } catch (err) {
      console.error('Failed to delete user:', err)
    }
  }

  const handleImpersonate = async () => {
    if (!id) return
    
    setImpersonating(true)
    try {
      await startImpersonation(id)
      toast.success(`Now viewing as ${user?.name}`)
      navigate('/campaigns')
    } catch (error) {
      console.error('Failed to impersonate:', error)
      toast.error('Failed to start impersonation')
      setImpersonating(false)
    }
  }

  const isSelf = currentUser?.id === user?.id

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

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-500">User not found</p>
        <Link to="/admin/users">
          <Button variant="ghost" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to users
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/users">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
          {user.isAdmin && <Badge>Admin</Badge>}
        </div>
        
        {!isSelf && (
          <Button
            variant="outline"
            onClick={handleImpersonate}
            disabled={impersonating}
          >
            {impersonating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserCog className="h-4 w-4 mr-2" />
            )}
            Impersonate User
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{user.stats.campaigns}</p>
                <p className="text-sm text-muted-foreground">Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{user.stats.contacts}</p>
                <p className="text-sm text-muted-foreground">Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{user.stats.emailsSent}</p>
                <p className="text-sm text-muted-foreground">Emails Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="admin">Admin Access</Label>
              <p className="text-sm text-muted-foreground">
                Can access admin panel and manage users
              </p>
            </div>
            <Switch
              id="admin"
              checked={isAdmin}
              onCheckedChange={setIsAdmin}
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {user.name}'s account and all their data.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-600">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
