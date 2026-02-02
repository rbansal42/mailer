import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Search, Trash2, Upload, Download, Pencil, Loader2, X, Check, Sheet, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listsApi, ContactList, Contact, googleSheetsApi, SpreadsheetPreview, ColumnMapping } from '@/lib/api'
import { toast } from 'sonner'

export default function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const listId = parseInt(id || '0')

  // List data
  const [list, setList] = useState<ContactList | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  // Search
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Editing list name/description
  const [editingName, setEditingName] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [descriptionValue, setDescriptionValue] = useState('')

  // Import dialog
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)

  // Edit contact dialog
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    phone: '',
    country: '',
  })
  const [saving, setSaving] = useState(false)

  // Google Sheets sync dialog
  const [sheetSyncOpen, setSheetSyncOpen] = useState(false)
  const [sheetsConnected, setSheetsConnected] = useState<boolean | null>(null)
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('')
  const [sheetPreview, setSheetPreview] = useState<SpreadsheetPreview | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ email: '' })
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Load list and contacts
  const loadData = useCallback(async () => {
    if (!listId) return
    setLoading(true)
    try {
      const [listData, membersData] = await Promise.all([
        listsApi.get(listId),
        listsApi.getMembers(listId, page, limit, search),
      ])
      setList(listData)
      setContacts(membersData.contacts)
      setTotalPages(membersData.pagination.totalPages)
      setTotal(membersData.pagination.total)
      setNameValue(listData.name)
      setDescriptionValue(listData.description || '')
    } catch (error) {
      toast.error('Failed to load list')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [listId, page, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Save list name
  const saveName = async () => {
    if (!list || !nameValue.trim()) return
    try {
      await listsApi.update(listId, { name: nameValue.trim() })
      setList({ ...list, name: nameValue.trim() })
      setEditingName(false)
      toast.success('Name updated')
    } catch (error) {
      toast.error('Failed to update name')
    }
  }

  // Save list description
  const saveDescription = async () => {
    if (!list) return
    try {
      await listsApi.update(listId, { description: descriptionValue.trim() || undefined })
      setList({ ...list, description: descriptionValue.trim() || undefined })
      setEditingDescription(false)
      toast.success('Description updated')
    } catch (error) {
      toast.error('Failed to update description')
    }
  }

  // Toggle selection
  const toggleSelect = (contactId: number) => {
    const newSelected = new Set(selected)
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId)
    } else {
      newSelected.add(contactId)
    }
    setSelected(newSelected)
  }

  // Toggle all on current page
  const toggleAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map((c) => c.id)))
    }
  }

  // Remove selected contacts
  const removeSelected = async () => {
    if (selected.size === 0) return
    const toRemove = Array.from(selected)
    try {
      await Promise.all(toRemove.map((id) => listsApi.removeMember(listId, id)))
      toast.success(`Removed ${toRemove.length} contact(s)`)
      setSelected(new Set())
      loadData()
    } catch (error) {
      toast.error('Failed to remove contacts')
    }
  }

  // Import CSV
  const handleImport = async () => {
    if (!csvText.trim()) return
    setImporting(true)
    try {
      const result = await listsApi.import(listId, csvText)
      toast.success(`Imported: ${result.added} added, ${result.created} new contacts`)
      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.errors.length} rows had errors`)
      }
      setImportOpen(false)
      setCsvText('')
      loadData()
    } catch (error) {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  // Open edit contact dialog
  const openEditContact = (contact: Contact) => {
    setEditContact(contact)
    setEditForm({
      name: contact.name || '',
      company: contact.company || '',
      phone: contact.phone || '',
      country: contact.country || '',
    })
  }

  // Save contact edit
  const saveContact = async () => {
    if (!editContact) return
    setSaving(true)
    try {
      const response = await fetch(`/api/contacts/${editContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!response.ok) throw new Error('Failed to update')
      toast.success('Contact updated')
      setEditContact(null)
      loadData()
    } catch (error) {
      toast.error('Failed to update contact')
    } finally {
      setSaving(false)
    }
  }

  // Export
  const handleExport = async () => {
    if (!list) return
    try {
      await listsApi.export(listId, list.name)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Check Google Sheets connection status
  const checkSheetsConnection = async () => {
    try {
      const status = await googleSheetsApi.getStatus()
      setSheetsConnected(status.connected)
    } catch {
      setSheetsConnected(false)
    }
  }

  // Open Google Sheets sync dialog
  const openSheetSync = async () => {
    setSheetSyncOpen(true)
    setSpreadsheetUrl('')
    setSheetPreview(null)
    setColumnMapping({ email: '' })
    await checkSheetsConnection()
  }

  // Fetch spreadsheet preview
  const fetchSpreadsheetPreview = async () => {
    if (!spreadsheetUrl.trim()) {
      toast.error('Please enter a spreadsheet URL or ID')
      return
    }
    setLoadingPreview(true)
    try {
      const preview = await googleSheetsApi.previewSpreadsheet(spreadsheetUrl.trim())
      setSheetPreview(preview)
      setColumnMapping(preview.suggestedMapping)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load spreadsheet')
      setSheetPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Sync contacts from Google Sheets
  const handleSheetSync = async () => {
    if (!sheetPreview || !columnMapping.email) {
      toast.error('Please select an email column')
      return
    }
    setSyncing(true)
    try {
      const result = await googleSheetsApi.syncToList(listId, {
        spreadsheetId: spreadsheetUrl.trim(),
        columnMapping,
      })
      toast.success(`Synced ${result.total} contacts (${result.created} new, ${result.added} added to list)`)
      setSheetSyncOpen(false)
      loadData()
    } catch (error: any) {
      toast.error(error.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (loading && !list) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!list) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">List not found</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/lists')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            {/* Editable name */}
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="h-8 w-64"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName()
                    if (e.key === 'Escape') {
                      setNameValue(list.name)
                      setEditingName(false)
                    }
                  }}
                />
                <Button size="icon" variant="ghost" onClick={saveName}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setNameValue(list.name)
                    setEditingName(false)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h1
                className="text-xl font-semibold cursor-pointer hover:text-primary flex items-center gap-2"
                onClick={() => setEditingName(true)}
              >
                {list.name}
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </h1>
            )}

            {/* Editable description */}
            {editingDescription ? (
              <div className="flex items-center gap-2">
                <Input
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  placeholder="Add description..."
                  className="h-7 w-80 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveDescription()
                    if (e.key === 'Escape') {
                      setDescriptionValue(list.description || '')
                      setEditingDescription(false)
                    }
                  }}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveDescription}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setDescriptionValue(list.description || '')
                    setEditingDescription(false)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <p
                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1"
                onClick={() => setEditingDescription(true)}
              >
                {list.description || 'Add description...'}
                <Pencil className="h-3 w-3" />
              </p>
            )}

            <p className="text-xs text-muted-foreground">{total} contacts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openSheetSync}>
            <Sheet className="h-4 w-4 mr-1" />
            Google Sheets
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Search and bulk actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button variant="destructive" size="sm" onClick={removeSelected}>
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        )}
      </div>

      {/* Contacts table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : contacts.length > 0 ? (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={contacts.length > 0 && selected.size === contacts.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(contact.id)}
                        onCheckedChange={() => toggleSelect(contact.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{contact.email}</TableCell>
                    <TableCell>{contact.name || '-'}</TableCell>
                    <TableCell>{contact.company || '-'}</TableCell>
                    <TableCell>{contact.phone || '-'}</TableCell>
                    <TableCell>{contact.country || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditContact(contact)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={async () => {
                            await listsApi.removeMember(listId, contact.id)
                            toast.success('Contact removed')
                            loadData()
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="border border-dashed rounded-lg py-12 text-center text-muted-foreground">
          <p>No contacts in this list</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import contacts
          </Button>
        </div>
      )}

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Paste CSV data</Label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="email,name,company&#10;john@example.com,John Doe,Acme Inc"
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                First row should be headers. Must include an &quot;email&quot; column.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing || !csvText.trim()}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit contact dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={editContact?.email || ''} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Company</Label>
              <Input
                value={editForm.company}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input
                value={editForm.country}
                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContact(null)}>
              Cancel
            </Button>
            <Button onClick={saveContact} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Sheets sync dialog */}
      <Dialog open={sheetSyncOpen} onOpenChange={setSheetSyncOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sheet className="h-5 w-5 text-green-600" />
              Sync from Google Sheets
            </DialogTitle>
            <DialogDescription>
              Import contacts directly from a Google Spreadsheet
            </DialogDescription>
          </DialogHeader>

          {sheetsConnected === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !sheetsConnected ? (
            <div className="py-8 text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500" />
              <p className="text-muted-foreground">
                Google Sheets is not connected. Please connect your Google account first.
              </p>
              <Button asChild>
                <Link to="/settings">Go to Settings</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Spreadsheet URL input */}
              <div className="space-y-2">
                <Label>Spreadsheet URL or ID</Label>
                <div className="flex gap-2">
                  <Input
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1"
                  />
                  <Button onClick={fetchSpreadsheetPreview} disabled={loadingPreview || !spreadsheetUrl.trim()}>
                    {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste the full URL or just the spreadsheet ID
                </p>
              </div>

              {/* Preview and mapping */}
              {sheetPreview && (
                <div className="space-y-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{sheetPreview.spreadsheetTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      Sheet: {sheetPreview.sheetName} - {sheetPreview.totalRows} rows found
                    </p>
                  </div>

                  {/* Column mapping */}
                  <div className="space-y-3">
                    <Label>Column Mapping</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Email (required)</Label>
                        <Select
                          value={columnMapping.email}
                          onValueChange={(v: string) => setColumnMapping({ ...columnMapping, email: v })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {sheetPreview.headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Select
                          value={columnMapping.name || ''}
                          onValueChange={(v: string) => setColumnMapping({ ...columnMapping, name: v || undefined })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {sheetPreview.headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">First Name</Label>
                        <Select
                          value={columnMapping.first_name || ''}
                          onValueChange={(v: string) => setColumnMapping({ ...columnMapping, first_name: v || undefined })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {sheetPreview.headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Last Name</Label>
                        <Select
                          value={columnMapping.last_name || ''}
                          onValueChange={(v: string) => setColumnMapping({ ...columnMapping, last_name: v || undefined })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {sheetPreview.headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Company</Label>
                        <Select
                          value={columnMapping.company || ''}
                          onValueChange={(v: string) => setColumnMapping({ ...columnMapping, company: v || undefined })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {sheetPreview.headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Country</Label>
                        <Select
                          value={columnMapping.country || ''}
                          onValueChange={(v: string) => setColumnMapping({ ...columnMapping, country: v || undefined })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {sheetPreview.headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Unmapped columns will be stored as custom fields
                    </p>
                  </div>

                  {/* Sample data preview */}
                  {sheetPreview.sampleRows.length > 0 && (
                    <div className="space-y-2">
                      <Label>Sample Data</Label>
                      <div className="border rounded-lg overflow-x-auto max-h-40">
                        <table className="w-full text-xs">
                          <thead className="bg-muted">
                            <tr>
                              {sheetPreview.headers.map((h) => (
                                <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheetPreview.sampleRows.slice(0, 3).map((row, i) => (
                              <tr key={i} className="border-t">
                                {sheetPreview.headers.map((h) => (
                                  <td key={h} className="px-2 py-1 truncate max-w-32">{row[h] || '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSheetSyncOpen(false)}>
              Cancel
            </Button>
            {sheetsConnected && (
              <Button
                onClick={handleSheetSync}
                disabled={syncing || !sheetPreview || !columnMapping.email}
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Sync {sheetPreview?.totalRows || 0} Contacts
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
