import { execute, queryOne } from '../client'
import { logger } from '../../lib/logger'

export async function seedStarterTemplates(): Promise<void> {
  // Check if templates already exist
  const count = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM templates')

  if (count && count.count > 0) {
    return // Templates already exist, skip seeding
  }

  logger.info('Seeding starter templates', { service: 'database', operation: 'seed' })

  const templates = [
    {
      name: 'Marketing: Newsletter',
      description: 'Monthly updates, news, and featured content',
      blocks: [
        { id: 'header_1', type: 'header', props: { backgroundColor: '#3b82f6', imageUrl: '' } },
        { id: 'text_1', type: 'text', props: { content: 'Hello {{name}},\n\nHere\'s what\'s new this month at {{company}}. We\'ve been working hard to bring you exciting updates and valuable content.', fontSize: 16, align: 'left' } },
        { id: 'divider_1', type: 'divider', props: { style: 'solid', color: '#e5e7eb' } },
        { id: 'text_2', type: 'text', props: { content: '📰 Featured This Month\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', fontSize: 15, align: 'left' } },
        { id: 'button_1', type: 'button', props: { label: 'Read More', url: '{{read_more_url}}', color: '#3b82f6', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: '© 2026 {{company}} · You received this because you subscribed.\nUnsubscribe | View in browser' } },
      ],
    },
    {
      name: 'Marketing: Promotional',
      description: 'Special offers, discounts, and product promotions',
      blocks: [
        { id: 'header_1', type: 'header', props: { backgroundColor: '#f97316', imageUrl: '' } },
        { id: 'text_1', type: 'text', props: { content: 'Hey {{name}}! 🎉\n\nWe have a special offer just for you. For a limited time, enjoy exclusive savings on our most popular products.', fontSize: 16, align: 'left' } },
        { id: 'image_1', type: 'image', props: { url: '', alt: 'Promotional offer', width: 100, align: 'center' } },
        { id: 'text_2', type: 'text', props: { content: '🏷️ LIMITED TIME OFFER\n\nGet 20% off your next purchase with code SAVE20.\n\n✓ Free shipping on orders over $50\n✓ 30-day money-back guarantee', fontSize: 15, align: 'center' } },
        { id: 'button_1', type: 'button', props: { label: 'Shop Now', url: '{{shop_url}}', color: '#f97316', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: 'Terms and conditions apply. Offer valid until {{expiry_date}}.\n© 2026 {{company}} · Unsubscribe' } },
      ],
    },
    {
      name: 'Transactional: Welcome',
      description: 'Onboarding emails for new users and customers',
      blocks: [
        { id: 'header_1', type: 'header', props: { backgroundColor: '#10b981', imageUrl: '' } },
        { id: 'text_1', type: 'text', props: { content: 'Welcome to {{company}}, {{name}}! 👋\n\nWe\'re thrilled to have you on board. You\'ve just joined a community of thousands who are already benefiting from our platform.', fontSize: 16, align: 'left' } },
        { id: 'spacer_1', type: 'spacer', props: { height: 20 } },
        { id: 'text_2', type: 'text', props: { content: '🚀 Getting Started\n\n1. Complete your profile - Add your details\n2. Explore features - Discover all the tools\n3. Connect with us - Follow us for tips and updates', fontSize: 15, align: 'left' } },
        { id: 'button_1', type: 'button', props: { label: 'Get Started', url: '{{dashboard_url}}', color: '#10b981', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: 'Need help? Reply to this email or visit our Help Center.\n© 2026 {{company}}' } },
      ],
    },
    {
      name: 'Transactional: Meeting Request',
      description: 'Schedule meetings and appointments',
      blocks: [
        { id: 'text_1', type: 'text', props: { content: 'Hi {{name}},\n\nI hope this email finds you well. I\'d like to schedule a meeting to discuss {{meeting_topic}}.\n\nPlease find the proposed details below:', fontSize: 16, align: 'left' } },
        { id: 'divider_1', type: 'divider', props: { style: 'solid', color: '#e5e7eb' } },
        { id: 'text_2', type: 'text', props: { content: '📅 Date: {{date}}\n⏰ Time: {{time}}\n📍 Location: {{location}}\n⏱️ Duration: {{duration}}', fontSize: 15, align: 'left' } },
        { id: 'divider_2', type: 'divider', props: { style: 'solid', color: '#e5e7eb' } },
        { id: 'text_3', type: 'text', props: { content: 'Please let me know if this time works for you, or suggest an alternative.', fontSize: 15, align: 'left' } },
        { id: 'button_1', type: 'button', props: { label: 'Confirm Availability', url: '{{calendar_url}}', color: '#6366f1', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: '{{sender_name}}\n{{sender_title}} · {{company}}\n{{sender_email}}' } },
      ],
    },
    {
      name: 'Communication: Announcement',
      description: 'Company news, product updates, and important notices',
      blocks: [
        { id: 'header_1', type: 'header', props: { backgroundColor: '#6366f1', imageUrl: '' } },
        { id: 'text_1', type: 'text', props: { content: '📢 Important Announcement\n\nDear {{name}},\n\nWe\'re excited to share some important news with you.', fontSize: 16, align: 'left' } },
        { id: 'image_1', type: 'image', props: { url: '', alt: 'Announcement', width: 100, align: 'center' } },
        { id: 'text_2', type: 'text', props: { content: 'What This Means For You\n\n• New features and improvements\n• Enhanced user experience\n• Better performance and reliability', fontSize: 15, align: 'left' } },
        { id: 'button_1', type: 'button', props: { label: 'Learn More', url: '{{announcement_url}}', color: '#6366f1', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: 'Thank you for being part of our journey.\n© 2026 {{company}}' } },
      ],
    },
    {
      name: 'Communication: Simple Text',
      description: 'Clean, minimal text-only emails for personal outreach',
      blocks: [
        { id: 'text_1', type: 'text', props: { content: 'Hi {{name}},\n\nI hope you\'re doing well. I wanted to reach out regarding {{subject}}.\n\n[Your message here]\n\nLet me know if you have any questions.\n\nBest regards,\n{{sender_name}}', fontSize: 16, align: 'left' } },
        { id: 'spacer_1', type: 'spacer', props: { height: 10 } },
        { id: 'footer_1', type: 'footer', props: { text: '{{sender_name}} · {{sender_title}}\n{{sender_email}} · {{sender_phone}}' } },
      ],
    },
  ]

  for (const template of templates) {
    await execute(
      'INSERT INTO templates (name, description, blocks) VALUES (?, ?, ?)',
      [template.name, template.description, JSON.stringify(template.blocks)]
    )
  }

  logger.info('Seeded starter templates', { service: 'database', operation: 'seed', count: templates.length })
}
