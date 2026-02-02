# Dark Mode Emails Design

## Overview

Add support for dark mode in email templates. Emails will automatically adapt to recipients' dark mode preferences using CSS media queries.

## How Email Dark Mode Works

Email clients that support dark mode use `@media (prefers-color-scheme: dark)` CSS queries. We need to:

1. Add dark mode CSS styles to the email template
2. Use MSO conditional comments for Outlook compatibility
3. Provide fallback colors for non-supporting clients

## Supported Email Clients

**Full support:** Apple Mail, iOS Mail, Outlook.com, Gmail (Android/iOS)
**Partial support:** Gmail (web), Outlook 2019+
**No support:** Older Outlook versions, some webmail

## Implementation

### 1. Update Template Compiler

Add dark mode CSS to the `<head>` section of compiled emails:

```css
@media (prefers-color-scheme: dark) {
  body, .email-body { background-color: #1a1a1a !important; }
  .email-content { background-color: #2d2d2d !important; }
  p, h1, h2, h3, h4, .text-content { color: #ffffff !important; }
  .footer-text { color: #888888 !important; }
}
```

### 2. Add Dark Mode Toggle in Editor

- Add "Dark Mode Preview" toggle button
- Show how email looks in dark mode

### 3. Block-Level Dark Colors (Optional Enhancement)

Allow users to specify dark mode colors per block:
- Header: darkBackgroundColor
- Text: darkTextColor
- Button: darkBackgroundColor, darkTextColor

## Files to Modify

- `server/src/services/template-compiler.ts` - Add dark mode CSS
- `frontend/src/pages/Templates.tsx` - Add dark mode preview toggle
- `frontend/src/pages/Campaigns.tsx` - Add dark mode preview toggle

## CSS Strategy

Use `!important` to override email client forced dark mode changes.
Use color-scheme meta tag for better client hints.

```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
```
