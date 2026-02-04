# Misc Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 open issues: certificate template improvements (#23, #24, #25), interest confirmation page (#35, #36), and AlertDialog replacement (#45).

**Architecture:** Independent tasks dispatched as parallel subagents. Certificate fixes are isolated per-template. Confirmation page issues (#35/#36) combined as they modify the same file. AlertDialog is purely frontend.

**Tech Stack:** React, TypeScript, @react-pdf/renderer, Express, shadcn/ui

---

## Task 1: Fix creative-artistic template long name overflow (#23)

**Files:**
- Modify: `server/src/services/pdf/templates/creative-artistic.tsx:206-208`

**Changes:**
- Cap the 1.2x font size multiplier so names 35+ chars don't overflow
- Add a max font size cap of 36 for the multiplied result
- For names > 40 chars, use the base font size without multiplier

## Task 2: Fix CSS gap and transform in PDF templates (#24)

**Files:**
- Modify: `server/src/services/pdf/templates/tech-digital.tsx` (lines 98, 150 - replace gap with margins)
- Modify: `server/src/services/pdf/templates/event-achievement.tsx` (lines 139-144 - fix transform syntax)

**Changes:**
- Replace `gap: 8` and `gap: 50` in tech-digital with `marginRight` on child elements
- Replace string-based `transform: 'translateX(-50%)'` with react-pdf object syntax `transform: [{ translateX: -150 }]` in event-achievement watermark

## Task 3: Add style props to shared Signatories component (#25)

**Files:**
- Modify: `server/src/services/pdf/components/Signatories.tsx`
- Modify: `server/src/services/pdf/templates/dark-elegant.tsx` (use shared component)
- Modify: `server/src/services/pdf/templates/tech-digital.tsx` (use shared component)

**Changes:**
- Add color override props to Signatories: `nameColor`, `titleColor`, `orgColor`, `lineColor`
- Update dark-elegant and tech-digital to use shared Signatories with custom colors
- Remove duplicated signatory rendering code from both templates

## Task 4: Interest confirmation page improvements (#35 + #36)

**Files:**
- Modify: `server/src/routes/tracking.ts` (getHostedThankYouPage function, lines 152-211)
- Modify: `server/src/services/tracking.ts` (getActionConfig, lines 243-274)

**Changes:**
- Add optional CTA button to the hosted confirmation page (label + URL)
- Add optional auto-redirect with configurable delay
- Extend `getActionConfig()` to pass new fields (ctaLabel, ctaUrl, redirectUrl, redirectDelay)
- Update the HTML template to render CTA button and meta refresh/JS redirect

## Task 5: Replace native confirm() with shadcn AlertDialog (#45)

**Files:**
- Modify: `frontend/src/pages/Sequences.tsx` (lines 259, 406)

**Changes:**
- Replace `confirm('Delete this sequence?')` in SequenceCard with AlertDialog
- Replace `confirm('Delete this step?')` in SequenceEditor with AlertDialog
- Add dialog state management for each confirmation
- Use existing `frontend/src/components/ui/alert-dialog.tsx`
