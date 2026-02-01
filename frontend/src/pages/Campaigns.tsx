import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Template, Draft, Mail, mails as mailsApi, listsApi, ContactList } from '../lib/api'
import { useAuthStore } from '../hooks/useAuthStore'

// Get token with fallback to localStorage (handles Zustand hydration race)
function getToken(): string | null {
  const storeToken = useAuthStore.getState().token;
  if (storeToken) return storeToken;
  
  try {
    const stored = localStorage.getItem('mailer-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}
import DOMPurify from 'isomorphic-dompurify'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Plus, Send, Save, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { Recipient } from '../lib/api'

export default function Campaigns() {
  const [isComposing, setIsComposing] = useState(false)
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)
  
  const { data: drafts, isLoading: loadingDrafts } = useQuery({
    queryKey: ['drafts'],
    queryFn: api.getDrafts,
  })

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  })

  const { data: mails } = useQuery({
    queryKey: ['mails'],
    queryFn: mailsApi.list,
  })

  if (isComposing || selectedDraft) {
    return (
      <CampaignComposer
        draft={selectedDraft}
        templates={templates || []}
        mails={mails || []}
        onBack={() => {
          setIsComposing(false)
          setSelectedDraft(null)
        }}
      />
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Campaigns</h1>
        <Button size="sm" onClick={() => setIsComposing(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Campaign
        </Button>
      </div>

      {loadingDrafts ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : drafts && drafts.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Drafts</h2>
          {drafts.map((draft) => (
            <Card
              key={draft.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedDraft(draft)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{draft.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {draft.recipients?.length || 0} recipients
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(draft.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No drafts yet</p>
            <Button size="sm" onClick={() => setIsComposing(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface ComposerProps {
  draft: Draft | null
  templates: Template[]
  mails: Mail[]
  onBack: () => void
}

function CampaignComposer({ draft, templates, mails, onBack }: ComposerProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(draft?.name || '')
  // Determine content source from draft - if mailId exists, use mail; otherwise template
  const [contentSource, setContentSource] = useState<'mail' | 'template'>(
    draft?.mailId ? 'mail' : (draft?.templateId ? 'template' : 'mail')
  )
  const [mailId, setMailId] = useState<number | null>(draft?.mailId || null)
  const [templateId, setTemplateId] = useState<number | null>(draft?.templateId || null)
  const [subject, setSubject] = useState(draft?.subject || '')
  const [recipientsText, setRecipientsText] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>(draft?.recipients || [])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number; logs: string[] } | null>(null)
  const [testEmails, setTestEmails] = useState(draft?.testEmail || '')
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  
  // List picker state
  const [lists, setLists] = useState<ContactList[]>([])
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [saveListOpen, setSaveListOpen] = useState(false)
  const [newListName, setNewListName] = useState('')

  const selectedMail = mails.find((m) => m.id === mailId)
  const selectedTemplate = templates.find((t) => t.id === templateId)
  const selectedContent = contentSource === 'mail' ? selectedMail : selectedTemplate

  // Load lists on mount
  useEffect(() => {
    listsApi.getAll().then(setLists).catch(console.error)
  }, [])

  // Parse recipients from text
  const parseRecipients = (text: string): Recipient[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(/[,\t]/).map((h) => h.trim().toLowerCase())
    const emailIndex = headers.findIndex((h) => h === 'email')
    if (emailIndex === -1) return []

    return lines.slice(1).map((line) => {
      const values = line.split(/[,\t]/)
      const recipient: Recipient = { email: '' }
      headers.forEach((header, i) => {
        recipient[header] = values[i]?.trim() || ''
      })
      return recipient
    }).filter((r) => r.email)
  }

  const handleRecipientsChange = (text: string) => {
    setRecipientsText(text)
    setRecipients(parseRecipients(text))
    setPreviewIndex(0)
  }

  // Validation
  const validation = {
    hasName: name.trim().length > 0,
    hasContent: selectedContent !== undefined,
    hasSubject: subject.trim().length > 0,
    hasRecipients: recipients.length > 0,
    invalidEmails: recipients.filter((r) => !r.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
    duplicates: recipients.filter((r, i) => recipients.findIndex((r2) => r2.email === r.email) !== i),
  }

  const canSend = validation.hasName && validation.hasContent && validation.hasSubject && validation.hasRecipients && validation.invalidEmails.length === 0

  // Parse test emails (comma, semicolon, or newline separated)
  const parseTestEmails = (text: string): string[] => {
    return text
      .split(/[,;\n]/)
      .map(e => e.trim())
      .filter(e => e.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
  }

  const parsedTestEmails = parseTestEmails(testEmails)
  const canSendTest = validation.hasContent && validation.hasSubject && parsedTestEmails.length > 0

  const handleSendTest = async () => {
    if (!canSendTest) return
    setSendingTest(true)
    setTestResult(null)

    try {
      // Use first recipient data for variable substitution, or empty object
      const sampleData = recipients[0] || { email: parsedTestEmails[0], name: 'Test User' }
      
      // Create test recipients with sample data
      const testRecipients = parsedTestEmails.map(email => ({
        ...sampleData,
        email,
      }))

      // Build URL with either templateId or mailId
      const contentParam = contentSource === 'mail' && mailId 
        ? `mailId=${mailId}` 
        : `templateId=${templateId}`
      
      const token = getToken()
      const response = await fetch(
        `/api/send?${contentParam}&subject=${encodeURIComponent('[TEST] ' + subject)}&recipients=${encodeURIComponent(JSON.stringify(testRecipients))}&name=${encodeURIComponent('Test: ' + (name || 'Unnamed'))}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      )

      if (response.ok) {
        setTestResult({ success: true, message: `Test sent to ${parsedTestEmails.length} address(es)` })
      } else {
        const data = await response.json()
        setTestResult({ success: false, message: data.error || 'Failed to send test' })
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to send test email' })
    } finally {
      setSendingTest(false)
    }
  }

  const saveDraftMutation = useMutation({
    mutationFn: (data: Partial<Draft>) => draft
      ? api.updateDraft(draft.id, data)
      : api.createDraft(data as Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
    },
  })

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({
      name,
      templateId: contentSource === 'template' ? templateId : null,
      mailId: contentSource === 'mail' ? mailId : null,
      subject,
      testEmail: testEmails || null,
      recipients,
    })
  }

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    setSendProgress({ current: 0, total: recipients.length, logs: [] })

    try {
      // Build URL with either templateId or mailId
      const contentParam = contentSource === 'mail' && mailId 
        ? `mailId=${mailId}` 
        : `templateId=${templateId}`
      const token = getToken()
      const eventSource = new EventSource(
        `/api/send?${contentParam}&subject=${encodeURIComponent(subject)}&recipients=${encodeURIComponent(JSON.stringify(recipients))}&name=${encodeURIComponent(name)}&token=${token}`
      )

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'progress') {
          setSendProgress((prev) => ({
            current: data.current,
            total: data.total,
            logs: [...(prev?.logs || []), data.message],
          }))
        } else if (data.type === 'complete') {
          eventSource.close()
          setSending(false)
          queryClient.invalidateQueries({ queryKey: ['campaigns'] })
          queryClient.invalidateQueries({ queryKey: ['drafts'] })
        } else if (data.type === 'error') {
          eventSource.close()
          setSending(false)
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        setSending(false)
      }
    } catch (error) {
      setSending(false)
    }
  }

  // Replace variables in text
  const replaceVariables = (text: string, data: Record<string, string>) => {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key.toLowerCase()] || `{{${key}}}`)
  }

  const currentRecipient = recipients[previewIndex] || {}

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold">{draft ? 'Edit Draft' : 'New Campaign'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saveDraftMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            Save Draft
          </Button>
          <Button size="sm" onClick={handleSend} disabled={!canSend || sending}>
            <Send className="h-4 w-4 mr-1" />
            Send
          </Button>
        </div>
      </div>

      {/* Sending Progress */}
      {sendProgress && (
        <div className="p-3 border-b bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Sending: {sendProgress.current}/{sendProgress.total}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round((sendProgress.current / sendProgress.total) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
            />
          </div>
          <div className="mt-2 max-h-32 overflow-y-auto text-xs font-mono">
            {sendProgress.logs.slice(-5).map((log, i) => (
              <p key={i} className="text-muted-foreground">{log}</p>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Form */}
        <div className="w-1/2 p-4 overflow-y-auto border-r space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Campaign Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="March Newsletter"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email Content</Label>
              <div className="flex gap-1 mb-1">
                <button
                  type="button"
                  className={`flex-1 h-7 text-xs rounded-md border ${contentSource === 'mail' ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background'}`}
                  onClick={() => { setContentSource('mail'); setTemplateId(null) }}
                >
                  Mails ({mails.length})
                </button>
                <button
                  type="button"
                  className={`flex-1 h-7 text-xs rounded-md border ${contentSource === 'template' ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background'}`}
                  onClick={() => { setContentSource('template'); setMailId(null) }}
                >
                  Templates ({templates.length})
                </button>
              </div>
              {contentSource === 'mail' ? (
                <select
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                  value={mailId || ''}
                  onChange={(e) => setMailId(Number(e.target.value) || null)}
                >
                  <option value="">Select a saved mail...</option>
                  {mails.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                  value={templateId || ''}
                  onChange={(e) => setTemplateId(Number(e.target.value) || null)}
                >
                  <option value="">Select a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Hey {{name}}, check this out!"
              className="h-8 text-sm"
            />
          </div>

          {/* Test Email Section */}
          <Card className="bg-muted/30">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Send Test Email</Label>
                {testResult && (
                  <span className={`text-xs ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={testEmails}
                  onChange={(e) => setTestEmails(e.target.value)}
                  placeholder="test@example.com, another@example.com"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={!canSendTest || sendingTest}
                >
                  {sendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Test
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Separate multiple addresses with commas. Uses first recipient's data for variables.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label className="text-xs">Recipients</Label>
            
            {!showManualEntry ? (
              <div className="space-y-2">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={selectedListId || ''}
                  onChange={(e) => {
                    const id = e.target.value ? parseInt(e.target.value) : null
                    setSelectedListId(id)
                    if (id) {
                      // Load list contacts as recipients
                      listsApi.getMembers(id, 1, 10000).then(data => {
                        const text = ['email,name,company,phone,country',
                          ...data.contacts.map(c => 
                            [c.email, c.name || '', c.company || '', c.phone || '', c.country || ''].join(',')
                          )
                        ].join('\n')
                        handleRecipientsChange(text)
                      })
                    }
                  }}
                >
                  <option value="">Select a list...</option>
                  {lists.map(list => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.contact_count} contacts)
                    </option>
                  ))}
                </select>
                
                {selectedListId && recipients.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {recipients.length} recipients from selected list
                  </p>
                )}
                
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setShowManualEntry(true)}
                >
                  Or paste recipients manually
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setShowManualEntry(false)
                    setSelectedListId(null)
                    handleRecipientsChange('')
                  }}
                >
                  Use a saved list instead
                </button>
                <textarea
                  className="w-full h-40 text-xs font-mono rounded-md border border-input bg-background px-3 py-2 resize-none"
                  value={recipientsText}
                  onChange={(e) => handleRecipientsChange(e.target.value)}
                  placeholder="email,name,company&#10;john@example.com,John,ACME&#10;sara@example.com,Sara,Beta"
                />
                
                {recipients.length > 0 && !selectedListId && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setSaveListOpen(true)}
                  >
                    Save these {recipients.length} contacts as a new list?
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Validation */}
          <Card className="bg-muted/50">
            <CardContent className="p-3 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                {validation.hasRecipients ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span>{recipients.length} recipients detected</span>
              </div>
              {validation.invalidEmails.length > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{validation.invalidEmails.length} invalid email(s)</span>
                </div>
              )}
              {validation.duplicates.length > 0 && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{validation.duplicates.length} duplicate(s)</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="w-1/2 p-4 overflow-y-auto bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Preview</span>
            {recipients.length > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                  disabled={previewIndex === 0}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {previewIndex + 1}/{recipients.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setPreviewIndex(Math.min(recipients.length - 1, previewIndex + 1))}
                  disabled={previewIndex >= recipients.length - 1}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <Card>
            <CardHeader className="p-3 pb-2">
              <p className="text-xs text-muted-foreground">To: {currentRecipient.email || 'recipient@example.com'}</p>
              <p className="text-sm font-medium">
                {replaceVariables(subject, currentRecipient) || 'Subject line'}
              </p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {selectedContent ? (
                <div className="text-sm border rounded p-3 bg-background">
                  {/* Render blocks with variables replaced */}
                  {selectedContent.blocks.map((block) => (
                    <div key={block.id} className="mb-2">
                      {block.type === 'header' && (
                        <div 
                          className="p-4 text-center" 
                          style={{ backgroundColor: String(block.props.backgroundColor) || '#f3f4f6' }}
                        >
                          {block.props.imageUrl ? (
                            <img src={String(block.props.imageUrl)} alt="" className="h-12 mx-auto" />
                          ) : (
                            <div className="h-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                              Header
                            </div>
                          )}
                        </div>
                      )}
                      {block.type === 'text' && (
                        <div
                          className="p-3 prose prose-sm max-w-none"
                          style={{ 
                            fontSize: Number(block.props.fontSize) || 14, 
                            textAlign: (block.props.align as 'left' | 'center' | 'right') || 'left' 
                          }}
                          dangerouslySetInnerHTML={{ 
                            __html: DOMPurify.sanitize(
                              replaceVariables(String(block.props.content || ''), currentRecipient)
                            )
                          }}
                        />
                      )}
                      {block.type === 'image' && (
                        <div className="p-3" style={{ textAlign: (block.props.align as 'left' | 'center' | 'right') || 'center' }}>
                          {block.props.url ? (
                            <img 
                              src={String(block.props.url)} 
                              alt={String(block.props.alt) || ''} 
                              style={{ 
                                maxWidth: block.props.width ? `${block.props.width}%` : '100%',
                                objectFit: (block.props.objectFit as 'contain' | 'cover' | 'fill') || 'contain',
                              }} 
                            />
                          ) : (
                            <div className="h-24 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                              Image
                            </div>
                          )}
                        </div>
                      )}
                      {block.type === 'button' && (
                        <div className="p-3" style={{ textAlign: (block.props.align as 'left' | 'center' | 'right') || 'center' }}>
                          <button 
                            className="px-4 py-2 text-white rounded text-sm"
                            style={{ backgroundColor: String(block.props.color) || '#0f172a' }}
                          >
                            {String(block.props.label) || 'Click Here'}
                          </button>
                        </div>
                      )}
                      {block.type === 'divider' && (
                        <hr 
                          className="mx-3"
                          style={{ 
                            borderStyle: String(block.props.style) || 'solid',
                            borderColor: String(block.props.color) || '#e5e7eb',
                          }}
                        />
                      )}
                      {block.type === 'spacer' && (
                        <div style={{ height: Number(block.props.height) || 20 }} />
                      )}
                      {block.type === 'columns' && (
                        <div 
                          className="p-3 grid gap-2" 
                          style={{ gridTemplateColumns: `repeat(${Number(block.props.count) || 2}, 1fr)` }}
                        >
                          {Array.from({ length: Number(block.props.count) || 2 }).map((_, i) => (
                            <div key={i} className="bg-muted rounded p-2 text-xs text-center text-muted-foreground">
                              Column {i + 1}
                            </div>
                          ))}
                        </div>
                      )}
                      {block.type === 'footer' && (
                        <div className="p-4 text-center text-xs text-muted-foreground bg-muted/50">
                          {replaceVariables(String(block.props.text || ''), currentRecipient) || '© 2026 Company'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a mail or template to preview</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save as List Dialog */}
      <Dialog open={saveListOpen} onOpenChange={setSaveListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Save these {recipients.length} contacts as a reusable list.
            </p>
            <div className="space-y-2">
              <Label>List Name</Label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Q1 Newsletter Recipients"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveListOpen(false)}>Cancel</Button>
            <Button
              disabled={!newListName.trim()}
              onClick={async () => {
                try {
                  const list = await listsApi.create({ name: newListName })
                  await listsApi.addMembers(list.id, recipients.map(r => ({
                    ...r,
                    email: r.email,
                    name: r.name,
                    company: r.company,
                  })))
                  setLists([list, ...lists])
                  setSelectedListId(list.id)
                  setShowManualEntry(false)
                  setSaveListOpen(false)
                  setNewListName('')
                } catch (error) {
                  console.error('Failed to save list:', error)
                }
              }}
            >
              Save List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
