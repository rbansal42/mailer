# More Templates Implementation Plan

> **For Claude:** Use superpowers:dispatching-parallel-agents to implement each phase.

**Goal:** Add 5 certificate PDF templates and 16 email templates  
**Architecture:** Certificate templates are React components with @react-pdf/renderer; email templates are JSON block structures seeded to database  
**Tech Stack:** React, @react-pdf/renderer, TypeScript, Turso/libSQL

---

## Phase 1: Certificate PDF Templates

### Task 1.1: Academic/Formal Template (`academic-formal`)

**Files:**
- Create: `server/src/services/pdf/templates/academic-formal.tsx`
- Modify: `server/src/services/pdf/templates/index.ts`

**Implementation:**

```tsx
// academic-formal.tsx
import React from 'react'
import { View, Text, StyleSheet, Svg, Path } from '@react-pdf/renderer'
import { Certificate, LogoBar, Signatories } from '../components'
import { typography, getNameFontSize } from '../styles'

interface AcademicFormalProps {
  title: string
  subtitle?: string
  recipientName: string
  description: string
  logos?: Array<{ url: string; height?: number }>
  signatories?: Array<{
    name: string
    designation: string
    organization?: string
    signatureUrl?: string
  }>
  certificateId?: string
}

const colors = {
  primary: '#1a365d',
  secondary: '#4a5568',
  accent: '#b7791f',
  background: '#faf7f0',
  border: '#b7791f',
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 15,
  },
  outerBorder: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.border,
    padding: 8,
  },
  innerBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  logoSection: {
    marginBottom: 15,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlayfairDisplay',
    fontSize: 28,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  decorativeLine: {
    width: 200,
    height: 2,
    backgroundColor: colors.accent,
    marginVertical: 10,
  },
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  presentedTo: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: colors.secondary,
    textAlign: 'center',
    marginTop: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recipientName: {
    fontFamily: 'GreatVibes',
    color: colors.primary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  nameUnderline: {
    width: 250,
    height: 1,
    backgroundColor: colors.accent,
    marginBottom: 20,
  },
  description: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: colors.secondary,
    textAlign: 'center',
    maxWidth: '75%',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  signatoriesContainer: {
    marginTop: 'auto',
    paddingTop: 20,
  },
  sealPlaceholder: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
})

export const AcademicFormal: React.FC<AcademicFormalProps> = ({
  title,
  subtitle,
  recipientName,
  description,
  logos,
  signatories,
  certificateId,
}) => {
  const nameFontSize = getNameFontSize(recipientName)

  return (
    <Certificate certificateId={certificateId} backgroundColor={colors.background}>
      <View style={styles.container}>
        <View style={styles.outerBorder}>
          <View style={styles.innerBorder}>
            {logos && logos.length > 0 && (
              <View style={styles.logoSection}>
                <LogoBar logos={logos} />
              </View>
            )}

            <View style={styles.content}>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.decorativeLine} />
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

              <Text style={styles.presentedTo}>This is to certify that</Text>
              <Text style={[styles.recipientName, { fontSize: nameFontSize }]}>
                {recipientName}
              </Text>
              <View style={styles.nameUnderline} />

              <Text style={styles.description}>{description}</Text>

              {signatories && signatories.length > 0 && (
                <View style={styles.signatoriesContainer}>
                  <Signatories signatories={signatories} />
                </View>
              )}
            </View>

            <View style={styles.sealPlaceholder} />
          </View>
        </View>
      </View>
    </Certificate>
  )
}
```

**Index update:**
```typescript
export { AcademicFormal } from './academic-formal'

// Add to templates registry:
'academic-formal': 'AcademicFormal',
```

---

### Task 1.2: Corporate/Professional Template (`corporate-professional`)

**Files:**
- Create: `server/src/services/pdf/templates/corporate-professional.tsx`
- Modify: `server/src/services/pdf/templates/index.ts`

**Key elements:**
- 10px accent bar at top
- Clean sans-serif typography (Inter)
- Two-column signatory layout
- Minimal decorative elements

---

### Task 1.3: Creative/Artistic Template (`creative-artistic`)

**Files:**
- Create: `server/src/services/pdf/templates/creative-artistic.tsx`
- Modify: `server/src/services/pdf/templates/index.ts`

**Key elements:**
- Large abstract shape in corner (SVG blob)
- Bold mixed typography
- Purple/pink/amber color scheme
- Oversized recipient name

---

### Task 1.4: Tech/Digital Template (`tech-digital`)

**Files:**
- Create: `server/src/services/pdf/templates/tech-digital.tsx`
- Modify: `server/src/services/pdf/templates/index.ts`

**Key elements:**
- Dark background (`#0f172a`)
- Monospace certificate ID
- Code bracket decorations `{ }`
- Cyan/green accents
- Grid pattern background

---

### Task 1.5: Event/Achievement Template (`event-achievement`)

**Files:**
- Create: `server/src/services/pdf/templates/event-achievement.tsx`
- Modify: `server/src/services/pdf/templates/index.ts`

**Key elements:**
- Ribbon/badge SVG at top
- Star/laurel decorations
- Gold/bronze color scheme
- Bold achievement header

---

## Phase 2: Transactional + Re-engagement Emails

### Task 2.1: Order Confirmation (`order-confirmation`)

**File:** `server/src/db/index.ts` - add to `seedDefaultTemplates()`

**Blocks:**
```javascript
{
  name: 'Order Confirmation',
  description: 'Order summary with items, shipping address, and tracking',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Order Confirmed!' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Thank you for your order! We\'ve received it and are getting it ready.</p>' } },
    { id: '3', type: 'text', props: { content: '<h3>Order #{{order_number}}</h3><p><strong>Items:</strong></p><p>{{order_items}}</p><p><strong>Total:</strong> {{order_total}}</p>' } },
    { id: '4', type: 'divider', props: { style: 'solid' } },
    { id: '5', type: 'text', props: { content: '<p><strong>Shipping to:</strong></p><p>{{shipping_address}}</p>' } },
    { id: '6', type: 'button', props: { label: 'Track Order', url: '{{tracking_url}}', align: 'center' } },
    { id: '7', type: 'footer', props: { text: 'Questions about your order? Reply to this email.\n© 2026 {{company}}', showUnsubscribe: false } }
  ]
}
```

---

### Task 2.2: Shipping Update (`shipping-update`)

**Blocks:**
```javascript
{
  name: 'Shipping Update',
  description: 'Package shipped notification with tracking details',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Your Order is On Its Way!' } },
    { id: '2', type: 'text', props: { content: '<p>Great news, {{name}}!</p><p>Your order has shipped and is on its way to you.</p>' } },
    { id: '3', type: 'text', props: { content: '<p><strong>Tracking Number:</strong> {{tracking_number}}</p><p><strong>Carrier:</strong> {{carrier}}</p><p><strong>Estimated Delivery:</strong> {{delivery_date}}</p>' } },
    { id: '4', type: 'button', props: { label: 'Track Package', url: '{{tracking_url}}', align: 'center', backgroundColor: '#10b981' } },
    { id: '5', type: 'text', props: { content: '<p style="font-size: 13px; color: #666;">Order #{{order_number}}</p>' } },
    { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: false } }
  ]
}
```

---

### Task 2.3: Password Reset (`password-reset`)

**Blocks:**
```javascript
{
  name: 'Password Reset',
  description: 'Secure password reset request with single CTA',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Reset Your Password' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We received a request to reset your password. Click the button below to create a new password.</p>' } },
    { id: '3', type: 'button', props: { label: 'Reset Password', url: '{{reset_url}}', align: 'center', backgroundColor: '#dc2626' } },
    { id: '4', type: 'text', props: { content: '<p style="font-size: 13px; color: #666;">This link will expire in 24 hours.</p><p style="font-size: 13px; color: #666;">If you didn\'t request this, you can safely ignore this email. Your password won\'t be changed.</p>' } },
    { id: '5', type: 'footer', props: { text: 'For security, this request was received from {{ip_address}}.\n© 2026 {{company}}', showUnsubscribe: false } }
  ]
}
```

---

### Task 2.4: Receipt/Invoice (`receipt-invoice`)

**Blocks:**
```javascript
{
  name: 'Receipt',
  description: 'Payment receipt with itemized breakdown',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Payment Receipt' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Thank you for your payment. Here\'s your receipt:</p>' } },
    { id: '3', type: 'text', props: { content: '<p><strong>Invoice #:</strong> {{invoice_number}}<br><strong>Date:</strong> {{date}}</p>' } },
    { id: '4', type: 'divider', props: { style: 'solid' } },
    { id: '5', type: 'text', props: { content: '<p>{{line_items}}</p><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 10px 0;"><p><strong>Subtotal:</strong> {{subtotal}}<br><strong>Tax:</strong> {{tax}}<br><strong style="font-size: 16px;">Total:</strong> <strong style="font-size: 16px;">{{total}}</strong></p>' } },
    { id: '6', type: 'text', props: { content: '<p style="font-size: 13px; color: #666;"><strong>Payment Method:</strong> {{payment_method}}</p>' } },
    { id: '7', type: 'footer', props: { text: 'Keep this email for your records.\n© 2026 {{company}}', showUnsubscribe: false } }
  ]
}
```

---

### Task 2.5: We Miss You (`win-back-miss-you`)

**Blocks:**
```javascript
{
  name: 'We Miss You',
  description: 'Friendly re-engagement for inactive users',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'We Miss You!' } },
    { id: '2', type: 'text', props: { content: '<p style="text-align: center; font-size: 40px;">👋</p><p>Hi {{name}},</p><p>It\'s been a while since we\'ve seen you! We wanted to check in and let you know we\'ve been making some improvements.</p>' } },
    { id: '3', type: 'text', props: { content: '<p><strong>Here\'s what you\'re missing:</strong></p><ul><li>New features to save you time</li><li>Improved performance</li><li>Updated designs</li></ul>' } },
    { id: '4', type: 'button', props: { label: 'Come Back and Explore', url: '{{app_url}}', align: 'center' } },
    { id: '5', type: 'footer', props: { text: 'We\'d love to have you back.\n© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 2.6: Inactive Warning (`inactive-warning`)

**Blocks:**
```javascript
{
  name: 'Account Inactive Warning',
  description: 'Warning before account deactivation',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Action Required', backgroundColor: '#f59e0b' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We noticed your account has been inactive for a while. To keep your account secure, <strong>we\'ll deactivate it on {{deactivation_date}}</strong> unless you sign in.</p>' } },
    { id: '3', type: 'text', props: { content: '<p><strong>What happens if deactivated:</strong></p><ul><li>Your data will be archived</li><li>You\'ll need to contact support to reactivate</li></ul>' } },
    { id: '4', type: 'button', props: { label: 'Keep My Account Active', url: '{{login_url}}', align: 'center', backgroundColor: '#f59e0b' } },
    { id: '5', type: 'text', props: { content: '<p style="font-size: 13px;">Want to download your data first? <a href="{{export_url}}">Export my data</a></p>' } },
    { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 2.7: Win-back Offer (`win-back-offer`)

**Blocks:**
```javascript
{
  name: 'Special Win-back Offer',
  description: 'Promotional discount to re-engage inactive users',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'A Gift For You' } },
    { id: '2', type: 'text', props: { content: '<h2 style="text-align: center; color: #7c3aed;">Welcome Back!</h2><p style="text-align: center;">Here\'s <strong>20% off</strong> to celebrate your return</p>' } },
    { id: '3', type: 'text', props: { content: '<p style="text-align: center; font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 15px; border-radius: 8px;">{{promo_code}}</p>' } },
    { id: '4', type: 'button', props: { label: 'Shop Now', url: '{{shop_url}}', align: 'center', backgroundColor: '#7c3aed' } },
    { id: '5', type: 'text', props: { content: '<p style="text-align: center; font-size: 13px; color: #666;">Offer expires {{expiry_date}}. Terms apply.</p>' } },
    { id: '6', type: 'text', props: { content: '<p><strong>What\'s new since you\'ve been away:</strong></p><ul><li>{{new_feature_1}}</li><li>{{new_feature_2}}</li></ul>' } },
    { id: '7', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

## Phase 3: Survey + Onboarding Emails

### Task 3.1: Feedback Request (`feedback-request`)

**Blocks:**
```javascript
{
  name: 'Feedback Request',
  description: 'Simple feedback collection with rating',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'How Did We Do?' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We\'d love to hear about your recent experience with {{product_or_service}}.</p>' } },
    { id: '3', type: 'text', props: { content: '<p style="text-align: center; font-size: 18px;">How would you rate your experience?</p><p style="text-align: center; font-size: 30px;"><a href="{{rating_url_1}}">⭐</a> <a href="{{rating_url_2}}">⭐⭐</a> <a href="{{rating_url_3}}">⭐⭐⭐</a> <a href="{{rating_url_4}}">⭐⭐⭐⭐</a> <a href="{{rating_url_5}}">⭐⭐⭐⭐⭐</a></p>' } },
    { id: '4', type: 'button', props: { label: 'Share Detailed Feedback', url: '{{feedback_url}}', align: 'center' } },
    { id: '5', type: 'footer', props: { text: 'Your feedback helps us improve.\n© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 3.2: NPS Survey (`nps-survey`)

**Blocks:**
```javascript
{
  name: 'NPS Survey',
  description: 'Net Promoter Score survey with 0-10 scale',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Quick Question' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>On a scale of 0-10, <strong>how likely are you to recommend us to a friend or colleague?</strong></p>' } },
    { id: '3', type: 'text', props: { content: '<table style="width: 100%; text-align: center;"><tr><td><a href="{{nps_url_0}}">0</a></td><td><a href="{{nps_url_1}}">1</a></td><td><a href="{{nps_url_2}}">2</a></td><td><a href="{{nps_url_3}}">3</a></td><td><a href="{{nps_url_4}}">4</a></td><td><a href="{{nps_url_5}}">5</a></td><td><a href="{{nps_url_6}}">6</a></td><td><a href="{{nps_url_7}}">7</a></td><td><a href="{{nps_url_8}}">8</a></td><td><a href="{{nps_url_9}}">9</a></td><td><a href="{{nps_url_10}}">10</a></td></tr><tr><td colspan="4" style="font-size: 11px; color: #666;">Not likely</td><td colspan="3"></td><td colspan="4" style="font-size: 11px; color: #666;">Very likely</td></tr></table>' } },
    { id: '4', type: 'text', props: { content: '<p style="text-align: center; font-size: 13px; color: #666;">Click a number above to submit your rating</p>' } },
    { id: '5', type: 'footer', props: { text: 'This survey takes less than 30 seconds.\n© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 3.3: Review Request (`review-request`)

**Blocks:**
```javascript
{
  name: 'Review Request',
  description: 'Request for product or service review',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Enjoying {{product}}?' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We hope you\'re loving {{product}}! Would you mind taking a moment to share your experience?</p>' } },
    { id: '3', type: 'text', props: { content: '<p style="text-align: center; background: #f3f4f6; padding: 15px; border-radius: 8px;">Your review helps others discover what they\'re looking for and helps us continue improving.</p>' } },
    { id: '4', type: 'button', props: { label: 'Leave a Review', url: '{{review_url}}', align: 'center' } },
    { id: '5', type: 'text', props: { content: '<p style="text-align: center; font-size: 13px; color: #666;">Join {{review_count}}+ happy customers who\'ve shared their experience</p>' } },
    { id: '6', type: 'footer', props: { text: 'Thank you for being a valued customer.\n© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 3.4: Onboarding Welcome Day 1 (`onboarding-welcome`)

**Blocks:**
```javascript
{
  name: 'Onboarding: Day 1 Welcome',
  description: 'First day onboarding with quick wins',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Welcome to {{app}}!' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We\'re thrilled to have you! You\'ve just taken the first step toward {{value_prop}}.</p>' } },
    { id: '3', type: 'text', props: { content: '<p><strong>Quick wins to get started:</strong></p><ol><li>{{quick_win_1}}</li><li>{{quick_win_2}}</li><li>{{quick_win_3}}</li></ol>' } },
    { id: '4', type: 'button', props: { label: 'Get Started', url: '{{dashboard_url}}', align: 'center', backgroundColor: '#10b981' } },
    { id: '5', type: 'text', props: { content: '<p>Questions? Just reply to this email - we\'re here to help!</p><p>Cheers,<br>The {{app}} Team</p>' } },
    { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 3.5: Onboarding Features Day 3 (`onboarding-features`)

**Blocks:**
```javascript
{
  name: 'Onboarding: Day 3 Feature Highlight',
  description: 'Highlight a key feature to drive engagement',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Did You Know?' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Many users don\'t discover this until later, but <strong>{{feature_name}}</strong> can save you hours every week.</p>' } },
    { id: '3', type: 'text', props: { content: '<p style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;"><strong>{{feature_name}}</strong><br>{{feature_description}}</p>' } },
    { id: '4', type: 'button', props: { label: 'Try It Now', url: '{{feature_url}}', align: 'center' } },
    { id: '5', type: 'text', props: { content: '<p style="font-size: 13px; color: #666;">Coming up next: Pro tips to get even more out of {{app}}</p>' } },
    { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 3.6: Onboarding Tips Day 7 (`onboarding-tips`)

**Blocks:**
```javascript
{
  name: 'Onboarding: Day 7 Tips & Tricks',
  description: 'Power user tips after first week',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Pro Tips for {{app}}' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>You\'ve been with us for a week now! Here are some pro tips our power users swear by:</p>' } },
    { id: '3', type: 'text', props: { content: '<p><strong>💡 Tip #1: {{tip_1_title}}</strong><br>{{tip_1_description}}</p><p><strong>⚡ Tip #2: {{tip_2_title}}</strong><br>{{tip_2_description}}</p><p><strong>🎯 Tip #3: {{tip_3_title}}</strong><br>{{tip_3_description}}</p>' } },
    { id: '4', type: 'button', props: { label: 'Explore Help Center', url: '{{help_url}}', align: 'center' } },
    { id: '5', type: 'text', props: { content: '<p>Have questions? Reply to this email anytime.</p>' } },
    { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

## Phase 4: Holiday/Seasonal Emails

### Task 4.1: Holiday Greeting (`holiday-greeting`)

**Blocks:**
```javascript
{
  name: 'Holiday Greeting',
  description: 'Warm holiday message with gratitude',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Happy Holidays!', backgroundColor: '#dc2626' } },
    { id: '2', type: 'text', props: { content: '<p style="text-align: center; font-size: 40px;">✨🎄✨</p><p style="text-align: center;">Dear {{name}},</p><p style="text-align: center;">Wishing you warmth, joy, and happiness this holiday season.</p>' } },
    { id: '3', type: 'text', props: { content: '<p style="text-align: center;">Thank you for being part of our journey this year. Your support means everything to us.</p>' } },
    { id: '4', type: 'text', props: { content: '<p style="text-align: center; font-size: 13px; color: #666;"><strong>Holiday Hours:</strong><br>{{holiday_hours}}</p>' } },
    { id: '5', type: 'text', props: { content: '<p style="text-align: center;">With gratitude,<br>The {{company}} Team</p>' } },
    { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 4.2: New Year (`new-year`)

**Blocks:**
```javascript
{
  name: 'Happy New Year',
  description: 'New year greeting with preview of what\'s coming',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Happy New Year!', backgroundColor: '#6366f1' } },
    { id: '2', type: 'text', props: { content: '<p style="text-align: center; font-size: 48px; font-weight: bold; color: #6366f1;">{{year}}</p><p style="text-align: center;">A new year, a fresh start!</p>' } },
    { id: '3', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Thank you for being with us in {{previous_year}}. We\'re excited about what {{year}} has in store!</p>' } },
    { id: '4', type: 'text', props: { content: '<p><strong>Coming in {{year}}:</strong></p><ul><li>{{preview_1}}</li><li>{{preview_2}}</li><li>{{preview_3}}</li></ul>' } },
    { id: '5', type: 'button', props: { label: 'See What\'s New', url: '{{whats_new_url}}', align: 'center', backgroundColor: '#6366f1' } },
    { id: '6', type: 'text', props: { content: '<p>Here\'s to an amazing year ahead!</p><p>The {{company}} Team</p>' } },
    { id: '7', type: 'footer', props: { text: '© {{year}} {{company}}', showUnsubscribe: true } }
  ]
}
```

---

### Task 4.3: Year in Review (`year-in-review`)

**Blocks:**
```javascript
{
  name: 'Your Year in Review',
  description: 'Personalized year-end stats and highlights',
  blocks: [
    { id: '1', type: 'header', props: { logo: '', title: 'Your {{year}} in Review' } },
    { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>What a year it\'s been! Here\'s a look back at your journey with us:</p>' } },
    { id: '3', type: 'text', props: { content: '<div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center;"><p style="font-size: 36px; font-weight: bold; color: #3b82f6; margin: 0;">{{stat_1_number}}</p><p style="color: #666; margin: 0;">{{stat_1_label}}</p></div>' } },
    { id: '4', type: 'text', props: { content: '<div style="display: flex; gap: 10px;"><div style="flex: 1; background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center;"><p style="font-size: 24px; font-weight: bold; margin: 0;">{{stat_2_number}}</p><p style="font-size: 13px; color: #666; margin: 0;">{{stat_2_label}}</p></div><div style="flex: 1; background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center;"><p style="font-size: 24px; font-weight: bold; margin: 0;">{{stat_3_number}}</p><p style="font-size: 13px; color: #666; margin: 0;">{{stat_3_label}}</p></div></div>' } },
    { id: '5', type: 'text', props: { content: '<p><strong>Your Top Highlights:</strong></p><ul><li>{{highlight_1}}</li><li>{{highlight_2}}</li><li>{{highlight_3}}</li></ul>' } },
    { id: '6', type: 'button', props: { label: 'Share Your Year', url: '{{share_url}}', align: 'center' } },
    { id: '7', type: 'text', props: { content: '<p style="text-align: center;">Thank you for being part of our community. Here\'s to an even better {{next_year}}!</p>' } },
    { id: '8', type: 'footer', props: { text: '© {{year}} {{company}}', showUnsubscribe: true } }
  ]
}
```

---

## Verification

After each phase:
1. Run `bun run build` to verify no TypeScript errors
2. For certificate templates: Generate a test PDF to verify rendering
3. For email templates: Check database seeding works

## Commit Messages

- Phase 1: `feat(certificates): add 5 new PDF templates`
- Phase 2: `feat(emails): add transactional and re-engagement templates`
- Phase 3: `feat(emails): add survey and onboarding templates`
- Phase 4: `feat(emails): add holiday and seasonal templates`
