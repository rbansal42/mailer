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

// Get full saved config (for sending - includes password)
app.get('/api/config/full', (req, res) => {
  const configPath = path.join(__dirname, 'config.json');

  if (!fs.existsSync(configPath)) {
    return res.json({});
  }

  try {
    const encrypted = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const result = {
      email: decrypt(encrypted.email),
      password: decrypt(encrypted.password)
    };
    if (encrypted.geminiKey) {
      result.geminiKey = decrypt(encrypted.geminiKey);
    }
    res.json(result);
  } catch (e) {
    res.json({});
  }
});

// Save config
app.post('/api/save-config', (req, res) => {
  const { email, password, geminiKey } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const configPath = path.join(__dirname, 'config.json');
  const encrypted = {
    email: encrypt(email),
    password: encrypt(password)
  };

  if (geminiKey) {
    encrypted.geminiKey = encrypt(geminiKey);
  }

  fs.writeFileSync(configPath, JSON.stringify(encrypted, null, 2));
  res.json({ success: true });
});

// Format content with Gemini AI
app.post('/api/format', async (req, res) => {
  const { content, geminiKey } = req.body;

  if (!content || !geminiKey) {
    return res.status(400).json({ error: 'Content and Gemini API key required' });
  }

  const prompt = `Convert this email content into clean HTML for an email template.
Rules:
- Wrap paragraphs in <p> tags
- Replace any placeholder like [Name], [name], {name}, or similar with {{name}} (lowercase, double curly braces)
- Replace any placeholder like [Company], {company}, etc with {{company}}
- Keep the same tone and content, just format it as HTML
- Do NOT add any styling, classes, or extra HTML structure
- Do NOT include DOCTYPE, html, head, or body tags
- Only output the HTML content, nothing else
- Preserve any existing {{variables}} as-is

Content to format:
${content}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(400).json({ error: err.error?.message || 'Gemini API error' });
    }

    const data = await response.json();
    let formatted = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Clean up any markdown code blocks if present
    formatted = formatted.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();

    res.json({ formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
