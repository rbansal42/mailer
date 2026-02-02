import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Template, Block, mails } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  Plus, ChevronLeft, Save, Trash2, Type, Image, MousePointer,
  Minus, Square, Columns, FileText, GripVertical, Loader2, Undo2, Redo2, Copy,
  Monitor, Smartphone, Moon, Code, ImageIcon, Crop, Eye, X
} from 'lucide-react'
import { MediaLibrarySidebar } from '@/components/media-library'
import { cn } from '../lib/utils'
import { RichTextEditor } from '../components/ui/rich-text-editor'
import { ImageCropModal } from '../components/ui/image-crop-modal'
import DOMPurify from 'isomorphic-dompurify'
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
  isMail?: boolean
  onSaveAsTemplate?: (name: string) => void
}

export function TemplateEditor({ template, onBack, isMail, onSaveAsTemplate }: EditorProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(template?.name || 'Untitled Template')
  const [_description, _setDescription] = useState(template?.description || '')
  const [blocks, setBlocks] = useState<Block[]>(template?.blocks || [])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [darkMode, setDarkMode] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [mediaSelectionTarget, setMediaSelectionTarget] = useState<{
    blockId: string;
    prop: "url" | "imageUrl";
  } | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropTarget, setCropTarget] = useState<{
    blockId: string;
    url: string;
    initialCrop?: { x: number; y: number; width: number; height: number };
  } | null>(null)
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sampleData, setSampleData] = useState<Record<string, string>>({
    name: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Inc',
  })
  
  const { set: recordHistory, undo, redo, canUndo, canRedo, clear: clearHistory } = useBlockHistory()

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  
  // Clear history when switching templates
  useEffect(() => {
    clearHistory()
  }, [template?.id, clearHistory])
  
  // Subscribe to history store changes for undo/redo sync
  useEffect(() => {
    return useBlockHistory.subscribe((state) => {
      if (state.present) {
        setBlocks(state.present)
      }
    })
  }, [])
  
  // Fetch preview when modal opens or sample data changes
  useEffect(() => {
    if (!showPreview || blocks.length === 0) return
    
    const fetchPreview = async () => {
      setPreviewLoading(true)
      try {
        const result = await api.preview(blocks, sampleData)
        setPreviewHtml(result.html)
      } catch (error) {
        console.error('Preview failed:', error)
        setPreviewHtml('<p style="color: red; padding: 20px;">Preview failed to load</p>')
      } finally {
        setPreviewLoading(false)
      }
    }
    
    fetchPreview()
  }, [showPreview, sampleData, blocks])
  
  const updateBlocks = (newBlocks: Block[]) => {
    setBlocks(newBlocks)
    recordHistory(newBlocks)
  }

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Template>) => {
      if (isMail) {
        return template
          ? mails.update(template.id, { name: data.name!, blocks: data.blocks })
          : mails.create({ name: data.name!, blocks: data.blocks })
      }
      return template
        ? api.updateTemplate(template.id, data)
        : api.createTemplate(data as Omit<Template, 'id' | 'createdAt' | 'updatedAt'>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isMail ? ['mails'] : ['templates'] })
      onBack()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => isMail ? mails.delete(template!.id) : api.deleteTemplate(template!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isMail ? ['mails'] : ['templates'] })
      onBack()
    },
  })

  const handleSave = () => {
    saveMutation.mutate({ name, blocks })
  }

  const addBlock = (type: Block['type']) => {
    const newBlock: Block = {
      id: `block_${Date.now()}`,
      type,
      props: getDefaultProps(type),
    }
    updateBlocks([...blocks, newBlock])
    setSelectedBlockId(newBlock.id)
  }

  const updateBlock = (id: string, props: Record<string, unknown>) => {
    updateBlocks(blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...props } } : b)))
  }

  const deleteBlock = (id: string) => {
    updateBlocks(blocks.filter((b) => b.id !== id))
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

    updateBlocks(newBlocks)
    setSelectedBlockId(newBlock.id)
  }

  // Keyboard shortcuts
  useKeyboardShortcuts([
    createSaveShortcut(handleSave),
    createUndoShortcut(() => {
      if (canUndo) {
        undo()
      }
    }),
    createRedoShortcut(() => {
      if (canRedo) {
        redo()
      }
    }),
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
      updateBlocks(newBlocks)
    } else if (direction === 'down' && index < blocks.length - 1) {
      const newBlocks = [...blocks]
      ;[newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]]
      updateBlocks(newBlocks)
    }
  }

  const updateBlockProp = (blockId: string, prop: string, value: string) => {
    updateBlock(blockId, { [prop]: value })
  }

  const handleMediaSelect = (url: string) => {
    if (mediaSelectionTarget) {
      updateBlockProp(
        mediaSelectionTarget.blockId,
        mediaSelectionTarget.prop,
        url
      )
      setMediaLibraryOpen(false)
      setMediaSelectionTarget(null)
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
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            disabled={blocks.length === 0}
            title="Preview with merge fields"
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          {template && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => deleteMutation.mutate()}
              aria-label={isMail ? "Delete mail" : "Delete template"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {isMail && template && onSaveAsTemplate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSaveAsTemplate(name)}
              aria-label="Save as template"
            >
              <FileText className="h-4 w-4 mr-1" />
              Save as Template
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} aria-label={isMail ? "Save mail" : "Save template"}>
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
          {/* Preview Controls */}
          <div className="max-w-xl mx-auto mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1" role="group" aria-label="Preview settings">
              <Button
                variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
                title="Desktop view (600px)"
                aria-label="Desktop view (600px)"
                aria-pressed={previewMode === 'desktop'}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
                title="Mobile view (320px)"
                aria-label="Mobile view (320px)"
                aria-pressed={previewMode === 'mobile'}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
              <Button
                variant={darkMode ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDarkMode(!darkMode)}
                title="Dark mode preview"
                aria-label="Dark mode preview"
                aria-pressed={darkMode}
              >
                <Moon className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant={showSource ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowSource(!showSource)}
              title="View block data (JSON)"
              aria-label="View block data (JSON)"
              aria-pressed={showSource}
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>

          {/* Canvas */}
          <div 
            className={cn(
              "mx-auto bg-background rounded-lg border shadow-sm min-h-96 transition-all",
              previewMode === 'desktop' ? 'max-w-xl' : 'max-w-xs',
              darkMode && 'bg-gray-900 text-white'
            )}
          >
            {showSource ? (
              <pre className="p-4 text-xs overflow-auto max-h-96 font-mono">
                {JSON.stringify(blocks, null, 2)}
              </pre>
            ) : blocks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>Add blocks from the left panel</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {blocks.map((block) => (
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
                    <BlockPreview block={block} darkMode={darkMode} />
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
                onOpenMediaLibrary={(prop: "url" | "imageUrl") => {
                  setMediaSelectionTarget({ blockId: selectedBlock.id, prop })
                  setMediaLibraryOpen(true)
                }}
                onOpenCropModal={selectedBlock.type === 'image' && selectedBlock.props.url ? () => {
                  setCropTarget({
                    blockId: selectedBlock.id,
                    url: String(selectedBlock.props.url),
                    initialCrop: selectedBlock.props.cropWidth ? {
                      x: Number(selectedBlock.props.cropX) || 0,
                      y: Number(selectedBlock.props.cropY) || 0,
                      width: Number(selectedBlock.props.cropWidth) || 0,
                      height: Number(selectedBlock.props.cropHeight) || 0,
                    } : undefined,
                  })
                  setCropModalOpen(true)
                } : undefined}
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

      <MediaLibrarySidebar
        isOpen={mediaLibraryOpen}
        onClose={() => {
          setMediaLibraryOpen(false)
          setMediaSelectionTarget(null)
        }}
        selectionMode={!!mediaSelectionTarget}
        onSelect={handleMediaSelect}
      />

      <ImageCropModal
        open={cropModalOpen}
        onOpenChange={setCropModalOpen}
        imageUrl={cropTarget?.url || ''}
        initialCrop={cropTarget?.initialCrop}
        onCropComplete={(crop) => {
          if (cropTarget) {
            updateBlock(cropTarget.blockId, {
              cropX: crop.x,
              cropY: crop.y,
              cropWidth: crop.width,
              cropHeight: crop.height,
            })
          }
          setCropTarget(null)
        }}
      />

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview with Merge Fields</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 mt-4 flex-1 min-h-0">
            {/* Sample data form */}
            <div className="w-48 space-y-3 shrink-0 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground">Sample Data</p>
              {Object.entries(sampleData).map(([key, value]) => (
                <div key={key} className="relative group">
                  <Label className="text-xs">{key}</Label>
                  <div className="flex gap-1">
                    <Input
                      value={value}
                      onChange={(e) => setSampleData({ ...sampleData, [key]: e.target.value })}
                      className="h-8 text-sm pr-7"
                    />
                    <button
                      onClick={() => {
                        const newData = { ...sampleData }
                        delete newData[key]
                        setSampleData(newData)
                      }}
                      className="absolute right-1 top-6 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      title="Remove field"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const fieldName = prompt('Field name:')
                  if (fieldName && fieldName.trim()) {
                    setSampleData({
                      ...sampleData,
                      [fieldName.trim()]: ''
                    })
                  }
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Field
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Use <code className="bg-muted px-1 rounded">{'{{field}}'}</code> in your email content to insert merge fields.
              </p>
            </div>
            
            {/* Preview content */}
            <div className="flex-1 border rounded bg-white overflow-hidden min-h-0 flex flex-col">
              {previewLoading ? (
                <div className="flex justify-center items-center py-12 flex-1">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div 
                  className="p-4 overflow-auto flex-1"
                  dangerouslySetInnerHTML={{ __html: previewHtml }} 
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BlockPreview({ block, darkMode: _darkMode }: { block: Block; darkMode?: boolean }) {
  const { type, props } = block
  // darkMode prop reserved for future dark mode styling of individual blocks

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
        <div
          className="p-3 prose prose-sm max-w-none"
          style={{ fontSize: Number(props.fontSize) || 14, textAlign: (props.align as 'left' | 'center' | 'right') || 'left' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(props.content)) || '<p>Enter text content...</p>' }}
        />
      )
    case 'image':
      return (
        <div className="p-3" style={{ textAlign: (props.align as 'left' | 'center' | 'right') || 'center' }}>
          {props.url ? (
            <img 
              src={String(props.url)} 
              alt={String(props.alt) || ''} 
              style={{ 
                maxWidth: props.width ? `${props.width}%` : '100%',
                objectFit: (props.objectFit as 'contain' | 'cover' | 'fill') || 'contain',
              }} 
            />
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

function BlockProperties({ block, onChange, onOpenMediaLibrary, onOpenCropModal }: { 
  block: Block; 
  onChange: (props: Record<string, unknown>) => void;
  onOpenMediaLibrary: (prop: "url" | "imageUrl") => void;
  onOpenCropModal?: () => void;
}) {
  const { type, props } = block

  switch (type) {
    case 'header':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Image URL</Label>
            <div className="flex gap-2">
              <Input
                value={String(props.imageUrl || '')}
                onChange={(e) => onChange({ imageUrl: e.target.value })}
                placeholder="https://..."
                className="h-8 text-xs flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-8 w-8 shrink-0"
                onClick={() => onOpenMediaLibrary("imageUrl")}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </div>
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
            <RichTextEditor
              value={String(props.content || '')}
              onChange={(content) => onChange({ content })}
              placeholder="Hello {{name}}..."
              className="min-h-[120px]"
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
            <div className="flex gap-2">
              <Input
                value={String(props.url || '')}
                onChange={(e) => onChange({ url: e.target.value })}
                placeholder="https://..."
                className="h-8 text-xs flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-8 w-8 shrink-0"
                onClick={() => onOpenMediaLibrary("url")}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </div>
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
          <div className="space-y-1">
            <Label className="text-xs">Fit</Label>
            <select
              value={String(props.objectFit || 'contain')}
              onChange={(e) => onChange({ objectFit: e.target.value })}
              className="w-full h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="contain">Contain (show all)</option>
              <option value="cover">Cover (fill, may crop)</option>
              <option value="fill">Fill (stretch)</option>
            </select>
          </div>
          {Boolean(props.url) && onOpenCropModal && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onOpenCropModal}
            >
              <Crop className="h-4 w-4 mr-2" />
              Crop Image
            </Button>
          )}
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
      return { url: '', alt: '', width: 100, align: 'center', objectFit: 'contain', cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0 }
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
