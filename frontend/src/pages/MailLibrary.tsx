import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Template, Mail, mails } from '../lib/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Plus, Loader2, FileText, Mail as MailIcon } from 'lucide-react'
import { TemplateEditor } from './Templates'
import { cn } from '../lib/utils'

type Tab = 'mails' | 'templates'

export default function MailLibrary() {
  const [activeTab, setActiveTab] = useState<Tab>('mails')
  const [editingMail, setEditingMail] = useState<Mail | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [isCreatingMail, setIsCreatingMail] = useState(false)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [showTemplatePickerDialog, setShowTemplatePickerDialog] = useState(false)

  const queryClient = useQueryClient()

  const { data: mailsList, isLoading: mailsLoading } = useQuery({
    queryKey: ['mails'],
    queryFn: mails.list,
  })

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  })

  const createMailMutation = useMutation({
    mutationFn: mails.create,
    onSuccess: (newMail) => {
      queryClient.invalidateQueries({ queryKey: ['mails'] })
      setShowTemplatePickerDialog(false)
      setEditingMail(newMail)
    },
  })

  const handleNewMail = () => {
    setShowTemplatePickerDialog(true)
  }

  const handleCreateFromTemplate = (template: Template | null) => {
    createMailMutation.mutate({
      name: template ? `${template.name} Copy` : 'Untitled Mail',
      blocks: template?.blocks || [],
      templateId: template?.id,
    })
  }

  const handleSaveAsTemplate = async (mailId: number, name: string) => {
    await mails.saveAsTemplate(mailId, { name })
    queryClient.invalidateQueries({ queryKey: ['templates'] })
  }

  // Show editor for mails
  if (editingMail || isCreatingMail) {
    return (
      <TemplateEditor
        template={editingMail ? {
          id: editingMail.id,
          name: editingMail.name,
          description: editingMail.description || undefined,
          blocks: editingMail.blocks,
          createdAt: editingMail.createdAt,
          updatedAt: editingMail.updatedAt,
        } : null}
        onBack={() => {
          setEditingMail(null)
          setIsCreatingMail(false)
        }}
        isMail={true}
        onSaveAsTemplate={editingMail ? (name: string) => handleSaveAsTemplate(editingMail.id, name) : undefined}
      />
    )
  }

  // Show editor for templates
  if (editingTemplate || isCreatingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onBack={() => {
          setEditingTemplate(null)
          setIsCreatingTemplate(false)
        }}
      />
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Mail Library</h1>
        {activeTab === 'mails' ? (
          <Button size="sm" onClick={handleNewMail}>
            <Plus className="h-4 w-4 mr-1" />
            New Mail
          </Button>
        ) : (
          <Button size="sm" onClick={() => setIsCreatingTemplate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Template
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => setActiveTab('mails')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'mails'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <MailIcon className="h-4 w-4" />
          Mails
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'templates'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="h-4 w-4" />
          Templates
        </button>
      </div>

      {/* Mails Tab */}
      {activeTab === 'mails' && (
        <>
          {mailsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mailsList && mailsList.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {mailsList.map((mail) => (
                <Card
                  key={mail.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setEditingMail(mail)}
                >
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MailIcon className="h-4 w-4 text-muted-foreground" />
                      {mail.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-muted-foreground">
                      {mail.blocks?.length || 0} blocks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(mail.updatedAt).toLocaleDateString()}
                    </p>
                    {mail.status === 'sent' && (
                      <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
                        Sent
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No mails yet</p>
                <Button size="sm" onClick={handleNewMail}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Mail
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <>
          {templatesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setEditingTemplate(template)}
                >
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {template.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-muted-foreground">
                      {template.blocks?.length || 0} blocks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(template.updatedAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground mb-4">No templates yet</p>
                <Button size="sm" onClick={() => setIsCreatingTemplate(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Template Picker Dialog */}
      <Dialog open={showTemplatePickerDialog} onOpenChange={setShowTemplatePickerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Mail</DialogTitle>
            <DialogDescription>
              Start from a template or create a blank mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={() => handleCreateFromTemplate(null)}
              disabled={createMailMutation.isPending}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Blank Mail</p>
                  <p className="text-xs text-muted-foreground">Start from scratch</p>
                </div>
              </div>
            </Button>

            {templates && templates.length > 0 && (
              <>
                <div className="text-sm font-medium text-muted-foreground pt-2">
                  Or start from a template:
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {templates.map((template) => (
                    <Button
                      key={template.id}
                      variant="outline"
                      className="w-full justify-start h-auto py-3"
                      onClick={() => handleCreateFromTemplate(template)}
                      disabled={createMailMutation.isPending}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {template.blocks?.length || 0} blocks
                          </p>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
