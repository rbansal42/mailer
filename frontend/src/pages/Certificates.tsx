import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import {
  Plus, ChevronLeft, Save, Trash2, Loader2, Upload, X, GripVertical,
  ChevronDown, ChevronRight, Eye, Download, FileSpreadsheet, Award,
  Palette, Users, Image, RotateCcw
} from 'lucide-react'
import { cn } from '../lib/utils'
import { api } from '../lib/api'
import type { CertificateConfig, CertificateTemplate, LogoConfig, SignatoryConfig, CertificateData } from '../lib/api'

const TEMPLATE_CATEGORIES = [
  { id: 'modern', name: 'Modern', icon: Palette },
  { id: 'dark', name: 'Dark', icon: Award },
  { id: 'elegant', name: 'Elegant', icon: Award },
  { id: 'minimal', name: 'Minimal', icon: Award },
] as const

const SAMPLE_DATA: CertificateData = {
  name: 'Jane Smith',
  title: 'AI Workshop',
  date: 'January 31, 2026',
  certificate_id: 'CERT-2026-SAMPLE',
  email: 'jane@example.com'
}

export default function Certificates() {
  const [isEditing, setIsEditing] = useState(false)
  const [editingConfig, setEditingConfig] = useState<CertificateConfig | null>(null)
  const [generatingConfig, setGeneratingConfig] = useState<CertificateConfig | null>(null)

  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ['certificateConfigs'],
    queryFn: api.getCertificateConfigs,
  })

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['certificateTemplates'],
    queryFn: api.getCertificateTemplates,
  })

  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: api.deleteCertificateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificateConfigs'] })
    },
  })

  const handleEdit = (config: CertificateConfig) => {
    setEditingConfig(config)
    setIsEditing(true)
  }

  const handleNew = () => {
    setEditingConfig(null)
    setIsEditing(true)
  }

  const handleBack = () => {
    setIsEditing(false)
    setEditingConfig(null)
  }

  const handleGenerate = (config: CertificateConfig) => {
    setGeneratingConfig(config)
  }

  if (isEditing) {
    return <CertificateEditor config={editingConfig} templates={templates || []} onBack={handleBack} />
  }

  if (generatingConfig) {
    return <CsvUploadModal config={generatingConfig} onClose={() => setGeneratingConfig(null)} />
  }

  const isLoading = configsLoading || templatesLoading

  return (
    <div className="p-4">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Certificates</h1>
          <p className="text-sm text-muted-foreground">Design and generate professional certificates</p>
        </div>
        <Button size="sm" onClick={handleNew} disabled={templatesLoading}>
          <Plus className="h-4 w-4 mr-1" />
          New Certificate
        </Button>
      </div>

      {/* Saved Configs List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : configs && configs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((config) => {
            const template = templates?.find(t => t.id === config.templateId)
            return (
              <Card key={config.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{config.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteMutation.mutate(config.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {template?.name || config.templateId}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="flex items-center gap-4 mb-3">
                    {/* Color preview dots */}
                    <div className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: config.colors.primary }}
                        title="Primary"
                      />
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: config.colors.secondary }}
                        title="Secondary"
                      />
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: config.colors.accent }}
                        title="Accent"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {config.signatories.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Image className="h-3 w-3" />
                        {config.logos.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(config)}>
                      Edit
                    </Button>
                    <Button size="sm" className="flex-1" onClick={() => handleGenerate(config)}>
                      Generate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No certificate configurations yet</p>
            <Button size="sm" onClick={handleNew} disabled={templatesLoading}>
              <Plus className="h-4 w-4 mr-1" />
              Create Certificate
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface EditorProps {
  config: CertificateConfig | null
  templates: CertificateTemplate[]
  onBack: () => void
}

function CertificateEditor({ config, templates, onBack }: EditorProps) {
  const queryClient = useQueryClient()
  
  const firstTemplate = templates[0]
  
  // State
  const [configName, setConfigName] = useState(config?.name || 'Untitled Certificate')
  const [selectedTemplateId, setSelectedTemplateId] = useState(config?.templateId || firstTemplate?.id || '')
  const [titleText, setTitleText] = useState(config?.titleText || 'CERTIFICATE')
  const [subtitleText, setSubtitleText] = useState(config?.subtitleText || 'of Participation')
  const [descriptionTemplate, setDescriptionTemplate] = useState(
    config?.descriptionTemplate || 'This is to certify that {{name}} has successfully completed the {{title}} on {{date}}.'
  )
  const [colors, setColors] = useState(
    config?.colors || firstTemplate?.defaultColors || { primary: '#1e40af', secondary: '#3b82f6', accent: '#fbbf24' }
  )
  const [logos, setLogos] = useState<LogoConfig[]>(config?.logos || [])
  const [signatories, setSignatories] = useState<SignatoryConfig[]>(config?.signatories || [])
  const [previewPdf, setPreviewPdf] = useState<string>('')
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['modern'])

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  // Update template ID when templates load
  useEffect(() => {
    if (!selectedTemplateId && firstTemplate) {
      setSelectedTemplateId(firstTemplate.id)
      setColors(firstTemplate.defaultColors)
    }
  }, [firstTemplate, selectedTemplateId])

  const saveMutation = useMutation({
    mutationFn: (data: Omit<CertificateConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
      config
        ? api.updateCertificateConfig(config.id, data)
        : api.createCertificateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificateConfigs'] })
      onBack()
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      name: configName,
      templateId: selectedTemplateId,
      colors,
      logos,
      signatories,
      titleText,
      subtitleText,
      descriptionTemplate,
    })
  }

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setColors(template.defaultColors)
    }
  }

  const handleResetColors = () => {
    if (selectedTemplate) {
      setColors(selectedTemplate.defaultColors)
    }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    )
  }

  // Preview generation requires saving config first, so we use a temporary preview
  const loadPreview = useCallback(async () => {
    if (!config?.id) {
      // For new configs, show a placeholder
      setPreviewPdf('')
      return
    }
    
    setIsLoadingPreview(true)
    try {
      const result = await api.previewCertificate(config.id, SAMPLE_DATA)
      setPreviewPdf(result.pdf)
    } catch (error) {
      console.error('Failed to load preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [config?.id])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            className="h-8 text-sm font-semibold w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main Content - 3 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Template Gallery */}
        <div className="w-64 border-r bg-muted/30 overflow-y-auto p-3">
          <p className="text-xs font-medium text-muted-foreground mb-3">Templates</p>
          
          {templates.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            TEMPLATE_CATEGORIES.map(category => {
              const categoryTemplates = templates.filter(t => t.category === category.id)
              if (categoryTemplates.length === 0) return null
              const isExpanded = expandedCategories.includes(category.id)
              
              return (
                <div key={category.id} className="mb-2">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium rounded hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-2 capitalize">
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {category.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{categoryTemplates.length}</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-1 space-y-1 ml-4">
                      {categoryTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => handleSelectTemplate(template.id)}
                          className={cn(
                            'w-full text-left px-2 py-2 rounded border transition-colors',
                            selectedTemplateId === template.id
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent hover:bg-accent'
                          )}
                        >
                          <p className="text-xs font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{template.description}</p>
                          <div className="flex gap-1 mt-1">
                            <div
                              className="w-3 h-3 rounded-full border"
                              style={{ backgroundColor: template.defaultColors.primary }}
                            />
                            <div
                              className="w-3 h-3 rounded-full border"
                              style={{ backgroundColor: template.defaultColors.secondary }}
                            />
                            <div
                              className="w-3 h-3 rounded-full border"
                              style={{ backgroundColor: template.defaultColors.accent }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Middle Column - Preview Canvas */}
        <div className="flex-1 p-4 overflow-y-auto bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Preview</span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPreview}
              disabled={isLoadingPreview || !config?.id}
              title={!config?.id ? 'Save configuration first to preview' : undefined}
            >
              {isLoadingPreview ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              Preview
            </Button>
          </div>

          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            {isLoadingPreview ? (
              <div className="aspect-[4/3] flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewPdf ? (
              <iframe
                src={`data:application/pdf;base64,${previewPdf}`}
                className="w-full aspect-[4/3]"
                title="Certificate Preview"
              />
            ) : (
              <div className="aspect-[4/3] flex items-center justify-center bg-muted">
                <div className="text-center">
                  <Award className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {config?.id ? 'Click Preview to generate' : 'Save configuration to enable preview'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium mb-2">Sample Data</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {Object.entries(SAMPLE_DATA).map(([key, value]) => (
                <div key={key}>
                  <span className="font-mono text-primary">{`{{${key}}}`}</span>: {value}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Customization */}
        <div className="w-80 border-l bg-card overflow-y-auto p-4 space-y-6">
          {/* Config Name */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Config Name</Label>
            <Input
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="My Certificate"
              className="h-8 text-sm"
            />
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-3">
            <Label className="text-xs font-medium">Title & Subtitle</Label>
            <Input
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              placeholder="CERTIFICATE"
              className="h-8 text-sm"
            />
            <Input
              value={subtitleText}
              onChange={(e) => setSubtitleText(e.target.value)}
              placeholder="of Participation"
              className="h-8 text-sm"
            />
          </div>

          {/* Description Template */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Description Template</Label>
            <textarea
              value={descriptionTemplate}
              onChange={(e) => setDescriptionTemplate(e.target.value)}
              placeholder="This is to certify that {{name}}..."
              className="w-full h-24 text-xs rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Variables: {`{{name}}, {{title}}, {{date}}, {{certificate_id}}, {{custom1}}, {{custom2}}, {{custom3}}`}
            </p>
          </div>

          {/* Colors Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Colors</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleResetColors}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
            <ColorPicker
              label="Primary"
              value={colors.primary}
              onChange={(value) => setColors({ ...colors, primary: value })}
            />
            <ColorPicker
              label="Secondary"
              value={colors.secondary}
              onChange={(value) => setColors({ ...colors, secondary: value })}
            />
            <ColorPicker
              label="Accent"
              value={colors.accent}
              onChange={(value) => setColors({ ...colors, accent: value })}
            />
          </div>

          {/* Logos Section */}
          <LogoManager logos={logos} onChange={setLogos} />

          {/* Signatories Section */}
          <SignatoryEditor signatories={signatories} onChange={setSignatories} />
        </div>
      </div>
    </div>
  )
}

interface ColorPickerProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 text-xs font-mono"
        />
      </div>
    </div>
  )
}

interface LogoManagerProps {
  logos: LogoConfig[]
  onChange: (logos: LogoConfig[]) => void
}

function LogoManager({ logos, onChange }: LogoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (logos.length >= 6) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const newLogo: LogoConfig = {
          id: `logo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: event.target?.result as string,
          width: 100,
          order: logos.length,
        }
        onChange([...logos, newLogo])
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = (id: string) => {
    onChange(logos.filter(l => l.id !== id))
  }

  const handleWidthChange = (id: string, width: number) => {
    onChange(logos.map(l => l.id === id ? { ...l, width } : l))
  }

  const handleReorder = (dragIndex: number, dropIndex: number) => {
    const newLogos = [...logos]
    const [removed] = newLogos.splice(dragIndex, 1)
    newLogos.splice(dropIndex, 0, removed)
    onChange(newLogos.map((l, i) => ({ ...l, order: i })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Logos ({logos.length}/6)</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs"
          disabled={logos.length >= 6}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {logos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No logos added</p>
      ) : (
        <div className="space-y-2">
          {logos.map((logo, index) => (
            <div
              key={logo.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('logoIndex', index.toString())}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const dragIndex = parseInt(e.dataTransfer.getData('logoIndex'))
                handleReorder(dragIndex, index)
              }}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded border"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <img src={logo.url} alt="" className="h-8 w-8 object-contain" />
              <div className="flex-1">
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={logo.width}
                  onChange={(e) => handleWidthChange(logo.id, parseInt(e.target.value))}
                  className="w-full h-1"
                />
                <p className="text-xs text-muted-foreground">{logo.width}px</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleDelete(logo.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface SignatoryEditorProps {
  signatories: SignatoryConfig[]
  onChange: (signatories: SignatoryConfig[]) => void
}

function SignatoryEditor({ signatories, onChange }: SignatoryEditorProps) {
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  const handleAdd = () => {
    if (signatories.length >= 4) return

    const newSignatory: SignatoryConfig = {
      id: `sig_${Date.now()}`,
      name: '',
      designation: '',
      organization: '',
      signatureUrl: '',
      order: signatories.length,
    }
    onChange([...signatories, newSignatory])
  }

  const handleUpdate = (id: string, updates: Partial<SignatoryConfig>) => {
    onChange(signatories.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const handleDelete = (id: string) => {
    onChange(signatories.filter(s => s.id !== id))
  }

  const handleSignatureUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      handleUpdate(id, { signatureUrl: event.target?.result as string })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Signatories ({signatories.length}/4)</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs"
          disabled={signatories.length >= 4}
          onClick={handleAdd}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {signatories.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No signatories added</p>
      ) : (
        <div className="space-y-3">
          {signatories.map((sig) => (
            <div key={sig.id} className="p-3 bg-muted/50 rounded border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Signatory {signatories.indexOf(sig) + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive"
                  onClick={() => handleDelete(sig.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={sig.name}
                onChange={(e) => handleUpdate(sig.id, { name: e.target.value })}
                placeholder="Name"
                className="h-7 text-xs"
              />
              <Input
                value={sig.designation}
                onChange={(e) => handleUpdate(sig.id, { designation: e.target.value })}
                placeholder="Designation"
                className="h-7 text-xs"
              />
              <Input
                value={sig.organization}
                onChange={(e) => handleUpdate(sig.id, { organization: e.target.value })}
                placeholder="Organization"
                className="h-7 text-xs"
              />
              <div className="flex items-center gap-2">
                {sig.signatureUrl ? (
                  <div className="flex items-center gap-2 flex-1">
                    <img src={sig.signatureUrl} alt="" className="h-8 object-contain" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleUpdate(sig.id, { signatureUrl: '' })}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => fileInputRefs.current[sig.id]?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload Signature
                  </Button>
                )}
                <input
                  ref={(el) => { fileInputRefs.current[sig.id] = el }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleSignatureUpload(sig.id, e)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface CsvUploadModalProps {
  config: CertificateConfig
  onClose: () => void
}

function CsvUploadModal({ config, onClose }: CsvUploadModalProps) {
  const [csvData, setCsvData] = useState<CertificateData[]>([])
  const [rawCsv, setRawCsv] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [, setProgress] = useState({ current: 0, total: 0 })
  const [generatedPdfs, setGeneratedPdfs] = useState<{ certificateId: string; recipientName: string; pdf: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCsv = (text: string): CertificateData[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const nameIndex = headers.findIndex(h => h === 'name')
    if (nameIndex === -1) return []

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      const data: CertificateData = { name: '' }
      headers.forEach((header, i) => {
        if (values[i]) {
          data[header] = values[i]
        }
      })
      return data
    }).filter(d => d.name)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setRawCsv(text)
      setCsvData(parseCsv(text))
    }
    reader.readAsText(file)
  }

  const handleTextChange = (text: string) => {
    setRawCsv(text)
    setCsvData(parseCsv(text))
  }

  const handleGenerate = async () => {
    if (csvData.length === 0) return

    setIsGenerating(true)
    setError(null)
    setProgress({ current: 0, total: csvData.length })

    try {
      const result = await api.generateCertificates(config.id, csvData)
      
      if (result.success) {
        setGeneratedPdfs(result.certificates)
        setProgress({ current: result.generated, total: csvData.length })
      } else {
        setError('Generation failed')
      }
    } catch (err) {
      console.error('Generation failed:', err)
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadZip = async () => {
    if (generatedPdfs.length === 0) return
    
    // Import JSZip dynamically for creating ZIP
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    
    generatedPdfs.forEach(cert => {
      const binaryString = atob(cert.pdf)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      zip.file(`${cert.recipientName.replace(/[^a-zA-Z0-9]/g, '_')}_${cert.certificateId}.pdf`, bytes)
    })
    
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `certificates-${config.name}-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold">Generate Certificates: {config.name}</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Error State */}
          {error && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="p-4">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Download Complete State */}
          {generatedPdfs.length > 0 && !isGenerating && (
            <Card className="border-green-500 bg-green-50 dark:bg-green-950">
              <CardContent className="p-6 text-center">
                <Download className="h-12 w-12 mx-auto mb-4 text-green-600" />
                <h3 className="font-semibold mb-2">Certificates Generated!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {generatedPdfs.length} certificates are ready for download.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleDownloadZip}>
                    <Download className="h-4 w-4 mr-1" />
                    Download ZIP
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setGeneratedPdfs([])
                    setProgress({ current: 0, total: 0 })
                    setCsvData([])
                    setRawCsv('')
                  }}>
                    Generate More
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generation Progress */}
          {isGenerating && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Generating certificates...
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all animate-pulse"
                    style={{ width: '100%' }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* CSV Upload */}
          {!isGenerating && generatedPdfs.length === 0 && (
            <>
              {/* Upload Zone */}
              <Card
                className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="py-12 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium mb-1">Upload CSV File</p>
                  <p className="text-sm text-muted-foreground">
                    Click to select or drag and drop
                  </p>
                </CardContent>
              </Card>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* CSV Format Hint */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-xs font-medium mb-2">CSV Format</p>
                  <code className="text-xs block bg-background p-2 rounded border font-mono">
                    name,email,title,date,custom1,custom2,custom3
                    <br />
                    John Doe,john@example.com,AI Workshop,2026-01-31,value1,value2,value3
                  </code>
                </CardContent>
              </Card>

              {/* Or Paste */}
              <div className="space-y-2">
                <Label className="text-sm">Or paste CSV data:</Label>
                <textarea
                  value={rawCsv}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="name,email,title,date&#10;John Doe,john@example.com,Workshop,2026-01-31"
                  className="w-full h-32 text-xs font-mono rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Preview Table */}
              {csvData.length > 0 && (
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Preview ({csvData.length} records)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">#</th>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Email</th>
                            <th className="text-left p-2">Title</th>
                            <th className="text-left p-2">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2 text-muted-foreground">{i + 1}</td>
                              <td className="p-2">{row.name}</td>
                              <td className="p-2">{row.email || '-'}</td>
                              <td className="p-2">{row.title || '-'}</td>
                              <td className="p-2">{row.date || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvData.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          ... and {csvData.length - 5} more
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Generate Button */}
              <Button
                className="w-full"
                size="lg"
                disabled={csvData.length === 0}
                onClick={handleGenerate}
              >
                <Award className="h-4 w-4 mr-2" />
                Generate {csvData.length} Certificate{csvData.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
