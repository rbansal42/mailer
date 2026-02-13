import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, SuppressionItem } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
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
} from '../components/ui/alert-dialog'
import { Textarea } from '../components/ui/textarea'
import { toast } from 'sonner'
import { Search, Plus, Upload, Download, Trash2, Loader2, Ban } from 'lucide-react'

export default function SuppressionList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['suppression', page, search],
    queryFn: () => api.getSuppression(page, 50, search),
  })

  const addMutation = useMutation({
    mutationFn: (email: string) => api.addSuppression(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppression'] })
      setNewEmail('')
      toast.success('Email added to suppression list')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add email')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSuppression(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppression'] })
      toast.success('Email removed from suppression list')
    },
  })

  const importMutation = useMutation({
    mutationFn: (emails: string[]) => api.importSuppression(emails),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['suppression'] })
      setShowImport(false)
      setImportText('')
      toast.success(`Imported ${result.added} emails (${result.skipped} skipped)`)
    },
  })

  const handleImport = () => {
    const emails = importText
      .split(/[\n,;]+/)
      .map(e => e.trim())
      .filter(e => e && e.includes('@'))
    if (emails.length === 0) {
      toast.error('No valid emails found')
      return
    }
    importMutation.mutate(emails)
  }

  const handleExport = () => {
    window.open('/api/suppression/export', '_blank')
  }

  const handleAdd = () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    addMutation.mutate(newEmail)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Suppression List</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Add email form */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add email to suppression list..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search emails..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {search ? 'No emails match your search' : 'No suppressed emails'}
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.email}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      item.reason === 'hard_bounce' ? 'bg-red-100 text-red-800' :
                      item.reason === 'soft_bounce' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.reason}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.source || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove from suppression list?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove "{item.email}" from the suppression list. They will be eligible to receive emails again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Suppression List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter emails (one per line, or comma/semicolon separated)"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
