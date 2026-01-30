import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Template, Draft } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Plus, Send, Save, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

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

  if (isComposing || selectedDraft) {
    return (
      <CampaignComposer
        draft={selectedDraft}
        templates={templates || []}
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
  onBack: () => void
}

function CampaignComposer({ draft, templates, onBack }: ComposerProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(draft?.name || '')
  const [templateId, setTemplateId] = useState<number | null>(draft?.templateId || null)
  const [subject, setSubject] = useState(draft?.subject || '')
  const [recipientsText, setRecipientsText] = useState('')
  const [recipients, setRecipients] = useState<Record<string, string>[]>(draft?.recipients || [])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number; logs: string[] } | null>(null)

  const selectedTemplate = templates.find((t) => t.id === templateId)

  // Parse recipients from text
  const parseRecipients = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(/[,\t]/).map((h) => h.trim().toLowerCase())
    const emailIndex = headers.findIndex((h) => h === 'email')
    if (emailIndex === -1) return []

    return lines.slice(1).map((line) => {
      const values = line.split(/[,\t]/)
      const recipient: Record<string, string> = {}
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
    hasTemplate: templateId !== null,
    hasSubject: subject.trim().length > 0,
    hasRecipients: recipients.length > 0,
    invalidEmails: recipients.filter((r) => !r.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
    duplicates: recipients.filter((r, i) => recipients.findIndex((r2) => r2.email === r.email) !== i),
  }

  const canSend = validation.hasName && validation.hasTemplate && validation.hasSubject && validation.hasRecipients && validation.invalidEmails.length === 0

  const saveDraftMutation = useMutation({
    mutationFn: draft
      ? (data: Partial<Draft>) => api.updateDraft(draft.id, data)
      : (data: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>) => api.createDraft(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
    },
  })

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({
      name,
      templateId: templateId!,
      subject,
      recipients,
    })
  }

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    setSendProgress({ current: 0, total: recipients.length, logs: [] })

    try {
      const eventSource = new EventSource(
        `/api/send?templateId=${templateId}&subject=${encodeURIComponent(subject)}&recipients=${encodeURIComponent(JSON.stringify(recipients))}&name=${encodeURIComponent(name)}`
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
              <Label className="text-xs">Template</Label>
              <select
                className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
                value={templateId || ''}
                onChange={(e) => setTemplateId(Number(e.target.value) || null)}
              >
                <option value="">Select template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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

          <div className="space-y-1">
            <Label className="text-xs">Recipients (CSV/TSV)</Label>
            <textarea
              className="w-full h-40 text-xs font-mono rounded-md border border-input bg-background px-3 py-2 resize-none"
              value={recipientsText}
              onChange={(e) => handleRecipientsChange(e.target.value)}
              placeholder="name,email,company&#10;John,john@example.com,ACME&#10;Sara,sara@example.com,Beta"
            />
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
              {selectedTemplate ? (
                <div className="text-sm border rounded p-3 bg-background">
                  {/* Render template blocks with variables replaced */}
                  {selectedTemplate.blocks.map((block) => (
                    <div key={block.id} className="mb-2">
                      {block.type === 'text' && (
                        <p>{replaceVariables(String(block.props.content || ''), currentRecipient)}</p>
                      )}
                      {block.type === 'header' && (
                        <div className="font-bold text-lg">{String(block.props.text || 'Header')}</div>
                      )}
                      {block.type === 'button' && (
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm">
                          {String(block.props.label || 'Button')}
                        </button>
                      )}
                      {block.type === 'divider' && <hr className="my-2" />}
                      {block.type === 'spacer' && <div style={{ height: Number(block.props.height) || 20 }} />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a template to preview</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
