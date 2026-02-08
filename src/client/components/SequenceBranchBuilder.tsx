import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, GitBranch, Clock } from 'lucide-react'
import { SequenceStep } from '@/lib/api'
import { BRANCH_ACTION, BRANCH_DEFAULT } from '../../shared/constants'

interface Props {
  steps: SequenceStep[]
  onAddStep: (branchId: string | null) => void
  onAddBranchPoint: (afterStep: number) => void
  onEditStep: (step: SequenceStep) => void
  onDeleteStep: (stepId: number) => void
}

export function SequenceBranchBuilder({ steps, onAddStep, onAddBranchPoint, onEditStep, onDeleteStep }: Props) {
  // Group steps by branch
  const mainSteps = steps.filter(s => !s.branch_id)
  const actionSteps = steps.filter(s => s.branch_id === BRANCH_ACTION)
  const defaultSteps = steps.filter(s => s.branch_id === BRANCH_DEFAULT)
  
  const branchPoint = steps.find(s => s.is_branch_point)

  return (
    <div className="space-y-4">
      {/* Main Path */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Main Path</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mainSteps.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No steps yet. Add your first step to get started.
            </p>
          )}
          {mainSteps.map((step, i) => (
            <StepCard 
              key={step.id} 
              step={step} 
              index={i + 1}
              onEdit={() => onEditStep(step)}
              onDelete={() => onDeleteStep(step.id)}
              showBranchButton={!branchPoint && i === mainSteps.length - 1}
              onAddBranchPoint={() => onAddBranchPoint(step.step_order)}
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => onAddStep(null)}>
            <Plus className="w-4 h-4 mr-2" /> Add Step
          </Button>
        </CardContent>
      </Card>

      {/* Branch Point */}
      {branchPoint && (
        <>
          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              <GitBranch className="w-4 h-4" />
              Branch Point: If action clicked
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Default Path */}
            <Card>
              <CardHeader className="py-3 bg-muted/50">
                <CardTitle className="text-sm font-medium">Default Path (no action)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {defaultSteps.map((step, i) => (
                  <StepCard 
                    key={step.id} 
                    step={step} 
                    index={i + 1}
                    onEdit={() => onEditStep(step)}
                    onDelete={() => onDeleteStep(step.id)}
                  />
                ))}
                <Button variant="outline" size="sm" onClick={() => onAddStep(BRANCH_DEFAULT)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Step
                </Button>
              </CardContent>
            </Card>

            {/* Action Path */}
            <Card>
              <CardHeader className="py-3 bg-green-50">
                <CardTitle className="text-sm font-medium">Action Path (clicked)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {actionSteps.map((step, i) => (
                  <StepCard 
                    key={step.id} 
                    step={step} 
                    index={i + 1}
                    onEdit={() => onEditStep(step)}
                    onDelete={() => onDeleteStep(step.id)}
                  />
                ))}
                <Button variant="outline" size="sm" onClick={() => onAddStep(BRANCH_ACTION)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Step
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function StepCard({ step, index, onEdit, onDelete, showBranchButton, onAddBranchPoint }: {
  step: SequenceStep
  index: number
  onEdit: () => void
  onDelete: () => void
  showBranchButton?: boolean
  onAddBranchPoint?: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
      <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full text-sm font-medium">
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{step.subject}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Wait {step.delay_days}d {step.delay_hours}h
        </p>
      </div>
      <div className="flex gap-1">
        {showBranchButton && (
          <Button variant="ghost" size="sm" onClick={onAddBranchPoint} aria-label="Add branch point">
            <GitBranch className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit step ${index}`}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete step ${index}`}>Delete</Button>
      </div>
    </div>
  )
}
