import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Mail, Clock, Trash2 } from 'lucide-react'

interface EmailNodeData {
  label: string
  stepNumber: number
  delayDays: number
  delayHours: number
  blockCount: number
  branchColor: string | null
  onEdit: () => void
  onDelete: () => void
  [key: string]: unknown
}

export const EmailNode = memo(({ data }: NodeProps) => {
  const d = data as EmailNodeData
  return (
    <div
      className="bg-card border rounded-lg shadow-sm px-4 py-3 min-w-[220px] max-w-[260px] cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeftColor: d.branchColor || '#6366f1', borderLeftWidth: 3 }}
      onClick={d.onEdit}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Step {d.stepNumber}</span>
      </div>
      <p className="text-sm font-medium truncate">{d.label}</p>
      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>
          {[d.delayDays > 0 && `${d.delayDays}d`, d.delayHours > 0 && `${d.delayHours}h`].filter(Boolean).join(' ') || 'Immediate'}
        </span>
        {d.blockCount > 0 && (
          <span className="ml-auto bg-muted px-1.5 py-0.5 rounded text-[10px]">
            {d.blockCount} blocks
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  )
})
EmailNode.displayName = 'EmailNode'
