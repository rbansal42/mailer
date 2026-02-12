import { useState } from 'react'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'

interface BranchConditionEditorProps {
  triggerType: string
  triggerConfig: Record<string, unknown>
  name: string
  color: string
  description?: string
  onUpdate: (data: {
    triggerType: string
    triggerConfig: Record<string, unknown>
    name: string
    color: string
    description?: string
  }) => void
  isNew?: boolean
}

const TRIGGER_LABELS: Record<string, { label: string; description: string }> = {
  action_click: { label: 'Action Button Click', description: 'Recipient clicked a specific action button' },
  opened: { label: 'Opened Emails', description: 'Recipient opened a minimum number of emails' },
  clicked_any: { label: 'Clicked Any Link', description: 'Recipient clicked any link in an email' },
  no_engagement: { label: 'No Engagement', description: 'Recipient has not engaged after N steps' },
}

const BRANCH_COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6',
]

export function BranchConditionEditor({ triggerType, triggerConfig, name, color, description, onUpdate, isNew }: BranchConditionEditorProps) {
  const [localType, setLocalType] = useState(triggerType)
  const [localConfig, setLocalConfig] = useState(triggerConfig)
  const [localName, setLocalName] = useState(name)
  const [localColor, setLocalColor] = useState(color)
  const [localDesc, setLocalDesc] = useState(description || '')

  const handleSave = () => {
    onUpdate({
      triggerType: localType,
      triggerConfig: localConfig,
      name: localName,
      color: localColor,
      description: localDesc || undefined,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Branch Name</Label>
        <Input value={localName} onChange={(e) => setLocalName(e.target.value)} placeholder="e.g., Interested Path" />
      </div>

      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Input value={localDesc} onChange={(e) => setLocalDesc(e.target.value)} placeholder="What this branch is for" />
      </div>

      <div className="space-y-2">
        <Label>Trigger Condition</Label>
        <Select value={localType} onValueChange={(v) => { setLocalType(v); setLocalConfig({}) }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TRIGGER_LABELS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {TRIGGER_LABELS[localType]?.description}
        </p>
      </div>

      {/* Trigger-specific config */}
      {localType === 'action_click' && (
        <div className="space-y-2">
          <Label>Button ID (optional)</Label>
          <Input
            value={(localConfig.buttonId as string) || ''}
            onChange={(e) => setLocalConfig({ ...localConfig, buttonId: e.target.value || undefined })}
            placeholder="Leave empty for any action button"
          />
        </div>
      )}

      {localType === 'opened' && (
        <div className="space-y-2">
          <Label>Minimum Opens</Label>
          <Input
            type="number"
            min={1}
            value={(localConfig.minOpens as number) || 1}
            onChange={(e) => setLocalConfig({ ...localConfig, minOpens: parseInt(e.target.value) || 1 })}
          />
        </div>
      )}

      {localType === 'no_engagement' && (
        <div className="space-y-2">
          <Label>After N Steps Without Engagement</Label>
          <Input
            type="number"
            min={1}
            value={(localConfig.afterSteps as number) || 3}
            onChange={(e) => setLocalConfig({ ...localConfig, afterSteps: parseInt(e.target.value) || 3 })}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Branch Color</Label>
        <div className="flex gap-2 flex-wrap">
          {BRANCH_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Select color ${c}`}
              className={`w-6 h-6 rounded-full border-2 ${localColor === c ? 'border-foreground' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              onClick={() => setLocalColor(c)}
            />
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={!localName.trim()} className="w-full">
        {isNew ? 'Create Branch' : 'Update Branch'}
      </Button>
    </div>
  )
}
