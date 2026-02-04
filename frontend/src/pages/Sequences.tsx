import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SequenceBranchBuilder } from '@/components/SequenceBranchBuilder'
import { 
  Plus, 
  Search, 
  Loader2, 
  ChevronLeft, 
  Trash2,
  Play,
  Pause,
  Users,
  Mail,
  Download
} from 'lucide-react'
import { 
  Sequence, 
  SequenceStep,
  SequenceEnrollment,
  getSequence, 
  getSequenceEnrollments,
  createBranchPoint,
  sequences as sequencesApi
} from '@/lib/api'

export default function Sequences() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  
  const { data: sequencesList, isLoading } = useQuery({
    queryKey: ['sequences'],
    queryFn: sequencesApi.list,
  })

  const filteredSequences = sequencesList?.filter(
    (seq) =>
      seq.name.toLowerCase().includes(search.toLowerCase()) ||
      seq.description?.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const handleEditSequence = async (id: number) => {
    try {
      const sequence = await getSequence(id)
      setEditingSequence(sequence)
    } catch {
      toast.error('Failed to load sequence')
    }
  }

  if (editingSequence) {
    return (
      <SequenceEditor
        sequence={editingSequence}
        onBack={() => {
          setEditingSequence(null)
          queryClient.invalidateQueries({ queryKey: ['sequences'] })
        }}
        onUpdate={(updated) => setEditingSequence(updated)}
      />
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Sequences</h1>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Sequence
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sequences..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSequences.length > 0 ? (
        <div className="space-y-2">
          {filteredSequences.map((sequence) => (
            <SequenceCard
              key={sequence.id}
              sequence={sequence}
              onEdit={() => handleEditSequence(sequence.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              {sequencesList?.length ? 'No sequences match your search' : 'No sequences yet'}
            </p>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Sequence
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateSequenceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(id) => handleEditSequence(id)}
      />
    </div>
  )
}

interface SequenceCardProps {
  sequence: {
    id: number
    name: string
    description: string | null
    enabled: boolean
    step_count: number
    active_enrollments: number
  }
  onEdit: () => void
}

function SequenceCard({ sequence, onEdit }: SequenceCardProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => sequencesApi.delete(sequence.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] })
      toast.success('Sequence deleted')
    },
    onError: () => {
      toast.error('Failed to delete sequence')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: () => sequencesApi.update(sequence.id, { enabled: !sequence.enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] })
      toast.success(sequence.enabled ? 'Sequence paused' : 'Sequence activated')
    },
    onError: () => {
      toast.error('Failed to update sequence')
    },
  })

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onEdit}
    >
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{sequence.name}</p>
            {sequence.enabled ? (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                Active
              </span>
            ) : (
              <span className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full">
                Paused
              </span>
            )}
          </div>
          {sequence.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{sequence.description}</p>
          )}
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {sequence.step_count} step{sequence.step_count !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {sequence.active_enrollments} active
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              toggleMutation.mutate()
            }}
            title={sequence.enabled ? 'Pause sequence' : 'Activate sequence'}
          >
            {sequence.enabled ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Delete this sequence? This cannot be undone.')) {
                deleteMutation.mutate()
              }
            }}
            title="Delete sequence"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface CreateSequenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: number) => void
}

function CreateSequenceDialog({ open, onOpenChange, onCreated }: CreateSequenceDialogProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const createMutation = useMutation({
    mutationFn: () => sequencesApi.create({ name, description: description || undefined }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] })
      toast.success('Sequence created')
      onOpenChange(false)
      setName('')
      setDescription('')
      onCreated(data.id)
    },
    onError: () => {
      toast.error('Failed to create sequence')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sequence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome Series"
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this sequence"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SequenceEditorProps {
  sequence: Sequence
  onBack: () => void
  onUpdate: (sequence: Sequence) => void
}

function SequenceEditor({ sequence, onBack, onUpdate }: SequenceEditorProps) {
  const queryClient = useQueryClient()
  const [stepDialogOpen, setStepDialogOpen] = useState(false)
  const [stepDialogBranch, setStepDialogBranch] = useState<string | null>(null)
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null)

  const refreshSequence = async () => {
    try {
      const updated = await getSequence(sequence.id)
      onUpdate(updated)
    } catch {
      toast.error('Failed to refresh sequence')
    }
  }

  const handleAddStep = (branchId: string | null) => {
    setStepDialogBranch(branchId)
    setEditingStep(null)
    setStepDialogOpen(true)
  }

  const handleAddBranchPoint = async (afterStep: number) => {
    try {
      await createBranchPoint(sequence.id, afterStep, 0)
      await refreshSequence()
      toast.success('Branch point added')
    } catch {
      toast.error('Failed to add branch point')
    }
  }

  const handleEditStep = (step: SequenceStep) => {
    setEditingStep(step)
    setStepDialogBranch(step.branch_id)
    setStepDialogOpen(true)
  }

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: number) => sequencesApi.deleteStep(sequence.id, stepId),
    onSuccess: async () => {
      await refreshSequence()
      toast.success('Step deleted')
    },
    onError: () => {
      toast.error('Failed to delete step')
    },
  })

  const handleDeleteStep = async (stepId: number) => {
    if (confirm('Delete this step?')) {
      deleteStepMutation.mutate(stepId)
    }
  }

  const toggleMutation = useMutation({
    mutationFn: () => sequencesApi.update(sequence.id, { enabled: !sequence.enabled }),
    onSuccess: async () => {
      await refreshSequence()
      queryClient.invalidateQueries({ queryKey: ['sequences'] })
      toast.success(sequence.enabled ? 'Sequence paused' : 'Sequence activated')
    },
    onError: () => {
      toast.error('Failed to update sequence')
    },
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold">{sequence.name}</h1>
            {sequence.description && (
              <p className="text-xs text-muted-foreground">{sequence.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/sequences/${sequence.id}/actions/export`, '_blank')}
            title="Export action clicks as CSV"
          >
            <Download className="h-4 w-4 mr-1" />
            Export Actions
          </Button>
          <Button
            variant={sequence.enabled ? 'outline' : 'default'}
            size="sm"
            onClick={() => toggleMutation.mutate()}
          >
            {sequence.enabled ? (
              <>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Activate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <SequenceBranchBuilder
              steps={sequence.steps}
              onAddStep={handleAddStep}
              onAddBranchPoint={handleAddBranchPoint}
              onEditStep={handleEditStep}
              onDeleteStep={handleDeleteStep}
            />
          </div>
          <div className="lg:col-span-1">
            <SequencePathStats sequenceId={sequence.id} />
          </div>
        </div>
      </div>

      {/* Step Dialog */}
      <StepDialog
        open={stepDialogOpen}
        onOpenChange={setStepDialogOpen}
        sequenceId={sequence.id}
        branchId={stepDialogBranch}
        step={editingStep}
        onSaved={refreshSequence}
      />
    </div>
  )
}

interface StepDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sequenceId: number
  branchId: string | null
  step: SequenceStep | null
  onSaved: () => void
}

function StepDialog({ open, onOpenChange, sequenceId, branchId, step, onSaved }: StepDialogProps) {
  const [subject, setSubject] = useState('')
  const [delayDays, setDelayDays] = useState(0)
  const [delayHours, setDelayHours] = useState(0)

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSubject(step?.subject || '')
      setDelayDays(step?.delay_days || 0)
      setDelayHours(step?.delay_hours || 0)
    }
    onOpenChange(newOpen)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (step) {
        // Update existing step
        return sequencesApi.updateStep(sequenceId, step.id, {
          subject,
          delayDays,
          delayHours,
        })
      } else {
        // Create new step
        return sequencesApi.addStep(sequenceId, {
          subject,
          delayDays,
          delayHours,
          branchId,
        })
      }
    },
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
      toast.success(step ? 'Step updated' : 'Step added')
    },
    onError: () => {
      toast.error(step ? 'Failed to update step' : 'Failed to add step')
    },
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : 'Add Step'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Welcome to our community!"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Delay (days)</Label>
              <Input
                type="number"
                min={0}
                value={delayDays}
                onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Delay (hours)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={delayHours}
                onChange={(e) => setDelayHours(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This email will be sent {delayDays > 0 || delayHours > 0 
              ? `${delayDays > 0 ? `${delayDays} day${delayDays !== 1 ? 's' : ''}` : ''}${delayDays > 0 && delayHours > 0 ? ' and ' : ''}${delayHours > 0 ? `${delayHours} hour${delayHours !== 1 ? 's' : ''}` : ''}`
              : 'immediately'} after the previous step.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!subject.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {step ? 'Save' : 'Add Step'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Sequence path stats component
function SequencePathStats({ sequenceId }: { sequenceId: number }) {
  const { data: enrollments } = useQuery({
    queryKey: ['sequence-enrollments', sequenceId],
    queryFn: () => getSequenceEnrollments(sequenceId)
  })

  if (!enrollments || enrollments.length === 0) return null

  const total = enrollments.length
  const onDefault = enrollments.filter((e) => !e.branch_id || e.branch_id === 'default').length
  const onAction = enrollments.filter((e) => e.branch_id === 'action').length
  const completed = enrollments.filter((e) => e.status === 'completed').length
  const actionClicked = enrollments.filter((e) => e.action_clicked_at).length

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Enrollments by Path</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total enrolled</span>
          <span className="font-medium">{total}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">On default path</span>
          <span className="font-medium">{onDefault} ({total > 0 ? ((onDefault/total)*100).toFixed(0) : 0}%)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">On action path</span>
          <span className="font-medium">{onAction} ({total > 0 ? ((onAction/total)*100).toFixed(0) : 0}%)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Completed</span>
          <span className="font-medium">{completed} ({total > 0 ? ((completed/total)*100).toFixed(0) : 0}%)</span>
        </div>
        {actionClicked > 0 && (
          <div className="flex justify-between text-sm border-t pt-2 mt-2">
            <span className="text-muted-foreground">Action button clicked</span>
            <span className="font-medium text-orange-600">{actionClicked} ({total > 0 ? ((actionClicked/total)*100).toFixed(0) : 0}%)</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
