# LLM-Assisted Sequence Generation

**Issue:** #42  
**Date:** 2026-02-04  
**Status:** Ready for implementation

## Overview

Users click "AI Generate" on the Sequences page, fill a guided form describing their sequence, and Gemini generates a complete email sequence with full block structure.

## Decisions

| Aspect | Decision |
|--------|----------|
| LLM Provider | Gemini (`gemini-3-flash-preview`) |
| API Keys | 3 keys with rotation on rate limit |
| What it generates | Full block structure (text, action-button, button, spacer, divider) |
| Entry point | "AI Generate" button on Sequences page |
| User input | Guided form (not free-form) |
| After generation | Preview modal → "Create" saves and opens editor |
| Loading state | Simple spinner |

## 1. API Integration

New file: `server/src/services/gemini.ts`

```typescript
const GEMINI_API_KEYS = process.env.GEMINI_API_KEY?.split(',') || []
let currentKeyIndex = 0

function getNextKey(): string {
  const key = GEMINI_API_KEYS[currentKeyIndex]
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length
  return key
}

async function generateWithGemini(prompt: string, systemPrompt: string): Promise<string> {
  // Try each key on rate limit, throw after all exhausted
  // Uses Google AI SDK: @google/genai
}
```

**Environment variable:**
```
GEMINI_API_KEY=key1,key2,key3
```

## 2. Prompt Engineering

System prompt with strict constraints:

```
You are an email sequence generator. Generate a JSON array of emails for an email marketing sequence.

STRICT RULES:
1. Output ONLY valid JSON - no markdown, no explanation
2. Use ONLY these block types: "text", "action-button", "button", "spacer", "divider"
3. DO NOT invent block types like "header", "footer", "image", "cta"
4. For headings, use "text" block with <h1>, <h2> tags in content
5. For calls-to-action, use "action-button" (tracks clicks, can trigger branch) or "button" (simple link)

BLOCK SCHEMAS:
- text: { type: "text", content: "<p>HTML content</p>" }
- action-button: { type: "action-button", content: { text: "Button Text", url: "", style: "filled" } }
- button: { type: "button", content: { text: "Button Text", url: "https://...", style: "filled" } }
- spacer: { type: "spacer", content: { height: 20 } }
- divider: { type: "divider", content: {} }

OUTPUT FORMAT:
[
  {
    "subject": "Email subject line",
    "delayDays": 0,
    "blocks": [...]
  }
]
```

User prompt includes: goal, number of emails, timing preference, tone, and any specific instructions.

## 3. Backend API Endpoint

`POST /api/sequences/generate`

**Request:**
```typescript
{
  goal: string           // "Welcome new subscribers and introduce our product"
  emailCount: number     // 3-7
  timing: string         // "daily" | "every-few-days" | "weekly"
  tone: string           // "professional" | "friendly" | "casual"
  additionalContext?: string  // Optional specific instructions
}
```

**Response:**
```typescript
{
  name: string           // Generated sequence name
  emails: Array<{
    subject: string
    delayDays: number
    blocks: Block[]
  }>
}
```

**Validation:**
- `goal`: required, 10-500 characters
- `emailCount`: required, 3-7
- `timing`: required, enum
- `tone`: required, enum
- `additionalContext`: optional, max 1000 characters

## 4. Frontend UI - Generate Dialog

Triggered by "AI Generate" button on Sequences page. Uses shadcn Dialog component.

**Form fields:**
1. **Goal** (textarea, required) - "What do you want this sequence to achieve?"
2. **Number of emails** (select: 3-7, default 5)
3. **Timing** (select: Daily / Every few days / Weekly)
4. **Tone** (select: Professional / Friendly / Casual)
5. **Additional context** (textarea, optional) - "Any specific topics, products, or constraints?"

**States:**
- Form → Generating (spinner) → Preview modal
- Error shows in-place with retry button

## 5. Preview Modal

Shows generated sequence structure before saving:

```
┌─────────────────────────────────────────┐
│ Preview: "Welcome Series"            X  │
├─────────────────────────────────────────┤
│                                         │
│  Email 1: "Welcome to [Company]!"       │
│  ├─ Sends immediately                   │
│  └─ 4 blocks                            │
│                                         │
│  Email 2: "Getting Started Guide"       │
│  ├─ Sends after 2 days                  │
│  └─ 5 blocks                            │
│                                         │
│  Email 3: "Tips for Success"            │
│  ├─ Sends after 4 days                  │
│  └─ 3 blocks                            │
│                                         │
├─────────────────────────────────────────┤
│              [Cancel]  [Create]         │
└─────────────────────────────────────────┘
```

Expandable sections show block preview (text truncated, button labels visible).

## 6. Error Handling

**Error Types & Messages:**

| Error | User Message | Action |
|-------|--------------|--------|
| Rate limit (all keys exhausted) | "Service is busy. Please try again in a moment." | Retry button |
| Invalid response from LLM | "Couldn't generate a valid sequence. Please try again." | Retry button |
| Network error | "Connection failed. Check your internet and try again." | Retry button |
| Validation error (user input) | Specific field error | Inline on field |

**Behavior:**
- Error replaces spinner in same dialog
- Form state preserved for retry
- After 3 failures: suggest simplifying goal or reducing email count
- Backend retries once automatically on JSON parse failure

## 7. Save Flow

When user clicks "Create" in preview:

1. `POST /api/sequences` with generated data (existing endpoint)
2. On success: close modal, navigate to `/sequences/:id`
3. On error: toast "Failed to create sequence" with retry

User lands in editor to refine content before activating.

## Future Enhancements

- **#49**: Regenerate option in preview modal
- **#50**: Streaming preview during generation

## Files to Create/Modify

**New:**
- `server/src/services/gemini.ts` - Gemini API client

**Modify:**
- `server/src/routes/sequences.ts` - Add generate endpoint
- `server/src/lib/validation.ts` - Add generate request schema
- `frontend/src/pages/Sequences.tsx` - Add generate dialog and preview modal
- `frontend/src/lib/api.ts` - Add generate API function and types
