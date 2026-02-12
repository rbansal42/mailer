import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'

interface BranchNodeData {
  label: string
  branchCount: number
  [key: string]: unknown
}

export const BranchNode = memo(({ data }: NodeProps) => {
  const d = data as BranchNodeData
  return (
    <div className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-700 rounded-lg px-4 py-2 text-center">
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2 !h-2" />
      <div className="flex items-center justify-center gap-1.5">
        <GitBranch className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{d.label}</span>
      </div>
      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
        {d.branchCount} branches
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2 !h-2" />
    </div>
  )
})
BranchNode.displayName = 'BranchNode'
