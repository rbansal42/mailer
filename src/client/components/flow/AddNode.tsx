import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Plus } from 'lucide-react'

interface AddNodeData {
  onClick: () => void
  [key: string]: unknown
}

export const AddNode = memo(({ data }: NodeProps) => {
  const d = data as AddNodeData
  return (
    <div
      className="w-7 h-7 bg-primary/10 hover:bg-primary/20 border border-dashed border-primary/40 rounded-full flex items-center justify-center cursor-pointer transition-colors"
      onClick={d.onClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-none !w-0 !h-0" />
      <Plus className="w-3.5 h-3.5 text-primary/60" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none !w-0 !h-0" />
    </div>
  )
})
AddNode.displayName = 'AddNode'
