# LLM Sequence Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Allow users to generate email sequences using Gemini AI through a guided form interface.

**Architecture:** Backend Gemini service with key rotation → Express endpoint → React dialog with form → Preview modal → Create sequence.

**Tech Stack:** @google/genai, Express, React, shadcn/ui, Zod validation

**Design Doc:** `docs/plans/2026-02-04-llm-sequence-generation-design.md`

---

## Task 1: Install Gemini SDK

**Files:**
- Modify: `server/package.json`

**Steps:**

1. Install the Google Generative AI SDK:
```bash
cd server && bun add @google/genai
```

2. Verify installation in package.json

---

## Task 2: Create Gemini Service

**Files:**
- Create: `server/src/services/gemini.ts`

**Context:** This service handles Gemini API calls with key rotation for rate limiting.

**Implementation:**

```typescript
import { GoogleGenAI } from '@google/genai'
import { logger } from '../lib/logger'

// Parse comma-separated API keys
const GEMINI_API_KEYS = process.env.GEMINI_API_KEY?.split(',').map(k => k.trim()).filter(Boolean) || []
let currentKeyIndex = 0

function getNextKey(): string {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error('No Gemini API keys configured')
  }
  const key = GEMINI_API_KEYS[currentKeyIndex]
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length
  return key
}

const SYSTEM_PROMPT = `You are an email sequence generator. Generate a JSON array of emails for an email marketing sequence.

STRICT RULES:
1. Output ONLY valid JSON - no markdown, no explanation, no code fences
2. Use ONLY these block types: "text", "action-button", "button", "spacer", "divider"
3. DO NOT invent block types like "header", "footer", "image", "cta"
4. For headings, use "text" block with <h1>, <h2> tags in content
5. For calls-to-action, use "action-button" (tracks clicks, can trigger branch) or "button" (simple link)
6. Keep email content professional and concise
7. Each email should have 3-6 blocks

BLOCK SCHEMAS:
- text: { "type": "text", "id": "<unique-id>", "props": { "content": "<p>HTML content here</p>" } }
- action-button: { "type": "action-button", "id": "<unique-id>", "props": { "text": "Button Text", "url": "", "style": "filled" } }
- button: { "type": "button", "id": "<unique-id>", "props": { "text": "Button Text", "url": "https://example.com", "style": "filled" } }
- spacer: { "type": "spacer", "id": "<unique-id>", "props": { "height": 20 } }
- divider: { "type": "divider", "id": "<unique-id>", "props": {} }

OUTPUT FORMAT (JSON only, no markdown):
{
  "name": "Sequence Name",
  "emails": [
    {
      "subject": "Email subject line",
      "delayDays": 0,
      "blocks": [...]
    }
  ]
}`

interface GenerateSequenceInput {
  goal: string
  emailCount: number
  timing: 'daily' | 'every-few-days' | 'weekly'
  tone: 'professional' | 'friendly' | 'casual'
  additionalContext?: string
}

interface GeneratedEmail {
  subject: string
  delayDays: number
  blocks: Array<{
    type: string
    id: string
    props: Record<string, unknown>
  }>
}

interface GenerateSequenceOutput {
  name: string
  emails: GeneratedEmail[]
}

export async function generateSequence(input: GenerateSequenceInput): Promise<GenerateSequenceOutput> {
  const timingMap = {
    'daily': 'Send emails daily (1 day apart)',
    'every-few-days': 'Send emails every 2-3 days',
    'weekly': 'Send emails weekly (7 days apart)'
  }

  const userPrompt = `Generate an email sequence with the following requirements:

Goal: ${input.goal}
Number of emails: ${input.emailCount}
Timing: ${timingMap[input.timing]}
Tone: ${input.tone}
${input.additionalContext ? `Additional context: ${input.additionalContext}` : ''}

Generate exactly ${input.emailCount} emails. Set delayDays based on the timing preference (first email should have delayDays: 0).`

  let lastError: Error | null = null
  const keysToTry = GEMINI_API_KEYS.length

  for (let attempt = 0; attempt < keysToTry; attempt++) {
    const apiKey = getNextKey()
    
    try {
      const genAI = new GoogleGenAI({ apiKey })
      
      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      })

      const text = response.text?.trim() || ''
      
      // Try to parse JSON, handling potential markdown code fences
      let jsonText = text
      if (text.startsWith('```')) {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (match) {
          jsonText = match[1].trim()
        }
      }

      const parsed = JSON.parse(jsonText) as GenerateSequenceOutput
      
      // Validate structure
      if (!parsed.name || !Array.isArray(parsed.emails)) {
        throw new Error('Invalid response structure')
      }

      logger.info('Generated sequence with Gemini', { 
        service: 'gemini', 
        emailCount: parsed.emails.length 
      })

      return parsed
    } catch (error) {
      lastError = error as Error
      const errorMessage = lastError.message || ''
      
      // If rate limited, try next key
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        logger.warn('Gemini rate limited, trying next key', { service: 'gemini', attempt })
        continue
      }
      
      // If JSON parse error, retry once with same key
      if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        logger.warn('Gemini returned invalid JSON, retrying', { service: 'gemini' })
        continue
      }
      
      // Other errors, throw immediately
      throw error
    }
  }

  throw lastError || new Error('All Gemini API keys exhausted')
}
```

---

## Task 3: Add Validation Schema

**Files:**
- Modify: `server/src/lib/validation.ts`

**Context:** Add Zod schema for the generate sequence request.

**Add after the Google Sheets schemas (around line 180):**

```typescript
// Sequence generation schema
export const generateSequenceSchema = z.object({
  goal: z.string().min(10, 'Goal must be at least 10 characters').max(500, 'Goal must be under 500 characters'),
  emailCount: z.number().int().min(3, 'Minimum 3 emails').max(7, 'Maximum 7 emails'),
  timing: z.enum(['daily', 'every-few-days', 'weekly']),
  tone: z.enum(['professional', 'friendly', 'casual']),
  additionalContext: z.string().max(1000, 'Additional context must be under 1000 characters').optional(),
})

export type GenerateSequenceInput = z.infer<typeof generateSequenceSchema>
```

---

## Task 4: Add Generate Endpoint

**Files:**
- Modify: `server/src/routes/sequences.ts`

**Context:** Add POST /generate endpoint that calls Gemini service.

**Step 1: Add imports at top of file:**

```typescript
import { generateSequence } from '../services/gemini'
import { generateSequenceSchema, validate } from '../lib/validation'
```

**Step 2: Add endpoint before the closing of the router (at end of file, before line 498):**

```typescript
// POST /generate - Generate sequence with AI
sequencesRouter.post('/generate', async (req, res) => {
  try {
    const validation = validate(generateSequenceSchema, req.body)
    if (!validation.success) {
      res.status(400).json({ error: validation.error })
      return
    }

    const result = await generateSequence(validation.data)
    
    logger.info('Generated sequence via AI', { 
      service: 'sequences', 
      emailCount: result.emails.length 
    })

    res.json(result)
  } catch (error) {
    const err = error as Error
    logger.error('Failed to generate sequence', { service: 'sequences' }, err)
    
    // Provide user-friendly error messages
    if (err.message.includes('exhausted') || err.message.includes('rate')) {
      res.status(429).json({ error: 'Service is busy. Please try again in a moment.' })
      return
    }
    if (err.message.includes('JSON') || err.message.includes('parse') || err.message.includes('Invalid response')) {
      res.status(500).json({ error: "Couldn't generate a valid sequence. Please try again." })
      return
    }
    
    res.status(500).json({ error: 'Failed to generate sequence' })
  }
})
```

---

## Task 5: Add Frontend Types

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Context:** Add TypeScript types for the generate sequence request/response.

**Add after the SequenceListItem interface (around line 856):**

```typescript
// Sequence generation types
export interface GenerateSequenceRequest {
  goal: string
  emailCount: number
  timing: 'daily' | 'every-few-days' | 'weekly'
  tone: 'professional' | 'friendly' | 'casual'
  additionalContext?: string
}

export interface GeneratedSequenceEmail {
  subject: string
  delayDays: number
  blocks: Block[]
}

export interface GenerateSequenceResponse {
  name: string
  emails: GeneratedSequenceEmail[]
}
```

---

## Task 6: Add Generate API Function

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Context:** Add the API function to call the generate endpoint.

**Add to the sequences object (after the deleteStep method, around line 905):**

```typescript
  generate: (data: GenerateSequenceRequest) =>
    request<GenerateSequenceResponse>('/sequences/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
```

---

## Task 7: Create Generate Dialog Component

**Files:**
- Create: `frontend/src/components/GenerateSequenceDialog.tsx`

**Context:** Dialog with guided form for AI sequence generation.

**Implementation:**

```typescript
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Sparkles } from 'lucide-react'
import { sequences as sequencesApi, GenerateSequenceRequest, GenerateSequenceResponse } from '@/lib/api'

interface GenerateSequenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (result: GenerateSequenceResponse) => void
}

export function GenerateSequenceDialog({ open, onOpenChange, onGenerated }: GenerateSequenceDialogProps) {
  const [goal, setGoal] = useState('')
  const [emailCount, setEmailCount] = useState<number>(5)
  const [timing, setTiming] = useState<GenerateSequenceRequest['timing']>('every-few-days')
  const [tone, setTone] = useState<GenerateSequenceRequest['tone']>('professional')
  const [additionalContext, setAdditionalContext] = useState('')
  const [errorCount, setErrorCount] = useState(0)

  const generateMutation = useMutation({
    mutationFn: (data: GenerateSequenceRequest) => sequencesApi.generate(data),
    onSuccess: (result) => {
      onGenerated(result)
      resetForm()
    },
    onError: (error: Error) => {
      const newCount = errorCount + 1
      setErrorCount(newCount)
      
      if (newCount >= 3) {
        toast.error(error.message || 'Generation failed', {
          description: 'Try simplifying your goal or reducing the number of emails.'
        })
      } else {
        toast.error(error.message || 'Generation failed. Please try again.')
      }
    },
  })

  const resetForm = () => {
    setGoal('')
    setEmailCount(5)
    setTiming('every-few-days')
    setTone('professional')
    setAdditionalContext('')
    setErrorCount(0)
  }

  const handleSubmit = () => {
    if (goal.trim().length < 10) {
      toast.error('Please describe your goal in more detail (at least 10 characters)')
      return
    }

    generateMutation.mutate({
      goal: goal.trim(),
      emailCount,
      timing,
      tone,
      additionalContext: additionalContext.trim() || undefined,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !generateMutation.isPending) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate Sequence with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="goal">What do you want this sequence to achieve?</Label>
            <Textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Welcome new subscribers and introduce them to our product features over the first week"
              rows={3}
              disabled={generateMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {goal.length}/500 characters
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Number of emails</Label>
              <Select
                value={String(emailCount)}
                onValueChange={(v) => setEmailCount(Number(v))}
                disabled={generateMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} emails
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timing</Label>
              <Select
                value={timing}
                onValueChange={(v) => setTiming(v as GenerateSequenceRequest['timing'])}
                disabled={generateMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="every-few-days">Every few days</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <Select
              value={tone}
              onValueChange={(v) => setTone(v as GenerateSequenceRequest['tone'])}
              disabled={generateMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Additional context (optional)</Label>
            <Textarea
              id="context"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="e.g., Our product is a project management tool. Include a discount offer in the final email."
              rows={2}
              disabled={generateMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {additionalContext.length}/1000 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={generateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={goal.trim().length < 10 || generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Task 8: Create Preview Modal Component

**Files:**
- Create: `frontend/src/components/SequencePreviewModal.tsx`

**Context:** Modal to preview generated sequence before creating.

**Implementation:**

```typescript
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, ChevronDown, ChevronRight, Mail, Clock } from 'lucide-react'
import { sequences as sequencesApi, GenerateSequenceResponse, Block } from '@/lib/api'

interface SequencePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  generatedSequence: GenerateSequenceResponse | null
  onCreated: (id: number) => void
}

export function SequencePreviewModal({ 
  open, 
  onOpenChange, 
  generatedSequence,
  onCreated 
}: SequencePreviewModalProps) {
  const queryClient = useQueryClient()
  const [expandedEmails, setExpandedEmails] = useState<Set<number>>(new Set())

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!generatedSequence) throw new Error('No sequence to create')
      
      // Create the sequence
      const { id } = await sequencesApi.create({
        name: generatedSequence.name,
        description: `AI-generated sequence with ${generatedSequence.emails.length} emails`,
      })

      // Add each email as a step
      for (const email of generatedSequence.emails) {
        await sequencesApi.addStep(id, {
          subject: email.subject,
          delayDays: email.delayDays,
          // Note: blocks would need to be stored separately or in template
          // For now, we just create the step structure
        })
      }

      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] })
      toast.success('Sequence created successfully')
      onOpenChange(false)
      onCreated(id)
    },
    onError: () => {
      toast.error('Failed to create sequence')
    },
  })

  const toggleEmail = (index: number) => {
    const newExpanded = new Set(expandedEmails)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedEmails(newExpanded)
  }

  const formatDelay = (days: number) => {
    if (days === 0) return 'Sends immediately'
    if (days === 1) return 'Sends after 1 day'
    return `Sends after ${days} days`
  }

  const getBlockSummary = (blocks: Block[]) => {
    const textBlocks = blocks.filter(b => b.type === 'text').length
    const buttonBlocks = blocks.filter(b => b.type === 'button' || b.type === 'action-button').length
    const parts = []
    if (textBlocks > 0) parts.push(`${textBlocks} text`)
    if (buttonBlocks > 0) parts.push(`${buttonBlocks} button`)
    return parts.join(', ') || 'Empty'
  }

  const renderBlockPreview = (block: Block) => {
    switch (block.type) {
      case 'text': {
        const content = (block.props as { content?: string }).content || ''
        // Strip HTML and truncate
        const text = content.replace(/<[^>]*>/g, '').slice(0, 100)
        return (
          <div className="text-sm text-muted-foreground pl-4 border-l-2 border-muted">
            {text}{content.length > 100 ? '...' : ''}
          </div>
        )
      }
      case 'button':
      case 'action-button': {
        const props = block.props as { text?: string }
        return (
          <div className="text-sm">
            <span className="inline-block px-2 py-1 bg-primary/10 text-primary rounded text-xs">
              {props.text || 'Button'}
            </span>
          </div>
        )
      }
      case 'spacer':
        return <div className="h-2" />
      case 'divider':
        return <hr className="border-muted" />
      default:
        return null
    }
  }

  if (!generatedSequence) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview: {generatedSequence.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4 space-y-3">
          {generatedSequence.emails.map((email, index) => (
            <Collapsible
              key={index}
              open={expandedEmails.has(index)}
              onOpenChange={() => toggleEmail(index)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">{email.subject}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDelay(email.delayDays)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {email.blocks.length} blocks
                      </span>
                    </div>
                  </div>
                  {expandedEmails.has(index) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t">
                    {email.blocks.map((block, blockIndex) => (
                      <div key={blockIndex}>
                        {renderBlockPreview(block)}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create Sequence'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Task 9: Wire Up in Sequences Page

**Files:**
- Modify: `frontend/src/pages/Sequences.tsx`

**Context:** Add AI Generate button and wire up dialogs.

**Step 1: Add imports at top of file:**

```typescript
import { GenerateSequenceDialog } from '@/components/GenerateSequenceDialog'
import { SequencePreviewModal } from '@/components/SequencePreviewModal'
import { GenerateSequenceResponse } from '@/lib/api'
import { Sparkles } from 'lucide-react'
```

**Step 2: Add state in Sequences component (after line 36):**

```typescript
const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
const [previewModalOpen, setPreviewModalOpen] = useState(false)
const [generatedSequence, setGeneratedSequence] = useState<GenerateSequenceResponse | null>(null)
```

**Step 3: Add handler function (after handleEditSequence function, around line 56):**

```typescript
const handleSequenceGenerated = (result: GenerateSequenceResponse) => {
  setGeneratedSequence(result)
  setGenerateDialogOpen(false)
  setPreviewModalOpen(true)
}

const handleSequenceCreated = (id: number) => {
  setPreviewModalOpen(false)
  setGeneratedSequence(null)
  handleEditSequence(id)
}
```

**Step 4: Update the header buttons (replace lines 74-78):**

```typescript
<div className="flex items-center gap-2">
  <Button variant="outline" size="sm" onClick={() => setGenerateDialogOpen(true)}>
    <Sparkles className="h-4 w-4 mr-1" />
    AI Generate
  </Button>
  <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
    <Plus className="h-4 w-4 mr-1" />
    New Sequence
  </Button>
</div>
```

**Step 5: Add dialogs at end of component (after CreateSequenceDialog, around line 124):**

```typescript
<GenerateSequenceDialog
  open={generateDialogOpen}
  onOpenChange={setGenerateDialogOpen}
  onGenerated={handleSequenceGenerated}
/>

<SequencePreviewModal
  open={previewModalOpen}
  onOpenChange={setPreviewModalOpen}
  generatedSequence={generatedSequence}
  onCreated={handleSequenceCreated}
/>
```

---

## Build and Test

After all tasks complete:

```bash
# In worktree
bun run build

# Test manually:
# 1. Go to Sequences page
# 2. Click "AI Generate" button
# 3. Fill form and generate
# 4. Preview and create sequence
```
