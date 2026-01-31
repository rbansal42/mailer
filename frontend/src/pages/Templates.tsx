import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Template, Block } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Plus, ChevronLeft, Save, Trash2, Type, Image, MousePointer,
  Minus, Square, Columns, FileText, GripVertical, Loader2, Undo2, Redo2, Copy,
  Monitor, Smartphone, Moon, Code
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useBlockHistory } from '../stores/history'
import { useKeyboardShortcuts, createSaveShortcut, createUndoShortcut, createRedoShortcut } from '../hooks/useKeyboardShortcuts'

const BLOCK_TYPES = [
  { type: 'header', label: 'Header', icon: FileText },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'button', label: 'Button', icon: MousePointer },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'spacer', label: 'Spacer', icon: Square },
  { type: 'columns', label: 'Columns', icon: Columns },
  { type: 'footer', label: 'Footer', icon: FileText },
] as const

export default function Templates() {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  })

  if (editingTemplate || isCreating) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onBack={() => {
          setEditingTemplate(null)
          setIsCreating(false)
        }}
      />
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Templates</h1>
        <Button size="sm" onClick={() => setIsCreating(true)} aria-label="Add new template">
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setEditingTemplate(template)}
            >
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xs text-muted-foreground">
                  {template.blocks?.length || 0} blocks
                </p>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No templates yet</p>
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface EditorProps {
  template: Template | null
  onBack: () => void
}

function TemplateEditor({ template, onBack }: EditorProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(template?.name || 'Untitled Template')
  const [description, setDescription] = useState(template?.description || '')
  const [blocks, setBlocks] = useState<Block[]>(template?.blocks || [])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [darkMode, setDarkMode] = useState(false)
  const [showSource, setShowSource] = useState(false)
  
  const { set: recordHistory, undo, redo, canUndo, canRedo } = useBlockHistory()

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  
  // Sync local blocks state with history store when undo/redo happens
  useEffect(() => {
    const history = useBlockHistory.getState()
    if (history.present) {
      setBlocks(history.present)
    }
  }, [canUndo, canRedo])
  
  const updateBlocks = (newBlocks: Block[]) => {
    setBlocks(newBlocks)
    recordHistory(newBlocks)
  }

  const saveMutation = useMutation({
    mutationFn: template
      ? (data: Partial<Template>) => api.updateTemplate(template.id, data)
      : (data: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => api.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      onBack()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTemplate(template!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      onBack()
    },
  })

  const handleSave = () => {
    saveMutation.mutate({ name, description, blocks })
  }

  const addBlock = (type: Block['type']) => {
    const newBlock: Block = {
      id: `block_${Date.now()}`,
      type,
      props: getDefaultProps(type),
    }
    setBlocks([...blocks, newBlock])
    setSelectedBlockId(newBlock.id)
  }

  const updateBlock = (id: string, props: Record<string, unknown>) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...props } } : b)))
  }

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id))
    if (selectedBlockId === id) setSelectedBlockId(null)
  }

  const duplicateBlock = (id: string) => {
    const blockIndex = blocks.findIndex((b) => b.id === id)
    if (blockIndex === -1) return

    const blockToCopy = blocks[blockIndex]
    const newBlock: Block = {
      ...blockToCopy,
      id: `block_${Date.now()}`,
      props: { ...blockToCopy.props },
    }

    const newBlocks = [
      ...blocks.slice(0, blockIndex + 1),
      newBlock,
      ...blocks.slice(blockIndex + 1),
    ]

    setBlocks(newBlocks)
    setSelectedBlockId(newBlock.id)
  }

  // Keyboard shortcuts
  useKeyboardShortcuts([
    createSaveShortcut(handleSave),
    {
      key: 'd',
      ctrl: true,
      action: () => {
        if (selectedBlockId) {
          duplicateBlock(selectedBlockId)
        }
      },
    },
  ])

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex((b) => b.id === id)
    if (direction === 'up' && index > 0) {
      const newBlocks = [...blocks]
      ;[newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]]
      setBlocks(newBlocks)
    } else if (direction === 'down' && index < blocks.length - 1) {
      const newBlocks = [...blocks]
      ;[newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]]
      setBlocks(newBlocks)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm font-semibold w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          {template && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => deleteMutation.mutate()}
              aria-label="Delete template"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} aria-label="Save template">
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Block Palette */}
        <div className="w-36 p-2 border-r bg-muted/30 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Add Block</p>
          <div className="space-y-1">
            {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => addBlock(type as Block['type'])}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors"
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 p-4 overflow-y-auto bg-muted/20">
          <div className="max-w-xl mx-auto bg-background rounded-lg border shadow-sm min-h-96">
            {blocks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>Add blocks from the left panel</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={cn(
                      'relative group rounded border-2 border-transparent transition-colors cursor-pointer',
                      selectedBlockId === block.id && 'border-primary'
                    )}
                  >
                    {/* Block controls */}
                    <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          duplicateBlock(block.id)
                        }}
                        className="p-0.5 rounded hover:bg-accent"
                        title="Duplicate (Ctrl+D)"
                      >
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                    
                    {/* Block content */}
                    <BlockPreview block={block} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-56 p-3 border-l bg-card overflow-y-auto">
          {selectedBlock ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium capitalize">{selectedBlock.type}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => deleteBlock(selectedBlock.id)}
                  aria-label="Delete block"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <BlockProperties
                block={selectedBlock}
                onChange={(props) => updateBlock(selectedBlock.id, props)}
              />
              <div className="mt-4 pt-4 border-t flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => moveBlock(selectedBlock.id, 'up')}
                  disabled={blocks.findIndex((b) => b.id === selectedBlock.id) === 0}
                >
                  Move Up
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => moveBlock(selectedBlock.id, 'down')}
                  disabled={blocks.findIndex((b) => b.id === selectedBlock.id) === blocks.length - 1}
                >
                  Move Down
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a block to edit properties</p>
          )}
        </div>
      </div>
    </div>
  )
}

function BlockPreview({ block }: { block: Block }) {
  const { type, props } = block

  switch (type) {
    case 'header':
      return (
        <div
          className="p-4 text-center"
          style={{ backgroundColor: String(props.backgroundColor) || '#f3f4f6' }}
        >
          {props.imageUrl ? (
            <img src={String(props.imageUrl)} alt="" className="h-12 mx-auto" />
          ) : (
            <div className="h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
              Logo/Banner
            </div>
          )}
        </div>
      )
    case 'text':
      return (
        <p
          className="p-3"
          style={{ fontSize: Number(props.fontSize) || 14, textAlign: (props.align as 'left' | 'center' | 'right') || 'left' }}
        >
          {String(props.content) || 'Enter text content...'}
        </p>
      )
    case 'image':
      return (
        <div className="p-3" style={{ textAlign: (props.align as 'left' | 'center' | 'right') || 'center' }}>
          {props.url ? (
            <img src={String(props.url)} alt={String(props.alt) || ''} style={{ maxWidth: props.width ? `${props.width}%` : '100%' }} />
          ) : (
            <div className="h-24 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
              Image placeholder
            </div>
          )}
        </div>
      )
    case 'button':
      return (
        <div className="p-3" style={{ textAlign: (props.align as 'left' | 'center' | 'right') || 'center' }}>
          <button
            className="px-4 py-2 rounded text-sm text-white"
            style={{ backgroundColor: String(props.color) || '#0f172a' }}
          >
            {String(props.label) || 'Click Here'}
          </button>
        </div>
      )
    case 'divider':
      return (
        <hr
          className="mx-3"
          style={{
            borderStyle: String(props.style) || 'solid',
            borderColor: String(props.color) || '#e5e7eb',
          }}
        />
      )
    case 'spacer':
      return <div style={{ height: Number(props.height) || 20 }} />
    case 'columns':
      return (
        <div className="p-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Number(props.count) || 2}, 1fr)` }}>
          {Array.from({ length: Number(props.count) || 2 }).map((_, i) => (
            <div key={i} className="bg-muted rounded p-2 text-xs text-center text-muted-foreground">
              Column {i + 1}
            </div>
          ))}
        </div>
      )
    case 'footer':
      return (
        <div className="p-4 text-center text-xs text-muted-foreground bg-muted/50">
          {String(props.text) || '© 2026 Company Name · Unsubscribe'}
        </div>
      )
    default:
      return <div className="p-3 text-muted-foreground">Unknown block type</div>
  }
}

function BlockProperties({ block, onChange }: { block: Block; onChange: (props: Record<string, unknown>) => void }) {
  const { type, props } = block

  switch (type) {
    case 'header':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Image URL</Label>
            <Input
              value={String(props.imageUrl || '')}
              onChange={(e) => onChange({ imageUrl: e.target.value })}
              placeholder="https://..."
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Background Color</Label>
            <Input
              type="color"
              value={String(props.backgroundColor || '#f3f4f6')}
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
              className="h-8"
            />
          </div>
        </div>
      )
    case 'text':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Content</Label>
            <textarea
              value={String(props.content || '')}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="Hello {{name}}..."
              className="w-full h-24 text-xs rounded-md border border-input bg-background text-foreground px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Font Size</Label>
              <Input
                type="number"
                value={Number(props.fontSize) || 14}
                onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Align</Label>
              <select
                value={String(props.align || 'left')}
                onChange={(e) => onChange({ align: e.target.value })}
                className="w-full h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      )
    case 'image':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Image URL</Label>
            <Input
              value={String(props.url || '')}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://..."
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alt Text</Label>
            <Input
              value={String(props.alt || '')}
              onChange={(e) => onChange({ alt: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Width %</Label>
              <Input
                type="number"
                value={Number(props.width) || 100}
                onChange={(e) => onChange({ width: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Align</Label>
              <select
                value={String(props.align || 'center')}
                onChange={(e) => onChange({ align: e.target.value })}
                className="w-full h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      )
    case 'button':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              value={String(props.label || '')}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Click Here"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input
              value={String(props.url || '')}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://..."
              className="h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <Input
                type="color"
                value={String(props.color || '#0f172a')}
                onChange={(e) => onChange({ color: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Align</Label>
              <select
                value={String(props.align || 'center')}
                onChange={(e) => onChange({ align: e.target.value })}
                className="w-full h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      )
    case 'divider':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Style</Label>
            <select
              value={String(props.style || 'solid')}
              onChange={(e) => onChange({ style: e.target.value })}
              className="w-full h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <Input
              type="color"
              value={String(props.color || '#e5e7eb')}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8"
            />
          </div>
        </div>
      )
    case 'spacer':
      return (
        <div className="space-y-1">
          <Label className="text-xs">Height (px)</Label>
          <Input
            type="number"
            value={Number(props.height) || 20}
            onChange={(e) => onChange({ height: Number(e.target.value) })}
            className="h-8 text-xs"
          />
        </div>
      )
    case 'columns':
      return (
        <div className="space-y-1">
          <Label className="text-xs">Column Count</Label>
          <select
            value={Number(props.count) || 2}
            onChange={(e) => onChange({ count: Number(e.target.value) })}
            className="w-full h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={2}>2 Columns</option>
            <option value={3}>3 Columns</option>
          </select>
        </div>
      )
    case 'footer':
      return (
        <div className="space-y-1">
          <Label className="text-xs">Footer Text</Label>
          <textarea
            value={String(props.text || '')}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="© 2026 Company · Unsubscribe"
            className="w-full h-16 text-xs rounded-md border border-input bg-background text-foreground px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )
    default:
      return null
  }
}

function getDefaultProps(type: Block['type']): Record<string, unknown> {
  switch (type) {
    case 'header':
      return { backgroundColor: '#f3f4f6', imageUrl: '' }
    case 'text':
      return { content: '', fontSize: 14, align: 'left' }
    case 'image':
      return { url: '', alt: '', width: 100, align: 'center' }
    case 'button':
      return { label: 'Click Here', url: '', color: '#0f172a', align: 'center' }
    case 'divider':
      return { style: 'solid', color: '#e5e7eb' }
    case 'spacer':
      return { height: 20 }
    case 'columns':
      return { count: 2 }
    case 'footer':
      return { text: '© 2026 Company Name · Unsubscribe' }
    default:
      return {}
  }
}
