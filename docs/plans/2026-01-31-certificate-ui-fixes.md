# Certificate UI Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 certificate editor UI issues: slider drag, save behavior, live preview, and PDF layout.

**Architecture:** 
- Add sonner for toast notifications
- Create new preview-draft API endpoint for unsaved config preview
- Fix event propagation on slider
- Improve PDF layout with flexbox constraints

**Tech Stack:** React, TypeScript, Sonner, React-PDF, Express

---

## Phase 1: Quick Fixes (Parallel)

### Task 1.1: Add Sonner Toast Library

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/App.tsx`

**Step 1: Install sonner**
```bash
cd frontend && bun add sonner
```

**Step 2: Add Toaster to App.tsx**

Add import at top:
```tsx
import { Toaster } from 'sonner'
```

Add `<Toaster />` inside the Router, after Routes:
```tsx
<Router>
  <Routes>
    {/* ... routes ... */}
  </Routes>
  <Toaster position="top-right" richColors />
</Router>
```

---

### Task 1.2: Fix Slider Drag Issue

**Files:**
- Modify: `frontend/src/pages/Certificates.tsx` (lines 745-752)

**Change:** Add event propagation stop to the range input in LogoManager component.

Find:
```tsx
<input
  type="range"
  min={50}
  max={200}
  value={logo.width}
  onChange={(e) => handleWidthChange(logo.id, parseInt(e.target.value))}
  className="w-full h-1"
/>
```

Replace with:
```tsx
<input
  type="range"
  min={50}
  max={200}
  value={logo.width}
  onChange={(e) => handleWidthChange(logo.id, parseInt(e.target.value))}
  onMouseDown={(e) => e.stopPropagation()}
  onPointerDown={(e) => e.stopPropagation()}
  className="w-full h-1 cursor-pointer"
/>
```

---

### Task 1.3: Fix Save Behavior (Don't Close Editor)

**Files:**
- Modify: `frontend/src/pages/Certificates.tsx`

**Step 1:** Add sonner import at top of file:
```tsx
import { toast } from 'sonner'
```

**Step 2:** Find the saveMutation definition (around line 265-279):
```tsx
const saveMutation = useMutation({
  mutationFn: (data: ...) =>
    config?.id
      ? api.updateCertificateConfig(config.id, data)
      : api.createCertificateConfig(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['certificateConfigs'] })
    onBack()
  },
  ...
})
```

Replace onSuccess with:
```tsx
onSuccess: (savedConfig) => {
  queryClient.invalidateQueries({ queryKey: ['certificateConfigs'] })
  toast.success('Configuration saved successfully')
  // If new config, we need to update our local reference for preview to work
  if (!config?.id && savedConfig?.id) {
    // Force a re-render with the new config ID
    queryClient.setQueryData(['certificateConfig', savedConfig.id], savedConfig)
  }
},
```

---

## Phase 2: Live Preview Feature

### Task 2.1: Add Preview Draft API Endpoint (Server)

**Files:**
- Modify: `server/src/routes/certificates.ts`

**Add new endpoint after the existing `/preview` endpoint:**

```tsx
// POST /preview-draft - Preview with unsaved config data (no configId required)
certificatesRouter.post('/preview-draft', async (req, res) => {
  const { config, data } = req.body as {
    config: {
      templateId: string
      titleText: string
      subtitleText: string
      descriptionTemplate: string
      logos: Array<{ url: string; width?: number }>
      signatories: Array<{
        name: string
        designation: string
        organization?: string
        signatureUrl?: string
      }>
    }
    data: CertificateData
  }

  if (!config || !data || !data.name) {
    return res.status(400).json({ error: 'config and data with name are required' })
  }

  if (!isValidTemplate(config.templateId)) {
    return res.status(400).json({ error: `Invalid template ID. Valid options: ${getReactPdfTemplateIds().join(', ')}` })
  }

  logger.info('Generating draft certificate preview', { service: 'certificates', templateId: config.templateId })

  try {
    const props: CertificateProps = {
      title: config.titleText || 'CERTIFICATE',
      subtitle: config.subtitleText,
      recipientName: data.name,
      description: replaceVariables(config.descriptionTemplate || '', data),
      logos: config.logos,
      signatories: config.signatories,
      certificateId: data.certificate_id || 'PREVIEW',
    }

    const pdfBuffer = await generateReactPdf(config.templateId as TemplateId, props)
    const base64 = pdfBuffer.toString('base64')

    logger.info('Draft certificate preview generated', { service: 'certificates' })
    res.json({ pdf: base64 })
  } catch (error) {
    logger.error('Failed to generate draft certificate preview', {
      service: 'certificates',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    res.status(500).json({ error: 'Failed to generate certificate preview' })
  }
})
```

---

### Task 2.2: Add Frontend API Function

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Add after the existing `previewCertificate` function:**

```tsx
previewCertificateDraft: (
  config: {
    templateId: string
    titleText: string
    subtitleText: string
    descriptionTemplate: string
    logos: LogoConfig[]
    signatories: SignatoryConfig[]
  },
  data: CertificateData
) =>
  request<{ pdf: string }>('/certificates/preview-draft', {
    method: 'POST',
    body: JSON.stringify({ config, data }),
  }),
```

---

### Task 2.3: Implement Auto-Refresh Preview

**Files:**
- Modify: `frontend/src/pages/Certificates.tsx`

**Step 1:** Update the loadPreview function to use draft preview:

Find the existing `loadPreview` useCallback and replace it with:

```tsx
const loadPreview = useCallback(async () => {
  if (!selectedTemplateId) {
    setPreviewPdf('')
    return
  }

  setIsLoadingPreview(true)
  try {
    const result = await api.previewCertificateDraft(
      {
        templateId: selectedTemplateId,
        titleText: titleText || 'CERTIFICATE',
        subtitleText: subtitleText || 'of Participation',
        descriptionTemplate: descriptionTemplate,
        logos: logos,
        signatories: signatories,
      },
      SAMPLE_DATA
    )
    setPreviewPdf(result.pdf)
  } catch (error) {
    console.error('Failed to load preview:', error)
    setPreviewPdf('')
  } finally {
    setIsLoadingPreview(false)
  }
}, [selectedTemplateId, titleText, subtitleText, descriptionTemplate, logos, signatories])
```

**Step 2:** Add useEffect for auto-refresh with debounce:

Add this after the loadPreview definition:

```tsx
// Auto-refresh preview when editor state changes (debounced)
useEffect(() => {
  const timer = setTimeout(() => {
    loadPreview()
  }, 500)

  return () => clearTimeout(timer)
}, [loadPreview])
```

**Step 3:** Remove the old useEffect that only ran on config?.id changes (if it exists).

---

## Phase 3: PDF Layout Fixes

### Task 3.1: Fix Certificate Container Layout

**Files:**
- Modify: `server/src/services/pdf/components/Certificate.tsx`

**Replace the styles object:**

```tsx
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    fontFamily: 'Montserrat',
    padding: 0,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    padding: 40,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    maxHeight: '100%',
  },
  certificateId: {
    position: 'absolute',
    bottom: 20,
    right: 30,
    fontSize: 8,
    color: colors.muted,
  },
})
```

---

### Task 3.2: Fix Logo Bar Constraints

**Files:**
- Modify: `server/src/services/pdf/styles.ts`

**Update the logoBar and logo styles in baseStyles:**

Find:
```tsx
logoBar: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 30,
  marginBottom: 25,
},
logo: {
  height: 50,
  objectFit: 'contain' as const,
},
```

Replace with:
```tsx
logoBar: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 20,
  marginBottom: 20,
  flexWrap: 'wrap',
  maxHeight: 70,
  overflow: 'hidden',
},
logo: {
  height: 45,
  maxWidth: 120,
  objectFit: 'contain' as const,
},
```

---

### Task 3.3: Fix Template Layouts (All 4 Templates)

**Files:**
- Modify: `server/src/services/pdf/templates/modern-clean.tsx`
- Modify: `server/src/services/pdf/templates/dark-elegant.tsx`
- Modify: `server/src/services/pdf/templates/clean-minimal.tsx`
- Modify: `server/src/services/pdf/templates/wave-accent.tsx`

**For each template, ensure the content area has proper flex constraints:**

Key style changes for each template:

1. **Content container** should have:
```tsx
content: {
  flex: 1,
  minHeight: 0,  // Critical for flex shrinking
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
},
```

2. **Description text** should have:
```tsx
description: {
  ...typography.body,
  color: colors.secondary,
  textAlign: 'center',
  maxWidth: '80%',
  marginTop: 10,
  flexShrink: 1,
},
```

3. **Signatories container** should have:
```tsx
signatoriesContainer: {
  marginTop: 'auto',
  paddingTop: 15,
  flexShrink: 0,
},
```

4. **Reduce excessive margins** - change large margins (30, 25) to smaller values (15, 10).

---

## Phase 4: Build, Test, and Deploy

### Task 4.1: Build and Verify

```bash
cd /Volumes/Code/mailer/.worktrees/cert-ui-fixes
bun run build
```

### Task 4.2: Manual Testing Checklist

- [ ] Slider changes logo size without dragging the block
- [ ] Save shows toast and stays in editor
- [ ] Preview updates automatically when changing template, colors, logos, text
- [ ] Certificate fits on one page with 6 logos and 4 signatories
- [ ] All 4 templates render correctly

### Task 4.3: Commit and Push

```bash
git add -A
git commit -m "feat(certificates): Fix UI issues - slider, save, preview, layout

- Fix slider drag issue with event propagation stop
- Add sonner for toast notifications  
- Save no longer closes editor, shows success toast
- Add preview-draft endpoint for live preview of unsaved configs
- Auto-refresh preview on editor changes (500ms debounce)
- Fix PDF layout with proper flex constraints
- Constrain logo bar and content to prevent overflow"

git push -u origin feature/certificate-ui-fixes
```

### Task 4.4: Create and Merge PR

```bash
gh pr create --title "feat(certificates): Fix UI issues - slider, save, preview, layout" --body "## Summary

Fixes 4 certificate editor UI issues:

1. **Slider drag** - Fixed event propagation so slider doesn't drag the logo block
2. **Save behavior** - Save now shows toast and stays in editor (doesn't close)
3. **Live preview** - Preview auto-updates when changing any editor field
4. **PDF layout** - Fixed flex constraints to ensure certificate fits on one page

### Changes

- Added sonner for toast notifications
- New \`/certificates/preview-draft\` endpoint for unsaved config preview
- Updated PDF styles with proper flex shrinking and overflow handling
- All 4 templates updated with consistent layout constraints"

gh pr merge --squash --delete-branch
```

---

## Execution Notes

**Parallel execution possible for:**
- Phase 1: Tasks 1.1, 1.2, 1.3 can run in parallel
- Phase 2: Tasks 2.1, 2.2 can run in parallel, then 2.3
- Phase 3: Tasks 3.1, 3.2, 3.3 can run in parallel

**Dependencies:**
- Phase 2.3 depends on 2.1 and 2.2
- Phase 4 depends on all previous phases
