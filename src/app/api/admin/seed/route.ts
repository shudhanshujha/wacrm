import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. SEED TAGS
    const tags = [
      { user_id: user.id, name: 'Hot Lead', color: '#ef4444' },
      { user_id: user.id, name: 'Customer', color: '#10b981' },
      { user_id: user.id, name: 'Spam', color: '#64748b' },
      { user_id: user.id, name: 'Follow-up', color: '#f59e0b' },
    ]
    const { data: tagData } = await supabase.from('tags').insert(tags).select()
    const tagHot = tagData?.find(t => t.name === 'Hot Lead')
    const tagCustomer = tagData?.find(t => t.name === 'Customer')

    // 2. SEED COMPANIES
    const companies = [
      { user_id: user.id, name: 'Acme Corp', domain: 'acme.com', industry: 'Manufacturing', website: 'https://acme.com' },
      { user_id: user.id, name: 'Globex Corporation', domain: 'globex.com', industry: 'Technology', website: 'https://globex.com' },
    ]
    const { data: companyData } = await supabase.from('companies').insert(companies).select()
    const companyAcme = companyData?.find(c => c.name === 'Acme Corp')
    const companyGlobex = companyData?.find(c => c.name === 'Globex Corporation')

    // 3. SEED CONTACTS
    const contacts = [
      { user_id: user.id, phone: '+15551234567', name: 'John Doe', email: 'john@acme.com', company_id: companyAcme?.id },
      { user_id: user.id, phone: '+15559876543', name: 'Jane Smith', email: 'jane@globex.com', company_id: companyGlobex?.id },
      { user_id: user.id, phone: '+919876543210', name: 'Rahul Sharma', email: 'rahul@example.in' },
    ]
    const { data: contactData } = await supabase.from('contacts').insert(contacts).select()
    const contactJohn = contactData?.find(c => c.name === 'John Doe')
    const contactJane = contactData?.find(c => c.name === 'Jane Smith')
    const contactRahul = contactData?.find(c => c.name === 'Rahul Sharma')

    // 4. SEED CONTACT_TAGS
    const contactTags = []
    if (contactJohn && tagHot) contactTags.push({ contact_id: contactJohn.id, tag_id: tagHot.id })
    if (contactJane && tagCustomer) contactTags.push({ contact_id: contactJane.id, tag_id: tagCustomer.id })
    if (contactRahul && tagHot) contactTags.push({ contact_id: contactRahul.id, tag_id: tagHot.id })
    if (contactTags.length > 0) await supabase.from('contact_tags').insert(contactTags)

    // 5. SEED PIPELINES & STAGES
    const { data: pipeline } = await supabase.from('pipelines').insert({ user_id: user.id, name: 'Sales Pipeline' }).select().single()
    if (pipeline) {
      const stages = [
        { pipeline_id: pipeline.id, name: 'Lead', position: 0, color: '#3b82f6' },
        { pipeline_id: pipeline.id, name: 'Negotiation', position: 1, color: '#f59e0b' },
        { pipeline_id: pipeline.id, name: 'Closed Won', position: 2, color: '#10b981' },
      ]
      const { data: stageData } = await supabase.from('pipeline_stages').insert(stages).select()
      const stageLead = stageData?.find(s => s.name === 'Lead')
      const stageNegotiation = stageData?.find(s => s.name === 'Negotiation')
      const stageClosed = stageData?.find(s => s.name === 'Closed Won')

      // 6. SEED DEALS
      const deals = []
      if (contactJohn && stageLead) deals.push({ user_id: user.id, pipeline_id: pipeline.id, stage_id: stageLead.id, contact_id: contactJohn.id, title: 'Large Manufacturing Order', value: 50000, currency: 'USD', status: 'open' })
      if (contactJane && stageNegotiation) deals.push({ user_id: user.id, pipeline_id: pipeline.id, stage_id: stageNegotiation.id, contact_id: contactJane.id, title: 'Software License Renewal', value: 12000, currency: 'USD', status: 'open' })
      if (contactRahul && stageClosed) deals.push({ user_id: user.id, pipeline_id: pipeline.id, stage_id: stageClosed.id, contact_id: contactRahul.id, title: 'Consulting Project', value: 5000, currency: 'USD', status: 'won' })
      if (deals.length > 0) await supabase.from('deals').insert(deals)
    }

    // 7. SEED CANNED REPLIES
    const canned = [
      { user_id: user.id, title: 'Welcome Greeting', shortcut: '/hi', content: 'Hello! Thanks for reaching out to us. How can we help you today?' },
      { user_id: user.id, title: 'Pricing Info', shortcut: '/price', content: 'Our standard plans start at $99/month. You can find more details on our website.' },
    ]
    await supabase.from('canned_replies').insert(canned)

    // 8. SEED CATALOG PRODUCTS
    const products = [
      { user_id: user.id, name: 'Enterprise CRM License', description: 'Full access for your team.', price: 999, currency: 'USD', retailer_id: 'LIC-ENT-001' },
      { user_id: user.id, name: 'API Integration', description: 'Connect your tools.', price: 150, currency: 'USD', retailer_id: 'ADD-API-001' },
    ]
    await supabase.from('catalog_products').insert(products)

    // 9. SEED BROADCASTS
    const broadcasts = [
      { user_id: user.id, name: 'Summer Promotion', template_name: 'summer_sale', status: 'sent', total_recipients: 100, sent_count: 100, delivered_count: 95, read_count: 80, replied_count: 15, clicked_count: 45 },
      { user_id: user.id, name: 'Monthly Newsletter', template_name: 'monthly_update', status: 'sent', total_recipients: 250, sent_count: 250, delivered_count: 240, read_count: 210, replied_count: 5, clicked_count: 30 },
    ]
    await supabase.from('broadcasts').insert(broadcasts)

    // 10. SEED CONVERSATIONS & MESSAGES
    if (contactJohn) {
      const { data: conv } = await supabase.from('conversations').insert({ user_id: user.id, contact_id: contactJohn.id, last_message_text: 'Talk soon!', status: 'open' }).select().single()
      if (conv) {
        const msgs = [
          { conversation_id: conv.id, user_id: user.id, contact_id: contactJohn.id, content_text: 'Interested in your services.', sender_type: 'customer', status: 'read', created_at: new Date(Date.now() - 3600000).toISOString() },
          { conversation_id: conv.id, user_id: user.id, contact_id: contactJohn.id, content_text: 'Hi John! We can help. What do you need?', sender_type: 'agent', status: 'read', created_at: new Date(Date.now() - 3000000).toISOString() },
          { conversation_id: conv.id, user_id: user.id, contact_id: contactJohn.id, content_text: 'Talk soon!', sender_type: 'customer', status: 'read', created_at: new Date(Date.now() - 2000000).toISOString() },
        ]
        await supabase.from('messages').insert(msgs)
      }
    }

    return NextResponse.json({ success: true, message: 'Sample data seeded successfully.' })
  } catch (error) {
    console.error('Seed Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
