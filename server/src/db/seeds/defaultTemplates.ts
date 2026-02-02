import { execute, queryOne } from '../client'
import { logger } from '../../lib/logger'

export async function seedDefaultTemplates(): Promise<void> {
  // Check if default templates already exist
  const existing = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM templates WHERE is_default = 1')
  if (existing && existing.count > 0) {
    return // Already seeded
  }

  const defaultTemplates = [
    {
      name: 'Newsletter',
      description: 'Multi-section newsletter with header, content blocks, and footer',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Company Newsletter', subtitle: 'Monthly Updates' } },
        { id: '2', type: 'text', props: { content: '<h2>This Month\'s Highlights</h2><p>Hello {{name}},</p><p>Here are the latest updates from our team...</p>' } },
        { id: '3', type: 'divider', props: { style: 'solid' } },
        { id: '4', type: 'text', props: { content: '<h3>Feature Article</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>' } },
        { id: '5', type: 'button', props: { label: 'Read More', url: 'https://example.com', align: 'center' } },
        { id: '6', type: 'footer', props: { text: '© 2026 Company Name. All rights reserved.', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Announcement',
      description: 'Simple announcement with headline and call-to-action',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Important Announcement' } },
        { id: '2', type: 'text', props: { content: '<p>Dear {{name}},</p><p>We have exciting news to share with you!</p><p>Our team has been working hard on something special, and we can\'t wait for you to see it.</p>' } },
        { id: '3', type: 'button', props: { label: 'Learn More', url: 'https://example.com', align: 'center' } },
        { id: '4', type: 'footer', props: { text: 'Questions? Reply to this email.', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Welcome Email',
      description: 'Onboarding email for new users or subscribers',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Welcome!' } },
        { id: '2', type: 'text', props: { content: '<h2>Welcome to the team, {{name}}!</h2><p>We\'re thrilled to have you on board. Here\'s what you can expect:</p><ul><li>Regular updates and insights</li><li>Exclusive content and offers</li><li>Direct access to our support team</li></ul>' } },
        { id: '3', type: 'button', props: { label: 'Get Started', url: 'https://example.com', align: 'center' } },
        { id: '4', type: 'text', props: { content: '<p>If you have any questions, just reply to this email.</p><p>Best regards,<br>The Team</p>' } },
        { id: '5', type: 'footer', props: { text: '© 2026 Company Name', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Promotion',
      description: 'Sale or discount promotional email',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Special Offer Inside!' } },
        { id: '2', type: 'text', props: { content: '<h1 style="text-align: center; color: #e53e3e;">🎉 50% OFF 🎉</h1><p style="text-align: center;">For a limited time only!</p>' } },
        { id: '3', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Don\'t miss out on our biggest sale of the year. Use code <strong>SAVE50</strong> at checkout.</p>' } },
        { id: '4', type: 'button', props: { label: 'Shop Now', url: 'https://example.com', align: 'center', backgroundColor: '#e53e3e' } },
        { id: '5', type: 'text', props: { content: '<p style="text-align: center; font-size: 12px;">Offer expires in 48 hours. Terms and conditions apply.</p>' } },
        { id: '6', type: 'footer', props: { text: '© 2026 Company Name', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Event Invitation',
      description: 'Event invite with date, time, and location details',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'You\'re Invited!' } },
        { id: '2', type: 'text', props: { content: '<h2 style="text-align: center;">Annual Company Meetup</h2><p>Dear {{name}},</p><p>We\'d love for you to join us at our upcoming event!</p>' } },
        { id: '3', type: 'text', props: { content: '<p><strong>📅 Date:</strong> March 15, 2026<br><strong>🕐 Time:</strong> 6:00 PM - 9:00 PM<br><strong>📍 Location:</strong> 123 Main Street, City</p>' } },
        { id: '4', type: 'button', props: { label: 'RSVP Now', url: 'https://example.com', align: 'center' } },
        { id: '5', type: 'text', props: { content: '<p>We look forward to seeing you there!</p>' } },
        { id: '6', type: 'footer', props: { text: 'Can\'t make it? Let us know by replying to this email.', showUnsubscribe: true } }
      ]
    },
    // Transactional Templates
    {
      name: 'Order Confirmation',
      description: 'Order summary with items, shipping address, and tracking',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Order Confirmed!', backgroundColor: '#10b981' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Thank you for your order! We\'re getting it ready to ship.</p>' } },
        { id: '3', type: 'divider', props: { style: 'solid' } },
        { id: '4', type: 'text', props: { content: '<h3>Order Details</h3><p><strong>Order Number:</strong> {{order_number}}</p>' } },
        { id: '5', type: 'text', props: { content: '<p>{{order_items}}</p>' } },
        { id: '6', type: 'divider', props: { style: 'solid' } },
        { id: '7', type: 'text', props: { content: '<p style="text-align: right;"><strong>Order Total:</strong> {{order_total}}</p>' } },
        { id: '8', type: 'text', props: { content: '<h3>Shipping Address</h3><p>{{shipping_address}}</p>' } },
        { id: '9', type: 'button', props: { label: 'Track Order', url: '{{tracking_url}}', align: 'center', backgroundColor: '#10b981' } },
        { id: '10', type: 'footer', props: { text: 'Questions about your order? Reply to this email.', showUnsubscribe: false } }
      ]
    },
    {
      name: 'Shipping Update',
      description: 'Package shipped notification with tracking details',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Your Order is On Its Way!' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Great news! Your order has shipped and is on its way to you.</p>' } },
        { id: '3', type: 'divider', props: { style: 'solid' } },
        { id: '4', type: 'text', props: { content: '<p><strong>Tracking Number:</strong> {{tracking_number}}<br><strong>Carrier:</strong> {{carrier}}<br><strong>Estimated Delivery:</strong> {{delivery_date}}</p>' } },
        { id: '5', type: 'button', props: { label: 'Track Package', url: '{{tracking_url}}', align: 'center', backgroundColor: '#10b981' } },
        { id: '6', type: 'divider', props: { style: 'solid' } },
        { id: '7', type: 'text', props: { content: '<p><strong>Order Reference:</strong> {{order_number}}</p>' } },
        { id: '8', type: 'footer', props: { text: 'Thank you for your order!', showUnsubscribe: false } }
      ]
    },
    {
      name: 'Password Reset',
      description: 'Secure password reset request with single CTA',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Reset Your Password' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>' } },
        { id: '3', type: 'button', props: { label: 'Reset Password', url: '{{reset_url}}', align: 'center', backgroundColor: '#dc2626' } },
        { id: '4', type: 'text', props: { content: '<p style="text-align: center; color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>' } },
        { id: '5', type: 'divider', props: { style: 'solid' } },
        { id: '6', type: 'text', props: { content: '<p style="color: #6b7280; font-size: 13px;"><strong>Didn\'t request this?</strong><br>If you didn\'t request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>' } },
        { id: '7', type: 'footer', props: { text: 'This request was initiated from IP address {{ip_address}}.', showUnsubscribe: false } }
      ]
    },
    {
      name: 'Receipt',
      description: 'Payment receipt with itemized breakdown',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Payment Receipt', backgroundColor: '#10b981' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Thank you for your payment. Here are your transaction details:</p>' } },
        { id: '3', type: 'text', props: { content: '<p><strong>Invoice #:</strong> {{invoice_number}}<br><strong>Date:</strong> {{date}}</p>' } },
        { id: '4', type: 'divider', props: { style: 'solid' } },
        { id: '5', type: 'text', props: { content: '<h3>Items</h3><p>{{line_items}}</p>' } },
        { id: '6', type: 'divider', props: { style: 'solid' } },
        { id: '7', type: 'text', props: { content: '<p style="text-align: right;">Subtotal: {{subtotal}}<br>Tax: {{tax}}<br><strong style="font-size: 18px;">Total: {{total}}</strong></p>' } },
        { id: '8', type: 'text', props: { content: '<p><strong>Payment Method:</strong> {{payment_method}}</p>' } },
        { id: '9', type: 'footer', props: { text: 'Keep this email for your records.', showUnsubscribe: false } }
      ]
    },
    // Re-engagement Templates
    {
      name: 'We Miss You',
      description: 'Friendly re-engagement for inactive users',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'We Miss You!' } },
        { id: '2', type: 'text', props: { content: '<p style="text-align: center; font-size: 48px;">👋</p>' } },
        { id: '3', type: 'text', props: { content: '<p>Hi {{name}},</p><p>It\'s been a while since we\'ve seen you around, and we just wanted to reach out and say — we miss you!</p>' } },
        { id: '4', type: 'text', props: { content: '<p>A lot has happened since your last visit. Here\'s what you\'ve been missing:</p><ul><li><strong>New features</strong> — Exciting tools to help you do more</li><li><strong>Improvements</strong> — Faster, smoother, better than ever</li><li><strong>Fresh updates</strong> — New content waiting just for you</li></ul>' } },
        { id: '5', type: 'text', props: { content: '<p style="text-align: center;">We\'d love to have you back. Why not take a look around?</p>' } },
        { id: '6', type: 'button', props: { label: 'Come Back and Explore', url: '{{app_url}}', align: 'center' } },
        { id: '7', type: 'text', props: { content: '<p>Warm regards,<br>The Team</p>' } },
        { id: '8', type: 'footer', props: { text: 'We hope to see you again soon.', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Account Inactive Warning',
      description: 'Warning before account deactivation',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Action Required', backgroundColor: '#f59e0b' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We noticed you haven\'t logged into your account in a while. To keep our platform secure, <strong>your account will be deactivated on {{deactivation_date}}</strong> unless you take action.</p>' } },
        { id: '3', type: 'divider', props: { style: 'solid' } },
        { id: '4', type: 'text', props: { content: '<h3>What happens if your account is deactivated?</h3><ul><li>Your data will be archived and no longer accessible</li><li>You\'ll need to contact support to restore your account</li></ul>' } },
        { id: '5', type: 'button', props: { label: 'Keep My Account Active', url: '{{login_url}}', align: 'center', backgroundColor: '#f59e0b' } },
        { id: '6', type: 'text', props: { content: '<p>Want to download your data first? <a href="{{export_url}}">Export your data here</a> before the deadline.</p>' } },
        { id: '7', type: 'footer', props: { text: 'If you believe you received this message in error, please contact support.', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Special Win-back Offer',
      description: 'Promotional discount to re-engage inactive users',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'A Gift For You' } },
        { id: '2', type: 'text', props: { content: '<h1 style="text-align: center; color: #7c3aed;">Welcome Back!</h1><p style="text-align: center; font-size: 18px;">We\'ve missed you, {{name}}!</p>' } },
        { id: '3', type: 'text', props: { content: '<p style="text-align: center;">To celebrate your return, here\'s <strong>20% off</strong> just for you:</p>' } },
        { id: '4', type: 'text', props: { content: '<p style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 2px;">{{promo_code}}</p>' } },
        { id: '5', type: 'button', props: { label: 'Shop Now', url: '{{shop_url}}', align: 'center', backgroundColor: '#7c3aed' } },
        { id: '6', type: 'text', props: { content: '<p style="text-align: center; font-size: 14px; color: #6b7280;">Offer expires: {{expiry_date}}</p>' } },
        { id: '7', type: 'divider', props: { style: 'solid' } },
        { id: '8', type: 'text', props: { content: '<h3>What\'s new since you\'ve been away</h3><ul><li>{{new_feature_1}}</li><li>{{new_feature_2}}</li></ul>' } },
        { id: '9', type: 'footer', props: { text: '© 2026 Company Name', showUnsubscribe: true } }
      ]
    },
    // Survey/Feedback Templates
    {
      name: 'Feedback Request',
      description: 'Simple feedback collection with rating',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'How Did We Do?' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We recently had the pleasure of serving you with {{product_or_service}}. Your opinion matters to us!</p>' } },
        { id: '3', type: 'text', props: { content: '<h3 style="text-align: center;">Rate Your Experience</h3><p style="text-align: center; font-size: 32px;"><a href="{{rating_url_1}}" style="text-decoration: none;">⭐</a>&nbsp;<a href="{{rating_url_2}}" style="text-decoration: none;">⭐</a>&nbsp;<a href="{{rating_url_3}}" style="text-decoration: none;">⭐</a>&nbsp;<a href="{{rating_url_4}}" style="text-decoration: none;">⭐</a>&nbsp;<a href="{{rating_url_5}}" style="text-decoration: none;">⭐</a></p><p style="text-align: center; font-size: 12px; color: #6b7280;">Click a star to rate (1-5)</p>' } },
        { id: '4', type: 'button', props: { label: 'Share Detailed Feedback', url: '{{feedback_url}}', align: 'center' } },
        { id: '5', type: 'footer', props: { text: 'Your feedback helps us improve. Thank you!', showUnsubscribe: true } }
      ]
    },
    {
      name: 'NPS Survey',
      description: 'Net Promoter Score survey with 0-10 scale',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Quick Question' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We value your feedback and would love to hear from you.</p>' } },
        { id: '3', type: 'text', props: { content: '<h3 style="text-align: center;">How likely are you to recommend us to a friend or colleague?</h3>' } },
        { id: '4', type: 'text', props: { content: '<p style="text-align: center;"><a href="{{nps_url_0}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #ef4444; color: white; text-decoration: none; border-radius: 4px;">0</a><a href="{{nps_url_1}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #f97316; color: white; text-decoration: none; border-radius: 4px;">1</a><a href="{{nps_url_2}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #f97316; color: white; text-decoration: none; border-radius: 4px;">2</a><a href="{{nps_url_3}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #facc15; color: black; text-decoration: none; border-radius: 4px;">3</a><a href="{{nps_url_4}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #facc15; color: black; text-decoration: none; border-radius: 4px;">4</a><a href="{{nps_url_5}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #facc15; color: black; text-decoration: none; border-radius: 4px;">5</a><a href="{{nps_url_6}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #facc15; color: black; text-decoration: none; border-radius: 4px;">6</a><a href="{{nps_url_7}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #84cc16; color: black; text-decoration: none; border-radius: 4px;">7</a><a href="{{nps_url_8}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #84cc16; color: black; text-decoration: none; border-radius: 4px;">8</a><a href="{{nps_url_9}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #22c55e; color: white; text-decoration: none; border-radius: 4px;">9</a><a href="{{nps_url_10}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #22c55e; color: white; text-decoration: none; border-radius: 4px;">10</a></p>' } },
        { id: '5', type: 'text', props: { content: '<p style="font-size: 12px; color: #6b7280;"><span style="float: left;">Not likely</span><span style="float: right;">Very likely</span></p><div style="clear: both;"></div>' } },
        { id: '6', type: 'text', props: { content: '<p style="text-align: center; color: #6b7280;">Click a number above to submit your response</p>' } },
        { id: '7', type: 'footer', props: { text: 'This survey takes less than 30 seconds. Thank you!', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Review Request',
      description: 'Request for product or service review',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Enjoying {{product}}?' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We hope you\'re loving your recent experience! Your opinion matters, and we\'d love to hear about it.</p>' } },
        { id: '3', type: 'text', props: { content: '<div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center;"><p style="margin: 0;"><strong>Your review helps others make informed decisions</strong></p><p style="margin: 8px 0 0 0; color: #6b7280;">Share your honest experience and help our community grow.</p></div>' } },
        { id: '4', type: 'button', props: { label: 'Leave a Review', url: '{{review_url}}', align: 'center' } },
        { id: '5', type: 'text', props: { content: '<p style="text-align: center; color: #6b7280;">Join {{review_count}}+ happy customers who\'ve shared their experience</p>' } },
        { id: '6', type: 'footer', props: { text: 'Thank you for being a valued customer.', showUnsubscribe: true } }
      ]
    },
    // Onboarding Templates
    {
      name: 'Onboarding: Day 1 Welcome',
      description: 'First day onboarding with quick wins',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Welcome to {{app}}!', backgroundColor: '#10b981' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We\'re so excited to have you on board! You\'ve just taken the first step toward {{value_prop}}.</p>' } },
        { id: '3', type: 'text', props: { content: '<p><strong>Quick wins to get started:</strong></p><ol><li>{{quick_win_1}}</li><li>{{quick_win_2}}</li><li>{{quick_win_3}}</li></ol>' } },
        { id: '4', type: 'button', props: { label: 'Get Started', url: '{{dashboard_url}}', align: 'center', backgroundColor: '#10b981' } },
        { id: '5', type: 'text', props: { content: '<p>Questions? Just reply to this email—we\'re here to help!</p><p>Cheers,<br>The {{app}} Team</p>' } },
        { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Onboarding: Day 3 Feature Highlight',
      description: 'Highlight a key feature to drive engagement',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Did You Know?' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Many users don\'t discover this until later, but we wanted to make sure you knew about one of our most powerful features.</p>' } },
        { id: '3', type: 'text', props: { content: '<div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px;"><strong style="font-size: 18px;">{{feature_name}}</strong><br><br>{{feature_description}}</div>' } },
        { id: '4', type: 'button', props: { label: 'Try It Now', url: '{{feature_url}}', align: 'center' } },
        { id: '5', type: 'text', props: { content: '<p style="color: #6b7280;">Coming up next: Pro tips to get even more out of {{app}}.</p>' } },
        { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Onboarding: Day 7 Tips & Tricks',
      description: 'Power user tips after first week',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Pro Tips for {{app}}' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>🎉 <strong>You\'ve been with us for a week now!</strong> Here are some power user tips to help you get even more out of {{app}}:</p>' } },
        { id: '3', type: 'text', props: { content: '<p>💡 <strong>Tip #1: {{tip_1_title}}</strong><br>{{tip_1_description}}</p>' } },
        { id: '4', type: 'text', props: { content: '<p>⚡ <strong>Tip #2: {{tip_2_title}}</strong><br>{{tip_2_description}}</p>' } },
        { id: '5', type: 'text', props: { content: '<p>🎯 <strong>Tip #3: {{tip_3_title}}</strong><br>{{tip_3_description}}</p>' } },
        { id: '6', type: 'button', props: { label: 'Explore Help Center', url: '{{help_url}}', align: 'center' } },
        { id: '7', type: 'text', props: { content: '<p>Have questions? Reply to this email anytime.</p>' } },
        { id: '8', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
      ]
    },
    // Holiday/Seasonal Templates
    {
      name: 'Holiday Greeting',
      description: 'Warm holiday message with gratitude',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Happy Holidays!', backgroundColor: '#dc2626' } },
        { id: '2', type: 'text', props: { content: '<p style="text-align: center; font-size: 24px;">✨🎄✨</p>' } },
        { id: '3', type: 'text', props: { content: '<p>Dear {{name}},</p><p>As the holiday season approaches, we wanted to send you our warmest wishes for a joyful and peaceful celebration.</p>' } },
        { id: '4', type: 'text', props: { content: '<p><strong>Thank you for being part of our journey.</strong></p><p>Your support throughout this year has meant the world to us. We look forward to continuing this journey together in the new year.</p>' } },
        { id: '5', type: 'divider', props: { style: 'solid' } },
        { id: '6', type: 'text', props: { content: '<p><strong>🕐 Holiday Hours:</strong><br>{{holiday_hours}}</p>' } },
        { id: '7', type: 'text', props: { content: '<p>Wishing you and your loved ones a wonderful holiday season.</p><p>With gratitude,<br>The {{company}} Team</p>' } },
        { id: '8', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Happy New Year',
      description: 'New year greeting with preview of what\'s coming',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Happy New Year!', backgroundColor: '#6366f1' } },
        { id: '2', type: 'text', props: { content: '<p style="text-align: center; font-size: 64px; font-weight: bold; color: #6366f1;">{{year}}</p>' } },
        { id: '3', type: 'text', props: { content: '<p style="text-align: center; font-size: 20px; color: #64748b;">A new year, a fresh start!</p>' } },
        { id: '4', type: 'text', props: { content: '<p>Dear {{name}},</p><p>Thank you for being part of our journey in {{previous_year}}. Your support has meant everything to us!</p>' } },
        { id: '5', type: 'text', props: { content: '<p><strong>Coming in {{year}}:</strong></p><ul><li>{{preview_1}}</li><li>{{preview_2}}</li><li>{{preview_3}}</li></ul>' } },
        { id: '6', type: 'button', props: { label: 'See What\'s New', url: '{{whats_new_url}}', align: 'center', backgroundColor: '#6366f1' } },
        { id: '7', type: 'text', props: { content: '<p>Here\'s to an amazing year ahead!</p><p>The {{company}} Team</p>' } },
        { id: '8', type: 'footer', props: { text: '© {{year}} {{company}}', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Your Year in Review',
      description: 'Personalized year-end stats and highlights',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Your {{year}} in Review' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>What a year it\'s been! Here\'s a look back at your incredible journey with us.</p>' } },
        { id: '3', type: 'text', props: { content: '<div style="background: #6366f1; border-radius: 16px; padding: 40px; text-align: center; color: white;"><p style="font-size: 48px; font-weight: bold; margin: 0;">{{stat_1_number}}</p><p style="font-size: 16px; margin: 10px 0 0 0;">{{stat_1_label}}</p></div>' } },
        { id: '4', type: 'text', props: { content: '<div style="display: flex; gap: 20px; margin-top: 20px;"><div style="flex: 1; background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center;"><p style="font-size: 28px; font-weight: bold; margin: 0; color: #6366f1;">{{stat_2_number}}</p><p style="font-size: 14px; color: #6b7280; margin: 8px 0 0 0;">{{stat_2_label}}</p></div><div style="flex: 1; background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center;"><p style="font-size: 28px; font-weight: bold; margin: 0; color: #6366f1;">{{stat_3_number}}</p><p style="font-size: 14px; color: #6b7280; margin: 8px 0 0 0;">{{stat_3_label}}</p></div></div>' } },
        { id: '5', type: 'divider', props: { style: 'solid' } },
        { id: '6', type: 'text', props: { content: '<h3 style="text-align: center;">🏆 Your Top Highlights</h3><ul><li>{{highlight_1}}</li><li>{{highlight_2}}</li><li>{{highlight_3}}</li></ul>' } },
        { id: '7', type: 'button', props: { label: 'Share Your Year', url: '{{share_url}}', align: 'center', backgroundColor: '#6366f1' } },
        { id: '8', type: 'text', props: { content: '<p style="text-align: center;">Thank you for being part of our story.<br><strong>Here\'s to an even better {{next_year}}! 🎉</strong></p>' } },
        { id: '9', type: 'footer', props: { text: '© {{year}} {{company}}', showUnsubscribe: true } }
      ]
    }
  ]

  for (const template of defaultTemplates) {
    await execute(
      'INSERT INTO templates (name, description, blocks, is_default) VALUES (?, ?, ?, 1)',
      [template.name, template.description, JSON.stringify(template.blocks)]
    )
  }

  logger.info('Seeded default email templates', { service: 'db', count: defaultTemplates.length })
}
