import { useMemo, useRef } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { SequenceStep, SequenceBranch } from '../../../shared/types'

const NODE_WIDTH = 260
const NODE_HEIGHT = 90
const BRANCH_NODE_HEIGHT = 50
const VERTICAL_GAP = 60
const HORIZONTAL_GAP = 40

export function useSequenceLayout(
  steps: SequenceStep[],
  branches: SequenceBranch[],
  onEditStep: (step: SequenceStep) => void,
  onDeleteStep: (stepId: number) => void,
) {
  const onEditRef = useRef(onEditStep)
  const onDeleteRef = useRef(onDeleteStep)
  onEditRef.current = onEditStep
  onDeleteRef.current = onDeleteStep

  return useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Group steps by branch
    const mainSteps = steps.filter(s => !s.branch_id).sort((a, b) => a.step_order - b.step_order)
    const branchSteps: Record<string, SequenceStep[]> = {}
    branches.forEach(b => {
      branchSteps[b.id] = steps
        .filter(s => s.branch_id === b.id)
        .sort((a, b) => (a.branch_order ?? a.step_order) - (b.branch_order ?? b.step_order))
    })

    let y = 0
    const branchPointStep = steps.find(s => s.is_branch_point)

    // Add main path steps
    mainSteps.forEach((step, idx) => {
      const nodeId = `step-${step.id}`
      nodes.push({
        id: nodeId,
        type: 'emailNode',
        position: { x: 0, y },
        data: {
          label: step.subject,
          stepNumber: idx + 1,
          delayDays: step.delay_days,
          delayHours: step.delay_hours,
          blockCount: step.blocks?.length ?? 0,
          branchColor: null,
          onEdit: () => onEditRef.current(step),
          onDelete: () => onDeleteRef.current(step.id),
        },
      })

      if (idx > 0) {
        edges.push({
          id: `edge-${mainSteps[idx - 1].id}-${step.id}`,
          source: `step-${mainSteps[idx - 1].id}`,
          target: nodeId,
          animated: true,
          style: { stroke: '#6366f1' },
        })
      }

      y += NODE_HEIGHT + VERTICAL_GAP
    })

    // Add branch point
    if (branchPointStep && branches.length > 0) {
      const branchNodeId = `branch-${branchPointStep.id}`
      nodes.push({
        id: branchNodeId,
        type: 'branchNode',
        position: { x: 0, y },
        data: {
          label: 'Branch Point',
          branchCount: branches.length,
        },
      })

      edges.push({
        id: `edge-to-branch-${branchPointStep.id}`,
        source: `step-${branchPointStep.id}`,
        target: branchNodeId,
        animated: true,
      })

      y += BRANCH_NODE_HEIGHT + VERTICAL_GAP

      // Add branch columns
      const totalWidth = branches.length * (NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP
      const startX = -(totalWidth / 2) + NODE_WIDTH / 2

      branches.forEach((branch, bIdx) => {
        const branchX = startX + bIdx * (NODE_WIDTH + HORIZONTAL_GAP)
        let branchY = y
        const bSteps = branchSteps[branch.id] || []

        // Edge from branch point to first step (or end node)
        const firstStepId = bSteps.length > 0 ? `step-${bSteps[0].id}` : `end-${branch.id}`
        edges.push({
          id: `edge-branch-${branch.id}`,
          source: `branch-${branchPointStep.id}`,
          target: firstStepId,
          label: branch.name,
          animated: true,
          style: { stroke: branch.color },
          labelStyle: { fill: branch.color, fontWeight: 500, fontSize: 11 },
        })

        // Add branch steps
        bSteps.forEach((step, sIdx) => {
          const nodeId = `step-${step.id}`
          nodes.push({
            id: nodeId,
            type: 'emailNode',
            position: { x: branchX, y: branchY },
            data: {
              label: step.subject,
              stepNumber: sIdx + 1,
              delayDays: step.delay_days,
              delayHours: step.delay_hours,
              blockCount: step.blocks?.length ?? 0,
              branchColor: branch.color,
              onEdit: () => onEditRef.current(step),
              onDelete: () => onDeleteRef.current(step.id),
            },
          })

          if (sIdx > 0) {
            edges.push({
              id: `edge-${bSteps[sIdx - 1].id}-${step.id}`,
              source: `step-${bSteps[sIdx - 1].id}`,
              target: nodeId,
              animated: true,
              style: { stroke: branch.color },
            })
          }

          branchY += NODE_HEIGHT + VERTICAL_GAP
        })

        // Add end node
        const endNodeId = `end-${branch.id}`
        nodes.push({
          id: endNodeId,
          type: 'endNode',
          position: { x: branchX, y: branchY },
          data: {},
        })

        if (bSteps.length > 0) {
          edges.push({
            id: `edge-to-end-${branch.id}`,
            source: `step-${bSteps[bSteps.length - 1].id}`,
            target: endNodeId,
            style: { stroke: branch.color },
          })
        }
      })
    } else if (mainSteps.length > 0) {
      // No branches - add single end node
      const endNodeId = 'end-main'
      nodes.push({
        id: endNodeId,
        type: 'endNode',
        position: { x: 0, y },
        data: {},
      })
      edges.push({
        id: 'edge-to-end-main',
        source: `step-${mainSteps[mainSteps.length - 1].id}`,
        target: endNodeId,
      })
    }

    return { nodes, edges }
  }, [steps, branches])
}
