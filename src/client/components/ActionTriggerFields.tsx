import { Label } from './ui/label'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

interface ActionTriggerFieldsProps {
  destinationType: string
  destinationUrl: string
  hostedMessage: string
  onChange: (props: Record<string, unknown>) => void
  /** Controls inner spacing: 'compact' uses space-y-1, 'normal' uses space-y-2 */
  spacing?: 'compact' | 'normal'
}

export function ActionTriggerFields({
  destinationType,
  destinationUrl,
  hostedMessage,
  onChange,
  spacing = 'normal',
}: ActionTriggerFieldsProps) {
  const spacingClass = spacing === 'compact' ? 'space-y-1' : 'space-y-2'

  return (
    <>
      <div className={spacingClass}>
        <Label className="text-xs">When Clicked</Label>
        <Select 
          value={String(destinationType || 'hosted')} 
          onValueChange={(v) => onChange({ destinationType: v })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hosted">Show Thank You Page</SelectItem>
            <SelectItem value="external">Redirect to URL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {destinationType === 'external' ? (
        <div className={spacingClass}>
          <Label className="text-xs">Destination URL</Label>
          <Input
            value={String(destinationUrl || '')}
            onChange={(e) => onChange({ destinationUrl: e.target.value })}
            placeholder="https://..."
            className="h-8 text-xs"
          />
        </div>
      ) : (
        <div className={spacingClass}>
          <Label className="text-xs">Thank You Message</Label>
          <Textarea
            value={String(hostedMessage || '')}
            onChange={(e) => onChange({ hostedMessage: e.target.value })}
            placeholder="Thank you for your response!"
            rows={3}
            className="text-xs"
          />
        </div>
      )}
    </>
  )
}
