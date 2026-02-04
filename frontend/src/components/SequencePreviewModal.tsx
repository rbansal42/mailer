import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, ChevronDown, ChevronRight, Mail, Clock, Info } from 'lucide-react'
import { sequences as sequencesApi, GenerateSequenceResponse, Block } from '@/lib/api'

interface SequencePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  generatedSequence: GenerateSequenceResponse | null
  onCreated: (id: number) => void
}

export function SequencePreviewModal({ 
  open, 
  onOpenChange, 
  generatedSequence,
  onCreated 
}: SequencePreviewModalProps) {
  const queryClient = useQueryClient()
  const [expandedEmails, setExpandedEmails] = useState<Set<number>>(new Set())

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!generatedSequence) throw new Error('No sequence to create')
      
      // Create the sequence
      const { id } = await sequencesApi.create({
        name: generatedSequence.name,
        description: `AI-generated sequence with ${generatedSequence.emails.length} emails`,
      })

      // Add each email as a step
      for (const email of generatedSequence.emails) {
        await sequencesApi.addStep(id, {
          subject: email.subject,
          delayDays: email.delayDays,
          // Note: blocks would need to be stored separately or in template
          // For now, we just create the step structure
        })
      }

      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] })
      toast.success('Sequence created successfully')
      onOpenChange(false)
      onCreated(id)
    },
    onError: () => {
      toast.error('Failed to create sequence')
    },
  })

  const toggleEmail = (index: number) => {
    const newExpanded = new Set(expandedEmails)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedEmails(newExpanded)
  }

  const formatDelay = (days: number) => {
    if (days === 0) return 'Sends immediately'
    if (days === 1) return 'Sends after 1 day'
    return `Sends after ${days} days`
  }

  const renderBlockPreview = (block: Block) => {
    switch (block.type) {
      case 'text': {
        const content = (block.props as { content?: string }).content || ''
        // Strip HTML and truncate
        const text = content.replace(/<[^>]*>/g, '').slice(0, 100)
        return (
          <div className="text-sm text-muted-foreground pl-4 border-l-2 border-muted">
            {text}{content.length > 100 ? '...' : ''}
          </div>
        )
      }
      case 'button':
      case 'action-button': {
        const props = block.props as { text?: string }
        return (
          <div className="text-sm">
            <span className="inline-block px-2 py-1 bg-primary/10 text-primary rounded text-xs">
              {props.text || 'Button'}
            </span>
          </div>
        )
      }
      case 'spacer':
        return <div className="h-2" />
      case 'divider':
        return <hr className="border-muted" />
      default:
        return null
    }
  }

  if (!generatedSequence) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview: {generatedSequence.name}</DialogTitle>
        </DialogHeader>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 flex gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">Preview only</p>
            <p className="text-blue-600 dark:text-blue-400">
              This creates the sequence structure (subjects and timing). You'll add email content using the editor.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto py-4 space-y-3">
          {generatedSequence.emails.map((email, index) => (
            <Collapsible
              key={index}
              open={expandedEmails.has(index)}
              onOpenChange={() => toggleEmail(index)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">{email.subject}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDelay(email.delayDays)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {email.blocks.length} blocks
                      </span>
                    </div>
                  </div>
                  {expandedEmails.has(index) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t">
                    {email.blocks.map((block, blockIndex) => (
                      <div key={blockIndex}>
                        {renderBlockPreview(block)}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create Sequence'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
