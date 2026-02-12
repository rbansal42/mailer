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
import { useSequenceLayout } from './flow/useSequenceLayout'
import type { SequenceStep, SequenceBranch } from '../../shared/types'

const nodeTypes = {
  emailNode: EmailNode,
  branchNode: BranchNode,
  endNode: EndNode,
}

interface SequenceFlowBuilderProps {
  steps: SequenceStep[]
  branches: SequenceBranch[]
  onEditStep: (step: SequenceStep) => void
  onDeleteStep: (stepId: number) => void
}

export function SequenceFlowBuilder({ steps, branches, onEditStep, onDeleteStep }: SequenceFlowBuilderProps) {
  const { nodes, edges } = useSequenceLayout(steps, branches, onEditStep, onDeleteStep)

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
