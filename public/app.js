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
