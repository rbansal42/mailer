# Mail Library v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the mailer with rich text editing, image crop/fit controls, and a reorganized mail/template library.

**Architecture:** Three-phase approach - each phase is independently deployable. Phase 1 adds TipTap rich text editor. Phase 2 adds image editing controls. Phase 3 reorganizes the data model and UI.

**Tech Stack:** TipTap (rich text), react-image-crop (cropping), DOMPurify (sanitization), shadcn/ui (components)

---

## Phase 1: Rich Text Editor

### Task 1.1: Install TipTap Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install TipTap packages**

```bash
cd frontend && bun add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-text-align @tiptap/extension-underline @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-font-size isomorphic-dompurify
```

**Step 2: Verify installation**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/package.json frontend/bun.lockb
git commit -m "feat: add TipTap and DOMPurify dependencies"
```

---

### Task 1.2: Create RichTextEditor Component

**Files:**
- Create: `frontend/src/components/ui/rich-text-editor.tsx`

**Step 1: Create the component**

```tsx
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import DOMPurify from 'isomorphic-dompurify'
import { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Input } from './input'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Palette,
  Highlighter,
  Type,
} from 'lucide-react'
import { useState } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const fontSizes = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '16px' },
  { label: 'Large', value: '20px' },
  { label: 'XL', value: '24px' },
]

const colors = [
  '#000000', '#374151', '#6b7280', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
]

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const sanitized = DOMPurify.sanitize(html)
      onChange(sanitized)
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  const setLink = useCallback(() => {
    if (!editor) return
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    setLinkOpen(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  if (!editor) return null

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children,
    title,
  }: { 
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title?: string
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-8 w-8 p-0', isActive && 'bg-muted')}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  )

  return (
    <div className={cn('border rounded-md', className)}>
      {/* Fixed Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1 border-b bg-muted/30">
        {/* Text Style */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1 self-center" />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1 self-center" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1 self-center" />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1 self-center" />

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor.isActive('link') && 'bg-muted')}
              title="Link"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setLink()}
              />
              <Button size="sm" onClick={setLink}>
                {linkUrl ? 'Set' : 'Remove'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Text Color">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border border-border"
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Highlight">
              <Highlighter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border border-border"
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Font Size */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Font Size">
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1">
            <div className="flex flex-col">
              {fontSizes.map((size) => (
                <Button
                  key={size.value}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    editor.chain().focus().setMark('textStyle', { fontSize: size.value }).run()
                  }}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  )
}
```

**Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/ui/rich-text-editor.tsx
git commit -m "feat: create RichTextEditor component with TipTap"
```

---

### Task 1.3: Integrate RichTextEditor into Templates Page

**Files:**
- Modify: `frontend/src/pages/Templates.tsx`

**Step 1: Import the component**

Add import at top of file:
```tsx
import { RichTextEditor } from '@/components/ui/rich-text-editor'
```

**Step 2: Replace textarea in text block editor**

Find the text block properties section (around line 624-629) and replace the textarea with RichTextEditor:

```tsx
// Replace this:
<textarea
  value={String(props.content || '')}
  onChange={(e) => onChange({ content: e.target.value })}
  placeholder="Hello {{name}}..."
  className="w-full h-24 text-xs rounded-md border border-input bg-background text-foreground px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
/>

// With this:
<RichTextEditor
  value={String(props.content || '')}
  onChange={(content) => onChange({ content })}
  placeholder="Hello {{name}}..."
  className="min-h-[120px]"
/>
```

**Step 3: Update text block preview**

Find the text block preview (around line 512-520) and update to render HTML:

```tsx
// Replace this:
case 'text':
  return (
    <p
      className="p-3"
      style={{ fontSize: Number(props.fontSize) || 14, textAlign: (props.align as 'left' | 'center' | 'right') || 'left' }}
    >
      {String(props.content) || 'Enter text content...'}
    </p>
  )

// With this:
case 'text':
  return (
    <div
      className="p-3 prose prose-sm max-w-none"
      style={{ fontSize: Number(props.fontSize) || 14, textAlign: (props.align as 'left' | 'center' | 'right') || 'left' }}
      dangerouslySetInnerHTML={{ __html: String(props.content) || '<p>Enter text content...</p>' }}
    />
  )
```

**Step 4: Verify build and test manually**

Run: `bun run build && bun run dev`
Test: Open templates page, add text block, verify rich text editor works

**Step 5: Commit**

```bash
git add frontend/src/pages/Templates.tsx
git commit -m "feat: integrate RichTextEditor into template text blocks"
```

---

### Task 1.4: Update Template Compiler for HTML Content

**Files:**
- Modify: `server/src/services/template-compiler.ts`

**Step 1: Install DOMPurify on server**

```bash
cd server && bun add isomorphic-dompurify
```

**Step 2: Update compileText function**

```ts
import DOMPurify from 'isomorphic-dompurify'

function compileText(props: Record<string, unknown>, data: Record<string, string>): string {
  const fontSize = Number(props.fontSize) || 16
  const align = String(props.align || 'left')
  let content = String(props.content || '')
  
  // Replace variables in HTML content
  content = replaceVariables(content, data)
  
  // Sanitize HTML
  content = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'span'],
    ALLOWED_ATTR: ['href', 'style', 'class'],
  })

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding: 10px 20px; font-size: ${fontSize}px; line-height: 1.5; text-align: ${align}; color: #333333; font-family: Arial, sans-serif;">
          ${content}
        </td>
      </tr>
    </table>
  `
}
```

**Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add server/package.json server/bun.lockb server/src/services/template-compiler.ts
git commit -m "feat: update template compiler to handle HTML content safely"
```

---

### Task 1.5: Add Tailwind Typography Plugin

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tailwind.config.js`

**Step 1: Install typography plugin**

```bash
cd frontend && bun add -D @tailwindcss/typography
```

**Step 2: Add to tailwind config**

```js
// In tailwind.config.js plugins array:
plugins: [require('@tailwindcss/typography')],
```

**Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds with prose styles

**Step 4: Commit**

```bash
git add frontend/package.json frontend/bun.lockb frontend/tailwind.config.js
git commit -m "feat: add Tailwind typography plugin for rich text styling"
```

---

## Phase 2: Image Editing

### Task 2.1: Install Image Crop Library

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install react-image-crop**

```bash
cd frontend && bun add react-image-crop
```

**Step 2: Commit**

```bash
git add frontend/package.json frontend/bun.lockb
git commit -m "feat: add react-image-crop dependency"
```

---

### Task 2.2: Create ImageCropModal Component

**Files:**
- Create: `frontend/src/components/ui/image-crop-modal.tsx`

**Step 1: Create the component**

```tsx
import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './dialog'
import { Button } from './button'

interface ImageCropModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  initialCrop?: { x: number; y: number; width: number; height: number }
  onCropComplete: (crop: { x: number; y: number; width: number; height: number }) => void
}

export function ImageCropModal({
  open,
  onOpenChange,
  imageUrl,
  initialCrop,
  onCropComplete,
}: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()

  const onImageLoad = useCallback(() => {
    if (initialCrop && imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current
      setCrop({
        unit: '%',
        x: (initialCrop.x / naturalWidth) * 100,
        y: (initialCrop.y / naturalHeight) * 100,
        width: (initialCrop.width / naturalWidth) * 100,
        height: (initialCrop.height / naturalHeight) * 100,
      })
    }
  }, [initialCrop])

  const handleSave = () => {
    if (!completedCrop || !imgRef.current) {
      onOpenChange(false)
      return
    }

    const { naturalWidth, naturalHeight } = imgRef.current
    const { width: displayWidth, height: displayHeight } = imgRef.current.getBoundingClientRect()
    
    const scaleX = naturalWidth / displayWidth
    const scaleY = naturalHeight / displayHeight

    onCropComplete({
      x: Math.round(completedCrop.x * scaleX),
      y: Math.round(completedCrop.y * scaleY),
      width: Math.round(completedCrop.width * scaleX),
      height: Math.round(completedCrop.height * scaleY),
    })
    onOpenChange(false)
  }

  const handleClear = () => {
    onCropComplete({ x: 0, y: 0, width: 0, height: 0 })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ maxHeight: '60vh' }}
            />
          </ReactCrop>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            Clear Crop
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/ui/image-crop-modal.tsx
git commit -m "feat: create ImageCropModal component"
```

---

### Task 2.3: Add Object-Fit and Crop to Image Block

**Files:**
- Modify: `frontend/src/pages/Templates.tsx`

**Step 1: Import ImageCropModal**

```tsx
import { ImageCropModal } from '@/components/ui/image-crop-modal'
```

**Step 2: Update image block default props** (around line 833-834)

```tsx
case 'image':
  return { url: '', alt: '', width: 100, align: 'center', objectFit: 'contain', cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0 }
```

**Step 3: Add object-fit dropdown to image properties panel** (after the align select, around line 700)

```tsx
<div className="space-y-1">
  <label className="text-xs text-muted-foreground">Fit</label>
  <select
    value={String(props.objectFit || 'contain')}
    onChange={(e) => onChange({ objectFit: e.target.value })}
    className="w-full text-xs rounded-md border border-input bg-background px-2 py-1"
  >
    <option value="contain">Contain</option>
    <option value="cover">Cover</option>
    <option value="fill">Fill</option>
  </select>
</div>
```

**Step 4: Add crop button and modal state**

Add state for crop modal (in the component, near other state):
```tsx
const [cropModalOpen, setCropModalOpen] = useState(false)
const [cropImageBlock, setCropImageBlock] = useState<{ id: string; url: string; crop?: { x: number; y: number; width: number; height: number } } | null>(null)
```

Add crop button in image properties (after objectFit select):
```tsx
{props.url && (
  <Button
    variant="outline"
    size="sm"
    className="w-full"
    onClick={() => {
      setCropImageBlock({
        id: block.id,
        url: String(props.url),
        crop: props.cropWidth ? { x: Number(props.cropX), y: Number(props.cropY), width: Number(props.cropWidth), height: Number(props.cropHeight) } : undefined
      })
      setCropModalOpen(true)
    }}
  >
    <Crop className="h-4 w-4 mr-2" />
    Crop Image
  </Button>
)}
```

Add the modal at the end of the component (before closing fragment):
```tsx
<ImageCropModal
  open={cropModalOpen}
  onOpenChange={setCropModalOpen}
  imageUrl={cropImageBlock?.url || ''}
  initialCrop={cropImageBlock?.crop}
  onCropComplete={(crop) => {
    if (cropImageBlock) {
      updateBlockProps(cropImageBlock.id, {
        cropX: crop.x,
        cropY: crop.y,
        cropWidth: crop.width,
        cropHeight: crop.height,
      })
    }
  }}
/>
```

**Step 5: Update image preview to use object-fit and crop** (around line 521-531)

```tsx
case 'image':
  const hasCrop = props.cropWidth && props.cropHeight
  const cropStyle = hasCrop ? {
    objectPosition: `${-Number(props.cropX)}px ${-Number(props.cropY)}px`,
    width: `${Number(props.cropWidth)}px`,
    height: `${Number(props.cropHeight)}px`,
    maxWidth: props.width ? `${props.width}%` : '100%',
  } : {
    maxWidth: props.width ? `${props.width}%` : '100%',
    objectFit: (props.objectFit as 'contain' | 'cover' | 'fill') || 'contain',
  }
  
  return (
    <div className="p-3" style={{ textAlign: (props.align as 'left' | 'center' | 'right') || 'center' }}>
      {props.url ? (
        <div className={hasCrop ? 'overflow-hidden inline-block' : undefined} style={hasCrop ? { maxWidth: props.width ? `${props.width}%` : '100%' } : undefined}>
          <img
            src={String(props.url)}
            alt={String(props.alt) || ''}
            style={cropStyle}
          />
        </div>
      ) : (
        <div className="h-24 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
          Image placeholder
        </div>
      )}
    </div>
  )
```

**Step 6: Add Crop icon import**

```tsx
import { Crop } from 'lucide-react'
```

**Step 7: Verify build and test**

Run: `bun run build && bun run dev`
Test: Add image block, verify object-fit dropdown and crop button work

**Step 8: Commit**

```bash
git add frontend/src/pages/Templates.tsx
git commit -m "feat: add object-fit and crop controls to image blocks"
```

---

### Task 2.4: Update Template Compiler for Image Crop

**Files:**
- Modify: `server/src/services/template-compiler.ts`

**Step 1: Update compileImage function**

```ts
function compileImage(props: Record<string, unknown>): string {
  const url = String(props.url || '')
  const alt = String(props.alt || '')
  const width = Number(props.width) || 100
  const align = String(props.align || 'center')
  const objectFit = String(props.objectFit || 'contain')
  
  const hasCrop = props.cropWidth && props.cropHeight
  
  let imgStyle = `max-width: ${width}%;`
  if (!hasCrop) {
    imgStyle += ` object-fit: ${objectFit};`
  }

  const alignMap: Record<string, string> = {
    left: 'left',
    center: 'center',
    right: 'right',
  }

  // For cropped images, we use clip-path (limited email support) or rely on the crop being applied to the actual image
  // For now, apply object-fit for non-cropped images
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding: 10px 20px; text-align: ${alignMap[align] || 'center'};">
          <img src="${url}" alt="${alt}" style="${imgStyle}" />
        </td>
      </tr>
    </table>
  `
}
```

**Step 2: Commit**

```bash
git add server/src/services/template-compiler.ts
git commit -m "feat: update template compiler for image object-fit"
```

---

## Phase 3: Mails vs Templates Organization

### Task 3.1: Database Schema Migration

**Files:**
- Modify: `server/src/db/index.ts`

**Step 1: Add mails table and update templates table**

In the database initialization, add:

```ts
// Add is_default column to templates (for built-in templates)
db.run(`ALTER TABLE templates ADD COLUMN is_default INTEGER DEFAULT 0`).catch(() => {
  // Column may already exist
})

// Create mails table
db.run(`
  CREATE TABLE IF NOT EXISTS mails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    blocks TEXT NOT NULL DEFAULT '[]',
    template_id INTEGER,
    campaign_id INTEGER,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
  )
`)
```

**Step 2: Commit**

```bash
git add server/src/db/index.ts
git commit -m "feat: add mails table and is_default column to templates"
```

---

### Task 3.2: Create Mails API Routes

**Files:**
- Create: `server/src/routes/mails.ts`
- Modify: `server/src/index.ts`

**Step 1: Create mails routes**

```ts
import { Router } from 'express'
import { getDb } from '../db'

const router = Router()

interface MailRow {
  id: number
  name: string
  description: string | null
  blocks: string
  template_id: number | null
  campaign_id: number | null
  status: string
  created_at: string
  updated_at: string
}

function formatMail(row: MailRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    blocks: JSON.parse(row.blocks || '[]'),
    templateId: row.template_id,
    campaignId: row.campaign_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// List all mails
router.get('/', async (req, res) => {
  try {
    const db = getDb()
    const mails = db.query('SELECT * FROM mails ORDER BY updated_at DESC').all() as MailRow[]
    res.json(mails.map(formatMail))
  } catch (error) {
    console.error('Error fetching mails:', error)
    res.status(500).json({ error: 'Failed to fetch mails' })
  }
})

// Get single mail
router.get('/:id', async (req, res) => {
  try {
    const db = getDb()
    const mail = db.query('SELECT * FROM mails WHERE id = ?').get(req.params.id) as MailRow | null
    if (!mail) {
      return res.status(404).json({ error: 'Mail not found' })
    }
    res.json(formatMail(mail))
  } catch (error) {
    console.error('Error fetching mail:', error)
    res.status(500).json({ error: 'Failed to fetch mail' })
  }
})

// Create mail
router.post('/', async (req, res) => {
  try {
    const { name, description, blocks, templateId, status } = req.body
    const db = getDb()
    const result = db.run(
      'INSERT INTO mails (name, description, blocks, template_id, status) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, JSON.stringify(blocks || []), templateId || null, status || 'draft']
    )
    const mail = db.query('SELECT * FROM mails WHERE id = ?').get(result.lastInsertRowid) as MailRow
    res.status(201).json(formatMail(mail))
  } catch (error) {
    console.error('Error creating mail:', error)
    res.status(500).json({ error: 'Failed to create mail' })
  }
})

// Update mail
router.put('/:id', async (req, res) => {
  try {
    const { name, description, blocks, status } = req.body
    const db = getDb()
    db.run(
      'UPDATE mails SET name = ?, description = ?, blocks = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description || null, JSON.stringify(blocks || []), status || 'draft', req.params.id]
    )
    const mail = db.query('SELECT * FROM mails WHERE id = ?').get(req.params.id) as MailRow
    if (!mail) {
      return res.status(404).json({ error: 'Mail not found' })
    }
    res.json(formatMail(mail))
  } catch (error) {
    console.error('Error updating mail:', error)
    res.status(500).json({ error: 'Failed to update mail' })
  }
})

// Delete mail
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb()
    const mail = db.query('SELECT * FROM mails WHERE id = ?').get(req.params.id)
    if (!mail) {
      return res.status(404).json({ error: 'Mail not found' })
    }
    db.run('DELETE FROM mails WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting mail:', error)
    res.status(500).json({ error: 'Failed to delete mail' })
  }
})

// Save mail as template
router.post('/:id/save-as-template', async (req, res) => {
  try {
    const { name, description } = req.body
    const db = getDb()
    const mail = db.query('SELECT * FROM mails WHERE id = ?').get(req.params.id) as MailRow | null
    if (!mail) {
      return res.status(404).json({ error: 'Mail not found' })
    }
    const result = db.run(
      'INSERT INTO templates (name, description, blocks) VALUES (?, ?, ?)',
      [name || mail.name, description || mail.description, mail.blocks]
    )
    res.status(201).json({ id: result.lastInsertRowid })
  } catch (error) {
    console.error('Error saving mail as template:', error)
    res.status(500).json({ error: 'Failed to save mail as template' })
  }
})

export default router
```

**Step 2: Register routes in index.ts**

```ts
import mailsRouter from './routes/mails'
// ...
app.use('/api/mails', mailsRouter)
```

**Step 3: Commit**

```bash
git add server/src/routes/mails.ts server/src/index.ts
git commit -m "feat: add mails API routes"
```

---

### Task 3.3: Update Frontend API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add Mail interface and API functions**

```ts
export interface Mail {
  id: number
  name: string
  description: string | null
  blocks: Block[]
  templateId: number | null
  campaignId: number | null
  status: 'draft' | 'sent'
  createdAt: string
  updatedAt: string
}

export const mails = {
  list: () => fetchApi<Mail[]>('/api/mails'),
  get: (id: number) => fetchApi<Mail>(`/api/mails/${id}`),
  create: (data: { name: string; description?: string; blocks?: Block[]; templateId?: number; status?: string }) =>
    fetchApi<Mail>('/api/mails', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name: string; description?: string; blocks?: Block[]; status?: string }) =>
    fetchApi<Mail>(`/api/mails/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/mails/${id}`, { method: 'DELETE' }),
  saveAsTemplate: (id: number, data: { name?: string; description?: string }) =>
    fetchApi<{ id: number }>(`/api/mails/${id}/save-as-template`, { method: 'POST', body: JSON.stringify(data) }),
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add mails API client functions"
```

---

### Task 3.4: Create Mail Library Page with Tabs

**Files:**
- Create: `frontend/src/pages/MailLibrary.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/sidebar.tsx`

**Step 1: Create MailLibrary page**

This is a substantial component - create it with tabs for Mails and Templates, listing both with create/edit/delete functionality.

(Full implementation - see separate file)

**Step 2: Update App.tsx routing**

Replace Templates route with MailLibrary.

**Step 3: Update sidebar navigation**

Change "Templates" to "Mail Library".

**Step 4: Commit**

```bash
git add frontend/src/pages/MailLibrary.tsx frontend/src/App.tsx frontend/src/components/layout/sidebar.tsx
git commit -m "feat: create Mail Library page with tabs"
```

---

### Task 3.5: Data Migration Script

**Files:**
- Create: `server/src/scripts/migrate-templates-to-mails.ts`

**Step 1: Create migration script**

```ts
import { getDb } from '../db'

export function migrateTemplatesToMails() {
  const db = getDb()
  
  // Get all existing templates that aren't defaults
  const templates = db.query('SELECT * FROM templates WHERE is_default = 0 OR is_default IS NULL').all()
  
  for (const template of templates as any[]) {
    // Insert into mails
    db.run(
      'INSERT INTO mails (name, description, blocks, template_id, status, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?)',
      [template.name, template.description, template.blocks, 'draft', template.created_at, template.updated_at]
    )
  }
  
  console.log(`Migrated ${templates.length} templates to mails`)
}
```

**Step 2: Commit**

```bash
git add server/src/scripts/migrate-templates-to-mails.ts
git commit -m "feat: add migration script for templates to mails"
```

---

### Task 3.6: Add Default Starter Templates

**Files:**
- Create: `server/src/data/default-templates.ts`
- Modify: `server/src/db/index.ts`

**Step 1: Create default templates data**

```ts
export const defaultTemplates = [
  {
    name: 'Newsletter',
    description: 'A classic newsletter layout with header, content sections, and footer',
    blocks: [
      { id: '1', type: 'header', props: { text: 'Newsletter Title', fontSize: 28, align: 'center' } },
      { id: '2', type: 'divider', props: {} },
      { id: '3', type: 'text', props: { content: '<p>Write your newsletter content here...</p>', fontSize: 16, align: 'left' } },
      { id: '4', type: 'spacer', props: { height: 20 } },
      { id: '5', type: 'footer', props: { text: '© 2026 Your Company | Unsubscribe' } },
    ],
  },
  {
    name: 'Announcement',
    description: 'Simple announcement with prominent header and call-to-action',
    blocks: [
      { id: '1', type: 'header', props: { text: 'Big Announcement!', fontSize: 32, align: 'center' } },
      { id: '2', type: 'text', props: { content: '<p>Share your exciting news here...</p>', fontSize: 18, align: 'center' } },
      { id: '3', type: 'button', props: { text: 'Learn More', url: '', align: 'center' } },
      { id: '4', type: 'footer', props: { text: 'Unsubscribe' } },
    ],
  },
  {
    name: 'Blank',
    description: 'Start from scratch',
    blocks: [],
  },
]
```

**Step 2: Seed defaults on startup in db/index.ts**

```ts
import { defaultTemplates } from '../data/default-templates'

// After table creation:
const existingDefaults = db.query('SELECT COUNT(*) as count FROM templates WHERE is_default = 1').get() as { count: number }
if (existingDefaults.count === 0) {
  for (const template of defaultTemplates) {
    db.run(
      'INSERT INTO templates (name, description, blocks, is_default) VALUES (?, ?, ?, 1)',
      [template.name, template.description, JSON.stringify(template.blocks)]
    )
  }
}
```

**Step 3: Commit**

```bash
git add server/src/data/default-templates.ts server/src/db/index.ts
git commit -m "feat: add default starter templates"
```

---

## Summary

**Phase 1** (Tasks 1.1-1.5): Rich text editor with TipTap
**Phase 2** (Tasks 2.1-2.4): Image editing with object-fit and crop
**Phase 3** (Tasks 3.1-3.6): Mails vs Templates organization

Each phase is independently deployable and testable.
