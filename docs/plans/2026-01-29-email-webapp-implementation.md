# Email Webapp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-page webapp for bulk email sending with HTML templates and mail merge via Gmail.

**Architecture:** Express.js backend serves static frontend and handles email sending via Nodemailer. Frontend is vanilla HTML/CSS/JS with template selection, content editing, recipient parsing, and progress display. Credentials optionally saved encrypted on server.

**Tech Stack:** Node.js, Express.js, Nodemailer, Vanilla HTML/CSS/JS, crypto (AES-256 for credential encryption)

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `server.js`
- Create: `.gitignore`

**Step 1: Initialize package.json**

```json
{
  "name": "mailer",
  "version": "1.0.0",
  "description": "Bulk email sender with HTML templates and mail merge",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "nodemailer": "^6.9.7"
  }
}
```

**Step 2: Create .gitignore**

```
node_modules/
config.json
.env
.DS_Store
```

**Step 3: Create minimal server.js**

```javascript
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

**Step 4: Install dependencies**

Run: `npm install`
Expected: node_modules created, package-lock.json generated

**Step 5: Test server starts**

Run: `npm start` (then Ctrl+C to stop)
Expected: "Server running at http://localhost:3000"

**Step 6: Commit**

```bash
git add package.json package-lock.json server.js .gitignore
git commit -m "feat: initialize project with Express server"
```

---

## Task 2: Email Templates

**Files:**
- Create: `templates/simple.html`
- Create: `templates/newsletter.html`
- Create: `templates/professional.html`
- Create: `templates/outreach.html`

**Step 1: Create simple.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div class="content" data-editable="true">
    <p>Hello {{name}},</p>
    <p>Your message content goes here.</p>
    <p>Best regards</p>
  </div>
</body>
</html>
```

**Step 2: Create newsletter.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #4A90A4; color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;" data-editable="true">Newsletter Title</h1>
    </div>
    <div style="padding: 30px;" class="content" data-editable="true">
      <p>Hello {{name}},</p>
      <p>Your newsletter content goes here.</p>
      <h2>Section Heading</h2>
      <p>More content for your newsletter.</p>
    </div>
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 0;" data-editable="true">You received this email because you subscribed to our newsletter.</p>
    </div>
  </div>
</body>
</html>
```

**Step 3: Create professional.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #4A90A4; padding-bottom: 15px; margin-bottom: 25px;">
    <div style="font-size: 20px; font-weight: bold; color: #4A90A4;" data-editable="true">Company Name</div>
  </div>
  <div class="content" data-editable="true">
    <p>Dear {{name}},</p>
    <p>Your professional message content goes here.</p>
    <p>Please let us know if you have any questions.</p>
  </div>
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
    <p style="margin: 0;" data-editable="true">Best regards,</p>
    <p style="margin: 5px 0; font-weight: bold;" data-editable="true">{{senderName}}</p>
    <p style="margin: 0; color: #666; font-size: 14px;" data-editable="true">{{senderTitle}}</p>
  </div>
</body>
</html>
```

**Step 4: Create outreach.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div class="content" data-editable="true">
    <p>Dear {{name}},</p>
    <p>I hope this email finds you well.</p>
    <p>Your outreach message content goes here. This template is designed for warm, personal follow-ups and check-ins.</p>
    <p>If your circumstances have changed or you no longer require our services, we completely understand—no response is needed.</p>
    <p>Thank you for reaching out to us.</p>
  </div>
  <div style="margin-top: 25px;">
    <p style="margin: 0;">Take care,</p>
    <p style="margin: 10px 0 5px 0; font-weight: bold;" data-editable="true">{{senderName}}</p>
    <p style="margin: 0; font-style: italic; color: #666;" data-editable="true">{{tagline}}</p>
  </div>
</body>
</html>
```

**Step 5: Commit**

```bash
git add templates/
git commit -m "feat: add email templates (simple, newsletter, professional, outreach)"
```

---

## Task 3: Frontend HTML Structure

**Files:**
- Create: `public/index.html`

**Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mailer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>Mailer</h1>
    <button id="configBtn" class="config-btn">Gmail Config</button>
  </header>

  <main>
    <!-- Section 1: Template Selection -->
    <section class="section">
      <h2>1. Choose Template</h2>
      <div class="template-grid" id="templateGrid">
        <button class="template-card active" data-template="simple">
          <div class="template-preview simple-preview"></div>
          <span>Simple</span>
        </button>
        <button class="template-card" data-template="newsletter">
          <div class="template-preview newsletter-preview"></div>
          <span>Newsletter</span>
        </button>
        <button class="template-card" data-template="professional">
          <div class="template-preview professional-preview"></div>
          <span>Professional</span>
        </button>
        <button class="template-card" data-template="outreach">
          <div class="template-preview outreach-preview"></div>
          <span>Outreach</span>
        </button>
      </div>
    </section>

    <!-- Section 2: Compose -->
    <section class="section">
      <h2>2. Compose Email</h2>
      <div class="subject-row">
        <label for="subject">Subject:</label>
        <input type="text" id="subject" placeholder="Hello {{name}}, welcome!">
      </div>
      <div class="compose-grid">
        <div class="editor-pane">
          <label>Content</label>
          <textarea id="editor" placeholder="Edit your email content here..."></textarea>
        </div>
        <div class="preview-pane">
          <label>Preview</label>
          <iframe id="preview" title="Email preview"></iframe>
        </div>
      </div>
    </section>

    <!-- Section 3: Recipients -->
    <section class="section">
      <h2>3. Recipients</h2>
      <div class="recipients-input">
        <div class="input-header">
          <span>Paste from Excel or CSV (first row = headers, must include "email" column)</span>
          <label class="file-upload">
            <input type="file" id="csvFile" accept=".csv,.txt">
            Upload CSV
          </label>
        </div>
        <textarea id="recipientsData" placeholder="name&#9;email&#9;company&#10;John&#9;john@example.com&#9;Acme&#10;Sarah&#9;sarah@test.com&#9;Beta"></textarea>
      </div>
      <div class="recipients-info">
        <div id="detectedVars">Detected variables: <span class="vars-list">—</span></div>
        <div id="recipientCount">Recipients: <span>0</span></div>
      </div>
      <div class="cc-row">
        <label for="globalCc">Global CC:</label>
        <input type="text" id="globalCc" placeholder="cc@example.com (optional)">
      </div>
    </section>

    <!-- Section 4: Send -->
    <section class="section">
      <h2>4. Send</h2>
      <div id="validationErrors" class="validation-errors"></div>
      <div id="progressContainer" class="progress-container" style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="progress-text" id="progressText">0/0 sent</div>
        <div class="progress-log" id="progressLog"></div>
      </div>
      <div id="resultsContainer" class="results-container" style="display: none;"></div>
      <div class="send-actions">
        <button id="sendBtn" class="send-btn" disabled>Send Emails</button>
        <button id="cancelBtn" class="cancel-btn" style="display: none;">Cancel</button>
      </div>
    </section>
  </main>

  <!-- Gmail Config Modal -->
  <div id="configModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Gmail Configuration</h3>
        <button class="close-btn" id="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="gmailEmail">Gmail Address:</label>
          <input type="email" id="gmailEmail" placeholder="your.email@gmail.com">
        </div>
        <div class="form-group">
          <label for="gmailPassword">App Password:</label>
          <input type="password" id="gmailPassword" placeholder="xxxx xxxx xxxx xxxx">
        </div>
        <div class="form-group checkbox">
          <label>
            <input type="checkbox" id="rememberCreds">
            Remember credentials
          </label>
        </div>
        <div class="form-info">
          <p>Requires a Gmail App Password (not your regular password).</p>
          <a href="https://myaccount.google.com/apppasswords" target="_blank">Create App Password →</a>
        </div>
      </div>
      <div class="modal-footer">
        <button id="saveConfig" class="save-btn">Save</button>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: add frontend HTML structure"
```

---

## Task 4: Frontend CSS

**Files:**
- Create: `public/style.css`

**Step 1: Create style.css**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
  line-height: 1.5;
}

header {
  background: #fff;
  padding: 15px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 100;
}

header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #4A90A4;
}

.config-btn {
  background: #4A90A4;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.config-btn:hover {
  background: #3d7a8c;
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.section h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: #333;
}

/* Template Grid */
.template-grid {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.template-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s;
  width: 120px;
  text-align: center;
}

.template-card:hover {
  border-color: #4A90A4;
}

.template-card.active {
  border-color: #4A90A4;
  background: #f0f7fa;
}

.template-preview {
  height: 60px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 8px;
}

.simple-preview {
  background: linear-gradient(#f5f5f5 20%, #e0e0e0 20%, #e0e0e0 25%, #f5f5f5 25%);
}

.newsletter-preview {
  background: linear-gradient(#4A90A4 30%, #f5f5f5 30%);
}

.professional-preview {
  background: linear-gradient(#f5f5f5 15%, #4A90A4 15%, #4A90A4 18%, #f5f5f5 18%);
}

.outreach-preview {
  background: linear-gradient(#f5f5f5 70%, #e8e8e8 70%);
}

.template-card span {
  font-size: 0.85rem;
  color: #666;
}

/* Compose Section */
.subject-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.subject-row label {
  font-weight: 500;
  white-space: nowrap;
}

.subject-row input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
}

.compose-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  min-height: 350px;
}

.editor-pane, .preview-pane {
  display: flex;
  flex-direction: column;
}

.editor-pane label, .preview-pane label {
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #666;
}

#editor {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.95rem;
  resize: none;
  line-height: 1.6;
}

#preview {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
}

/* Recipients Section */
.recipients-input {
  margin-bottom: 15px;
}

.input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.85rem;
  color: #666;
}

.file-upload {
  background: #f5f5f5;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.file-upload:hover {
  background: #e8e8e8;
}

.file-upload input {
  display: none;
}

#recipientsData {
  width: 100%;
  height: 120px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.85rem;
  resize: vertical;
}

.recipients-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 15px;
}

.vars-list {
  color: #4A90A4;
  font-weight: 500;
}

.cc-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cc-row label {
  font-weight: 500;
  white-space: nowrap;
}

.cc-row input {
  flex: 1;
  max-width: 300px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
}

/* Send Section */
.validation-errors {
  color: #d32f2f;
  font-size: 0.9rem;
  margin-bottom: 15px;
}

.validation-errors:empty {
  display: none;
}

.progress-container {
  margin-bottom: 20px;
}

.progress-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: #4A90A4;
  width: 0%;
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 10px;
}

.progress-log {
  max-height: 150px;
  overflow-y: auto;
  font-size: 0.85rem;
  font-family: 'Monaco', 'Menlo', monospace;
}

.progress-log .success {
  color: #2e7d32;
}

.progress-log .error {
  color: #d32f2f;
}

.progress-log .pending {
  color: #666;
}

.results-container {
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
}

.results-container.success {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
}

.results-container.has-errors {
  background: #fff3e0;
  border: 1px solid #ffcc80;
}

.send-actions {
  display: flex;
  gap: 10px;
}

.send-btn {
  background: #4A90A4;
  color: white;
  border: none;
  padding: 12px 30px;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #3d7a8c;
}

.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #e8e8e8;
}

/* Modal */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  justify-content: center;
  align-items: center;
}

.modal.open {
  display: flex;
}

.modal-content {
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  line-height: 1;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  font-size: 0.9rem;
}

.form-group input[type="email"],
.form-group input[type="password"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
}

.form-group.checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.form-info {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #666;
}

.form-info a {
  color: #4A90A4;
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #e0e0e0;
  text-align: right;
}

.save-btn {
  background: #4A90A4;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
}

.save-btn:hover {
  background: #3d7a8c;
}

/* Responsive */
@media (max-width: 768px) {
  .compose-grid {
    grid-template-columns: 1fr;
  }

  .template-grid {
    justify-content: center;
  }

  .recipients-info {
    flex-direction: column;
    gap: 5px;
  }
}
```

**Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat: add frontend CSS styles"
```

---

## Task 5: Frontend JavaScript - Core Setup

**Files:**
- Create: `public/app.js`

**Step 1: Create app.js with initial structure and template loading**

```javascript
// State
const state = {
  currentTemplate: 'simple',
  templates: {},
  credentials: { email: '', password: '', remember: false },
  recipients: [],
  variables: [],
  sending: false,
  abortController: null
};

// DOM Elements
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadTemplates();
  loadSavedConfig();
  setupEventListeners();
  updatePreview();
  validateForm();
}

// Load email templates from server
async function loadTemplates() {
  const templateNames = ['simple', 'newsletter', 'professional', 'outreach'];

  for (const name of templateNames) {
    try {
      const res = await fetch(`/templates/${name}.html`);
      if (res.ok) {
        state.templates[name] = await res.text();
      }
    } catch (e) {
      console.error(`Failed to load template: ${name}`, e);
    }
  }

  // Set initial editor content
  if (state.templates[state.currentTemplate]) {
    $('#editor').value = extractEditableContent(state.templates[state.currentTemplate]);
  }
}

// Extract editable content from template HTML
function extractEditableContent(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const content = doc.querySelector('.content[data-editable="true"]');
  return content ? content.innerHTML.trim() : '';
}

// Load saved Gmail config
async function loadSavedConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.email) {
        state.credentials.email = data.email;
        state.credentials.remember = true;
        $('#gmailEmail').value = data.email;
        $('#rememberCreds').checked = true;
      }
    }
  } catch (e) {
    // No saved config, that's fine
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Template selection
  $$('.template-card').forEach(card => {
    card.addEventListener('click', () => selectTemplate(card.dataset.template));
  });

  // Editor changes
  $('#editor').addEventListener('input', () => {
    updatePreview();
    validateForm();
  });

  // Subject changes
  $('#subject').addEventListener('input', validateForm);

  // Recipients changes
  $('#recipientsData').addEventListener('input', () => {
    parseRecipients();
    validateForm();
  });

  // CSV file upload
  $('#csvFile').addEventListener('change', handleFileUpload);

  // Modal
  $('#configBtn').addEventListener('click', () => $('#configModal').classList.add('open'));
  $('#closeModal').addEventListener('click', () => $('#configModal').classList.remove('open'));
  $('#configModal').addEventListener('click', (e) => {
    if (e.target === $('#configModal')) $('#configModal').classList.remove('open');
  });

  // Save config
  $('#saveConfig').addEventListener('click', saveConfig);

  // Send
  $('#sendBtn').addEventListener('click', sendEmails);
  $('#cancelBtn').addEventListener('click', cancelSending);
}

// Select template
function selectTemplate(name) {
  state.currentTemplate = name;

  $$('.template-card').forEach(card => {
    card.classList.toggle('active', card.dataset.template === name);
  });

  if (state.templates[name]) {
    $('#editor').value = extractEditableContent(state.templates[name]);
    updatePreview();
  }
}

// Update live preview
function updatePreview() {
  const template = state.templates[state.currentTemplate];
  if (!template) return;

  const content = $('#editor').value;
  let html = template;

  // Replace editable content
  const parser = new DOMParser();
  const doc = parser.parseFromString(template, 'text/html');
  const editableContent = doc.querySelector('.content[data-editable="true"]');
  if (editableContent) {
    editableContent.innerHTML = content;
    html = doc.documentElement.outerHTML;
  }

  // Replace variables with sample data
  const sampleData = state.recipients[0] || { name: 'John', email: 'john@example.com' };
  html = replaceVariables(html, sampleData);

  const preview = $('#preview');
  preview.srcdoc = html;
}

// Replace {{variables}} in text
function replaceVariables(text, data) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : '';
  });
}

// Parse recipients from textarea
function parseRecipients() {
  const text = $('#recipientsData').value.trim();
  if (!text) {
    state.recipients = [];
    state.variables = [];
    updateRecipientsInfo();
    return;
  }

  // Auto-detect delimiter (tab or comma)
  const firstLine = text.split('\n')[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    state.recipients = [];
    state.variables = [];
    updateRecipientsInfo();
    return;
  }

  // Parse headers
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
  state.variables = headers;

  // Parse data rows
  state.recipients = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());
    const recipient = {};
    headers.forEach((header, idx) => {
      recipient[header] = values[idx] || '';
    });
    if (recipient.email) {
      state.recipients.push(recipient);
    }
  }

  updateRecipientsInfo();
  updatePreview();
}

// Update recipients info display
function updateRecipientsInfo() {
  const varsDisplay = state.variables.length > 0
    ? state.variables.map(v => `{{${v}}}`).join(' ')
    : '—';
  $('#detectedVars .vars-list').textContent = varsDisplay;
  $('#recipientCount span').textContent = state.recipients.length;
}

// Handle CSV file upload
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    $('#recipientsData').value = event.target.result;
    parseRecipients();
    validateForm();
  };
  reader.readAsText(file);
}

// Validate form and update send button
function validateForm() {
  const errors = [];

  if (!state.credentials.email || !state.credentials.password) {
    errors.push('Gmail credentials not configured');
  }

  if (!$('#subject').value.trim()) {
    errors.push('Subject line is empty');
  }

  if (!$('#editor').value.trim()) {
    errors.push('Email content is empty');
  }

  if (state.recipients.length === 0) {
    errors.push('No recipients added');
  }

  if (state.recipients.length > 0 && !state.variables.includes('email')) {
    errors.push('Recipients data must include "email" column');
  }

  $('#validationErrors').innerHTML = errors.map(e => `• ${e}`).join('<br>');
  $('#sendBtn').disabled = errors.length > 0 || state.sending;
}

// Save Gmail config
async function saveConfig() {
  state.credentials.email = $('#gmailEmail').value.trim();
  state.credentials.password = $('#gmailPassword').value;
  state.credentials.remember = $('#rememberCreds').checked;

  if (state.credentials.remember && state.credentials.email && state.credentials.password) {
    try {
      await fetch('/api/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: state.credentials.email,
          password: state.credentials.password
        })
      });
    } catch (e) {
      console.error('Failed to save config', e);
    }
  }

  $('#configModal').classList.remove('open');
  validateForm();
}

// Send emails
async function sendEmails() {
  if (state.sending) return;

  state.sending = true;
  state.abortController = new AbortController();

  $('#sendBtn').disabled = true;
  $('#cancelBtn').style.display = 'inline-block';
  $('#progressContainer').style.display = 'block';
  $('#resultsContainer').style.display = 'none';
  $('#progressLog').innerHTML = '';
  $('#progressFill').style.width = '0%';

  const template = state.templates[state.currentTemplate];
  const content = $('#editor').value;

  // Build full HTML by inserting content into template
  const parser = new DOMParser();
  const doc = parser.parseFromString(template, 'text/html');
  const editableContent = doc.querySelector('.content[data-editable="true"]');
  if (editableContent) {
    editableContent.innerHTML = content;
  }
  const html = doc.documentElement.outerHTML;

  try {
    const response = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentials: {
          email: state.credentials.email,
          appPassword: state.credentials.password
        },
        subject: $('#subject').value,
        html: html,
        recipients: state.recipients,
        globalCc: $('#globalCc').value.trim() || null
      }),
      signal: state.abortController.signal
    });

    // Handle SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          handleProgress(data);
        }
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Send failed', e);
      showResults({ sent: 0, failed: state.recipients.length, errors: [{ email: 'all', reason: e.message }] });
    }
  }

  state.sending = false;
  state.abortController = null;
  $('#sendBtn').disabled = false;
  $('#cancelBtn').style.display = 'none';
}

// Handle progress updates from SSE
function handleProgress(data) {
  const total = state.recipients.length;

  switch (data.type) {
    case 'progress':
      const percent = (data.sent / total) * 100;
      $('#progressFill').style.width = `${percent}%`;
      $('#progressText').textContent = `${data.sent}/${total} sent`;
      break;

    case 'success':
      $('#progressLog').innerHTML += `<div class="success">✓ ${data.email}</div>`;
      $('#progressLog').scrollTop = $('#progressLog').scrollHeight;
      break;

    case 'error':
      $('#progressLog').innerHTML += `<div class="error">✗ ${data.email} - ${data.reason}</div>`;
      $('#progressLog').scrollTop = $('#progressLog').scrollHeight;
      break;

    case 'complete':
      showResults(data);
      break;
  }
}

// Show final results
function showResults(data) {
  const container = $('#resultsContainer');
  container.style.display = 'block';

  const hasErrors = data.failed > 0;
  container.className = `results-container ${hasErrors ? 'has-errors' : 'success'}`;

  let html = `<strong>${hasErrors ? '⚠️' : '✅'} Complete!</strong><br>`;
  html += `Sent: ${data.sent}<br>`;
  html += `Failed: ${data.failed}`;

  if (hasErrors && data.errors && data.errors.length > 0) {
    html += '<br><br><strong>Failed recipients:</strong><ul style="margin: 5px 0 0 20px;">';
    data.errors.forEach(err => {
      html += `<li>${err.email} - ${err.reason}</li>`;
    });
    html += '</ul>';
  }

  container.innerHTML = html;
}

// Cancel sending
function cancelSending() {
  if (state.abortController) {
    state.abortController.abort();
  }
}
```

**Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: add frontend JavaScript application logic"
```

---

## Task 6: Backend API - Send Endpoint

**Files:**
- Modify: `server.js`

**Step 1: Add template serving and send endpoint to server.js**

Replace the contents of `server.js`:

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Encryption key (in production, use environment variable)
const ENCRYPTION_KEY = crypto.scryptSync('mailer-secret-key', 'salt', 32);
const IV_LENGTH = 16;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve templates
app.use('/templates', express.static(path.join(__dirname, 'templates')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get saved config (email only, not password)
app.get('/api/config', (req, res) => {
  const configPath = path.join(__dirname, 'config.json');

  if (!fs.existsSync(configPath)) {
    return res.json({});
  }

  try {
    const encrypted = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const email = decrypt(encrypted.email);
    res.json({ email });
  } catch (e) {
    res.json({});
  }
});

// Save config
app.post('/api/save-config', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const configPath = path.join(__dirname, 'config.json');
  const encrypted = {
    email: encrypt(email),
    password: encrypt(password)
  };

  fs.writeFileSync(configPath, JSON.stringify(encrypted, null, 2));
  res.json({ success: true });
});

// Send emails (SSE)
app.post('/api/send', async (req, res) => {
  const { credentials, subject, html, recipients, globalCc } = req.body;

  // Validate
  if (!credentials?.email || !credentials?.appPassword) {
    return res.status(400).json({ error: 'Gmail credentials required' });
  }

  if (!subject || !html || !recipients?.length) {
    return res.status(400).json({ error: 'Subject, HTML, and recipients required' });
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: credentials.email,
      pass: credentials.appPassword
    }
  });

  let sent = 0;
  let failed = 0;
  const errors = [];

  // Send to each recipient
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    // Validate email format
    if (!isValidEmail(recipient.email)) {
      failed++;
      errors.push({ email: recipient.email, reason: 'Invalid email format' });
      res.write(`data: ${JSON.stringify({ type: 'error', email: recipient.email, reason: 'Invalid email format' })}\n\n`);
      continue;
    }

    // Replace variables in subject and HTML
    const personalizedSubject = replaceVariables(subject, recipient);
    const personalizedHtml = replaceVariables(html, recipient);

    // Build mail options
    const mailOptions = {
      from: credentials.email,
      to: recipient.email,
      subject: personalizedSubject,
      html: personalizedHtml
    };

    if (globalCc) {
      mailOptions.cc = globalCc;
    }

    // Send with retry
    let success = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await transporter.sendMail(mailOptions);
        success = true;
        break;
      } catch (e) {
        if (attempt === 1) {
          // Second attempt failed
          failed++;
          errors.push({ email: recipient.email, reason: e.message });
          res.write(`data: ${JSON.stringify({ type: 'error', email: recipient.email, reason: e.message })}\n\n`);
        }
      }
    }

    if (success) {
      sent++;
      res.write(`data: ${JSON.stringify({ type: 'success', email: recipient.email })}\n\n`);
    }

    // Progress update
    res.write(`data: ${JSON.stringify({ type: 'progress', sent, failed, total: recipients.length })}\n\n`);

    // Rate limiting delay
    if (i < recipients.length - 1) {
      await sleep(300);
    }
  }

  // Complete
  res.write(`data: ${JSON.stringify({ type: 'complete', sent, failed, errors })}\n\n`);
  res.end();
});

// Helpers
function replaceVariables(text, data) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key.toLowerCase()] !== undefined ? data[key.toLowerCase()] : '';
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

**Step 2: Commit**

```bash
git add server.js
git commit -m "feat: add backend API with email sending and config endpoints"
```

---

## Task 7: Load Saved Password for Sending

**Files:**
- Modify: `server.js`

**Step 1: Add endpoint to get saved password for sending**

Add this endpoint after the `/api/config` GET endpoint in `server.js`:

```javascript
// Get full saved config (for sending - includes password)
app.get('/api/config/full', (req, res) => {
  const configPath = path.join(__dirname, 'config.json');

  if (!fs.existsSync(configPath)) {
    return res.json({});
  }

  try {
    const encrypted = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json({
      email: decrypt(encrypted.email),
      password: decrypt(encrypted.password)
    });
  } catch (e) {
    res.json({});
  }
});
```

**Step 2: Update app.js to load full config when remembered**

In `public/app.js`, update the `loadSavedConfig` function:

```javascript
// Load saved Gmail config
async function loadSavedConfig() {
  try {
    const res = await fetch('/api/config/full');
    if (res.ok) {
      const data = await res.json();
      if (data.email && data.password) {
        state.credentials.email = data.email;
        state.credentials.password = data.password;
        state.credentials.remember = true;
        $('#gmailEmail').value = data.email;
        $('#gmailPassword').value = '••••••••••••••••';
        $('#rememberCreds').checked = true;
      }
    }
  } catch (e) {
    // No saved config, that's fine
  }
}
```

**Step 3: Commit**

```bash
git add server.js public/app.js
git commit -m "feat: load saved credentials for sending"
```

---

## Task 8: Final Testing

**Step 1: Start the server**

Run: `npm start`
Expected: "Server running at http://localhost:3000"

**Step 2: Test in browser**

Open: http://localhost:3000

Verify:
- [ ] Templates load and can be switched
- [ ] Editor content updates preview
- [ ] Pasting tab-separated data detects variables
- [ ] Gmail config modal opens/closes
- [ ] Validation errors show when fields missing
- [ ] Send button enables when form is valid

**Step 3: Test with real Gmail (optional)**

- Configure Gmail App Password
- Add test recipients
- Send test emails
- Verify progress updates and completion

**Step 4: Final commit**

```bash
git add -A
git commit -m "docs: complete implementation"
```
