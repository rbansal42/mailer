import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { auth } from '../../lib/firebase'

interface User {
  id: string
  email: string
  name: string
  isAdmin: boolean
  avatarUrl: string | null
  createdAt: string
}

interface UsersResponse {
  users: User[]
  total: number
  page: number
  limit: number
}

export default function AdminUsers() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true)
      try {
        const token = await auth.currentUser?.getIdToken()
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          ...(search && { search })
        })
        
        const response = await fetch(`/api/admin/users?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (!response.ok) throw new Error('Failed to fetch users')
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error('Failed to fetch users:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [page, search])

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({data?.total || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge variant="default">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Link to={`/admin/users/${user.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
