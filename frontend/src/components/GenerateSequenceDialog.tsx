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
