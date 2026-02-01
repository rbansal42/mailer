import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import DOMPurify from 'isomorphic-dompurify'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Highlighter,
  Type,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const COLOR_PALETTE = [
  '#000000',
  '#374151',
  '#6b7280',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ffffff',
]

const FONT_SIZES = [
  { label: 'Small', value: '0.875em' },
  { label: 'Normal', value: '1em' },
  { label: 'Large', value: '1.25em' },
  { label: 'XL', value: '1.5em' },
]

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

function ToolbarSeparator() {
  return <div className="mx-1 h-6 w-px bg-border" />
}

interface ColorPickerProps {
  colors: string[]
  activeColor?: string
  onSelect: (color: string) => void
}

function ColorPicker({ colors, activeColor, onSelect }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            'h-6 w-6 rounded border border-border transition-transform hover:scale-110',
            activeColor === color && 'ring-2 ring-ring ring-offset-1'
          )}
          style={{ backgroundColor: color }}
          onClick={() => onSelect(color)}
        />
      ))}
    </div>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = React.useState('')
  const [linkPopoverOpen, setLinkPopoverOpen] = React.useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const sanitized = DOMPurify.sanitize(html)
      onChange(sanitized)
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[200px] p-3 focus:outline-none',
      },
    },
  })

  // Sync external value changes
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  const setLink = React.useCallback(() => {
    if (!editor) return

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl })
        .run()
    }
    setLinkPopoverOpen(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  const openLinkPopover = React.useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href || ''
    setLinkUrl(previousUrl)
    setLinkPopoverOpen(true)
  }, [editor])

  const setFontSize = React.useCallback(
    (size: string) => {
      if (!editor) return
      editor.chain().focus().setMark('textStyle', { fontSize: size }).run()
    },
    [editor]
  )

  if (!editor) {
    return null
  }

  return (
    <div className={cn('rounded-md border bg-background', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
        {/* Text formatting */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', editor.isActive('bold') && 'bg-accent')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', editor.isActive('italic') && 'bg-accent')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', editor.isActive('underline') && 'bg-accent')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', editor.isActive('strike') && 'bg-accent')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        {/* Link */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', editor.isActive('link') && 'bg-accent')}
              onClick={openLinkPopover}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Link URL</label>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setLink()
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLinkUrl('')
                    setLink()
                  }}
                >
                  Remove
                </Button>
                <Button type="button" size="sm" onClick={setLink}>
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarSeparator />

        {/* Headings */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive('heading', { level: 1 }) && 'bg-accent'
          )}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive('heading', { level: 2 }) && 'bg-accent'
          )}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive('heading', { level: 3 }) && 'bg-accent'
          )}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <ToolbarSeparator />

        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive('bulletList') && 'bg-accent'
          )}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive('orderedList') && 'bg-accent'
          )}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive('blockquote') && 'bg-accent'
          )}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>

        <ToolbarSeparator />

        {/* Text alignment */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive({ textAlign: 'left' }) && 'bg-accent'
          )}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive({ textAlign: 'center' }) && 'bg-accent'
          )}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            editor.isActive({ textAlign: 'right' }) && 'bg-accent'
          )}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <ToolbarSeparator />

        {/* Text color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Text Color</span>
              <ColorPicker
                colors={COLOR_PALETTE}
                activeColor={editor.getAttributes('textStyle').color}
                onSelect={(color) =>
                  editor.chain().focus().setColor(color).run()
                }
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Highlight Color</span>
              <ColorPicker
                colors={COLOR_PALETTE}
                activeColor={editor.getAttributes('highlight').color}
                onSelect={(color) =>
                  editor.chain().focus().toggleHighlight({ color }).run()
                }
              />
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarSeparator />

        {/* Font size */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <div className="flex flex-col gap-1">
              <span className="mb-1 text-sm font-medium">Font Size</span>
              {FONT_SIZES.map((size) => (
                <Button
                  key={size.value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => setFontSize(size.value)}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="min-h-[200px]"
        placeholder={placeholder}
      />
    </div>
  )
}
