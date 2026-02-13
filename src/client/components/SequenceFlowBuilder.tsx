import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EmailNode } from './flow/EmailNode'
import { BranchNode } from './flow/BranchNode'
import { EndNode } from './flow/EndNode'
import { AddNode } from './flow/AddNode'
import { useSequenceLayout } from './flow/useSequenceLayout'
import type { SequenceStep, SequenceBranch } from '../../shared/types'

const nodeTypes = {
  emailNode: EmailNode,
  branchNode: BranchNode,
  endNode: EndNode,
  addNode: AddNode,
}

interface SequenceFlowBuilderProps {
  steps: SequenceStep[]
  branches: SequenceBranch[]
  onEditStep: (step: SequenceStep) => void
  onDeleteStep: (stepId: number) => void
  onAddStep?: (afterStepOrder: number, branchId: string | null) => void
}

export default function SequenceFlowBuilder({ steps, branches, onEditStep, onDeleteStep, onAddStep }: SequenceFlowBuilderProps) {
  const { nodes, edges } = useSequenceLayout(steps, branches, onEditStep, onDeleteStep, onAddStep)

  if (steps.length === 0) {
    return (
      <div className="w-full h-[600px] border rounded-lg bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No steps yet</p>
          <p className="text-xs mt-1">Use the List view or click <span className="inline-flex items-center justify-center w-5 h-5 bg-primary/10 border border-dashed border-primary/40 rounded-full align-middle mx-0.5"><span className="text-primary/60 text-[10px] font-bold">+</span></span> buttons to add steps</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-[600px] border rounded-lg bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'branchNode') return '#f59e0b'
            if (node.type === 'endNode') return '#9ca3af'
            return '#6366f1'
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  )
}

export { SequenceFlowBuilder }
