import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CircleCheck } from 'lucide-react'

export const EndNode = memo(({}: NodeProps) => {
  return (
    <div className="bg-muted border rounded-full px-3 py-1.5 flex items-center gap-1.5">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />
      <CircleCheck className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">End</span>
    </div>
  )
})
EndNode.displayName = 'EndNode'
