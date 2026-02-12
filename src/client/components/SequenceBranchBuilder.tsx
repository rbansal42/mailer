import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, GitBranch, Clock, Pencil, Trash2 } from 'lucide-react'
import type { SequenceStep, SequenceBranch } from '@/lib/api'
import { BRANCH_ACTION, BRANCH_DEFAULT } from '../../shared/constants'

const TRIGGER_BADGES: Record<string, string> = {
  action_click: 'On Click',
  opened: 'Opens',
  clicked_any: 'Any Click',
  no_engagement: 'No Engagement',
}

function getTriggerBadgeText(branch: SequenceBranch): string {
  const base = TRIGGER_BADGES[branch.trigger_type] || branch.trigger_type
  if (branch.trigger_type === 'opened' && branch.trigger_config?.minOpens) {
    return `Opens >= ${branch.trigger_config.minOpens}`
  }
  if (branch.trigger_type === 'no_engagement' && branch.trigger_config?.afterSteps) {
    return `No Engagement (${branch.trigger_config.afterSteps} steps)`
  }
  return base
}

interface Props {
  steps: SequenceStep[]
  branches: SequenceBranch[]
  onAddStep: (branchId: string | null) => void
  onAddBranchPoint: (afterStep: number) => void
  onEditStep: (step: SequenceStep) => void
  onDeleteStep: (stepId: number) => void
  onAddBranch: () => void
  onEditBranch: (branch: SequenceBranch) => void
  onDeleteBranch: (branchId: string) => void
}

export function SequenceBranchBuilder({
  steps,
  branches,
  onAddStep,
  onAddBranchPoint,
  onEditStep,
  onDeleteStep,
  onAddBranch,
  onEditBranch,
  onDeleteBranch,
}: Props) {
  const mainSteps = steps.filter(s => !s.branch_id)
  const branchPoint = steps.find(s => s.is_branch_point)

  // Determine if we should use the legacy two-column layout or the new dynamic layout
  const useDynamicBranches = branches.length > 0

  // For legacy layout, group by hardcoded branch IDs
  const actionSteps = steps.filter(s => s.branch_id === BRANCH_ACTION)
  const defaultSteps = steps.filter(s => s.branch_id === BRANCH_DEFAULT)

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
              Branch Point
            </div>
          </div>

          {useDynamicBranches ? (
            /* Dynamic multi-branch layout */
            <>
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(branches.length + 1, 4)}, minmax(0, 1fr))`,
                }}
              >
                {/* Default Path (always present) */}
                <Card>
                  <CardHeader className="py-3 bg-muted/50">
                    <CardTitle className="text-sm font-medium">Default Path</CardTitle>
                    <p className="text-xs text-muted-foreground">No condition matched</p>
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

                {/* Dynamic branches */}
                {branches.map((branch) => {
                  const branchSteps = steps.filter(s => s.branch_id === branch.id)
                  return (
                    <Card key={branch.id}>
                      <CardHeader className="py-3" style={{ backgroundColor: `${branch.color}15` }}>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium truncate" title={branch.name}>
                            {branch.name}
                          </CardTitle>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onEditBranch(branch)}
                              title="Edit branch"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => onDeleteBranch(branch.id)}
                              title="Delete branch"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <span
                          className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1"
                          style={{
                            backgroundColor: `${branch.color}20`,
                            color: branch.color,
                          }}
                        >
                          {getTriggerBadgeText(branch)}
                        </span>
                        {branch.description && (
                          <p className="text-xs text-muted-foreground mt-1">{branch.description}</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2 pt-4">
                        {branchSteps.map((step, i) => (
                          <StepCard
                            key={step.id}
                            step={step}
                            index={i + 1}
                            onEdit={() => onEditStep(step)}
                            onDelete={() => onDeleteStep(step.id)}
                          />
                        ))}
                        <Button variant="outline" size="sm" onClick={() => onAddStep(branch.id)}>
                          <Plus className="w-4 h-4 mr-2" /> Add Step
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={onAddBranch}>
                  <Plus className="w-4 h-4 mr-2" /> Add Branch
                </Button>
              </div>
            </>
          ) : (
            /* Legacy two-column layout (no dynamic branches defined) */
            <>
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

              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={onAddBranch}>
                  <Plus className="w-4 h-4 mr-2" /> Add Branch
                </Button>
              </div>
            </>
          )}
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
