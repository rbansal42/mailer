import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Users, Mail, FileText, UserPlus } from 'lucide-react'
import { auth } from '../../lib/firebase'

interface OverviewData {
  totalUsers: number
  totalCampaigns: number
  totalEmailsSent: number
  totalContacts: number
  recentSignups: { date: string; count: number }[]
}

export default function AdminDashboard() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await auth.currentUser?.getIdToken()
        const response = await fetch('/api/admin/analytics/overview', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (!response.ok) throw new Error('Failed to fetch analytics')
        
        const result = await response.json()
        setData(result)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  const stats = [
    { label: 'Total Users', value: data?.totalUsers || 0, icon: Users, color: 'text-blue-600' },
    { label: 'Campaigns', value: data?.totalCampaigns || 0, icon: FileText, color: 'text-green-600' },
    { label: 'Emails Sent', value: data?.totalEmailsSent || 0, icon: Mail, color: 'text-purple-600' },
    { label: 'Contacts', value: data?.totalContacts || 0, icon: UserPlus, color: 'text-orange-600' },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Signups */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Signups (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recentSignups && data.recentSignups.length > 0 ? (
            <div className="space-y-2">
              {data.recentSignups.map(({ date, count }) => (
                <div key={date} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{new Date(date).toLocaleDateString()}</span>
                  <span className="font-medium">{count} new user{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No signups in the last 7 days</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
