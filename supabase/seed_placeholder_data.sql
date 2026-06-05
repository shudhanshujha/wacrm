-- ============================================================
-- seed_placeholder_data.sql
-- Populates the wacrm application with realistic placeholder data.
-- 
-- IMPORTANT: Replace '{{USER_ID}}' with your actual Supabase User ID.
-- You can find this in the 'auth.users' table or by running 
-- 'select auth.uid();' in a query if you are logged in.
-- ============================================================

DO $$
DECLARE
    -- REPLACE THE UUID BELOW WITH YOUR USER ID
    v_user_id UUID := '{{USER_ID}}'::UUID; 
    
    v_tag_hot_id UUID;
    v_tag_customer_id UUID;
    v_tag_spam_id UUID;
    
    v_company_acme_id UUID;
    v_company_globex_id UUID;
    
    v_contact_john_id UUID;
    v_contact_jane_id UUID;
    v_contact_bob_id UUID;
    
    v_pipeline_sales_id UUID;
    v_stage_lead_id UUID;
    v_stage_negotiation_id UUID;
    v_stage_closed_id UUID;
    
    v_conv_john_id UUID;
    v_conv_jane_id UUID;
BEGIN
    -- 1. SEED TAGS
    INSERT INTO tags (user_id, name, color) VALUES 
        (v_user_id, 'Hot Lead', '#ef4444'),
        (v_user_id, 'Customer', '#10b981'),
        (v_user_id, 'Spam', '#64748b')
    RETURNING id INTO v_tag_hot_id; -- Just capturing one for now
    
    SELECT id INTO v_tag_customer_id FROM tags WHERE name = 'Customer' AND user_id = v_user_id;
    SELECT id INTO v_tag_spam_id FROM tags WHERE name = 'Spam' AND user_id = v_user_id;

    -- 2. SEED COMPANIES
    INSERT INTO companies (user_id, name, domain, industry, website) VALUES
        (v_user_id, 'Acme Corp', 'acme.com', 'Manufacturing', 'https://acme.com'),
        (v_user_id, 'Globex Corporation', 'globex.com', 'Technology', 'https://globex.com')
    RETURNING id INTO v_company_acme_id;
    
    SELECT id INTO v_company_globex_id FROM companies WHERE name = 'Globex Corporation' AND user_id = v_user_id;

    -- 3. SEED CONTACTS
    INSERT INTO contacts (user_id, phone, name, email, company_id, created_at) VALUES
        (v_user_id, '+15551234567', 'John Doe', 'john@acme.com', v_company_acme_id, NOW() - INTERVAL '10 days'),
        (v_user_id, '+15559876543', 'Jane Smith', 'jane@globex.com', v_company_globex_id, NOW() - INTERVAL '5 days'),
        (v_user_id, '+919876543210', 'Rahul Sharma', 'rahul@example.in', NULL, NOW() - INTERVAL '2 days')
    RETURNING id INTO v_contact_john_id;

    SELECT id INTO v_contact_jane_id FROM contacts WHERE name = 'Jane Smith' AND user_id = v_user_id;
    SELECT id INTO v_contact_bob_id FROM contacts WHERE name = 'Rahul Sharma' AND user_id = v_user_id;

    -- 4. SEED CONTACT_TAGS
    INSERT INTO contact_tags (contact_id, tag_id) VALUES
        (v_contact_john_id, v_tag_hot_id),
        (v_contact_jane_id, v_tag_customer_id),
        (v_contact_bob_id, v_tag_hot_id);

    -- 5. SEED PIPELINES & STAGES
    INSERT INTO pipelines (user_id, name) VALUES (v_user_id, 'Main Sales Pipeline') RETURNING id INTO v_pipeline_sales_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, position, color) VALUES
        (v_pipeline_sales_id, 'Lead', 0, '#3b82f6'),
        (v_pipeline_sales_id, 'Negotiation', 1, '#f59e0b'),
        (v_pipeline_sales_id, 'Closed Won', 2, '#10b981')
    RETURNING id INTO v_stage_lead_id;

    SELECT id INTO v_stage_negotiation_id FROM pipeline_stages WHERE name = 'Negotiation' AND pipeline_id = v_pipeline_sales_id;
    SELECT id INTO v_stage_closed_id FROM pipeline_stages WHERE name = 'Closed Won' AND pipeline_id = v_pipeline_sales_id;

    -- 6. SEED DEALS
    INSERT INTO deals (user_id, pipeline_id, stage_id, contact_id, title, value, currency, status) VALUES
        (v_user_id, v_pipeline_sales_id, v_stage_lead_id, v_contact_john_id, 'Large Manufacturing Order', 50000.00, 'USD', 'open'),
        (v_user_id, v_pipeline_sales_id, v_stage_negotiation_id, v_contact_jane_id, 'Software License Renewal', 12000.00, 'USD', 'open'),
        (v_user_id, v_pipeline_sales_id, v_stage_closed_id, v_contact_bob_id, 'Consulting Project', 5000.00, 'USD', 'won');

    -- 7. SEED CANNED REPLIES
    INSERT INTO canned_replies (user_id, title, shortcut, content) VALUES
        (v_user_id, 'Welcome Greeting', '/hi', 'Hello! Thanks for reaching out to us. How can we help you today?'),
        (v_user_id, 'Pricing Information', '/price', 'Our standard plans start at $99/month. You can find more details on our website.'),
        (v_user_id, 'Meeting Request', '/meet', 'I would love to discuss this further. Are you available for a quick call tomorrow at 10 AM?');

    -- 8. SEED CATALOG PRODUCTS
    INSERT INTO catalog_products (user_id, name, description, price, currency, retailer_id, is_active) VALUES
        (v_user_id, 'Enterprise CRM License', 'Full access to all features for your entire team.', 999.00, 'USD', 'LIC-ENT-001', TRUE),
        (v_user_id, 'Professional Training', 'A 4-hour intensive training session for your staff.', 450.00, 'USD', 'SRV-TRN-001', TRUE),
        (v_user_id, 'API Integration Add-on', 'Connect your existing tools via our robust API.', 150.00, 'USD', 'ADD-API-001', TRUE);

    -- 9. SEED BROADCASTS
    INSERT INTO broadcasts (user_id, name, template_name, status, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count, clicked_count, created_at) VALUES
        (v_user_id, 'Summer Promotion', 'summer_sale_2024', 'sent', 100, 100, 95, 80, 15, 0, 45, NOW() - INTERVAL '3 days'),
        (v_user_id, 'Product Update', 'feature_announcement', 'sent', 250, 250, 240, 210, 5, 2, 88, NOW() - INTERVAL '1 day'),
        (v_user_id, 'A/B Test Parent', 'none', 'ab_test', 0, 0, 0, 0, 0, 0, 0, NOW() - INTERVAL '5 hours');

    -- 10. SEED CONVERSATIONS & MESSAGES
    INSERT INTO conversations (user_id, contact_id, last_message_text, last_message_at, status) VALUES
        (v_user_id, v_contact_john_id, 'Great, I will check the details.', NOW() - INTERVAL '1 hour', 'open')
    RETURNING id INTO v_conv_john_id;

    INSERT INTO conversations (user_id, contact_id, last_message_text, last_message_at, status) VALUES
        (v_user_id, v_contact_jane_id, 'The invoice has been sent.', NOW() - INTERVAL '3 hours', 'open')
    RETURNING id INTO v_conv_jane_id;

    INSERT INTO messages (conversation_id, user_id, contact_id, content_text, sender_type, status, created_at) VALUES
        (v_conv_john_id, v_user_id, v_contact_john_id, 'Hello, I am interested in your manufacturing services.', 'customer', 'read', NOW() - INTERVAL '2 hours'),
        (v_conv_john_id, v_user_id, v_contact_john_id, 'Hi John! I can certainly help with that. What specific parts are you looking for?', 'agent', 'read', NOW() - INTERVAL '1.5 hours'),
        (v_conv_john_id, v_user_id, v_contact_john_id, 'Great, I will check the details.', 'customer', 'read', NOW() - INTERVAL '1 hour');

    INSERT INTO messages (conversation_id, user_id, contact_id, content_text, sender_type, status, created_at) VALUES
        (v_conv_jane_id, v_user_id, v_contact_jane_id, 'Can you send me the renewal invoice?', 'customer', 'read', NOW() - INTERVAL '4 hours'),
        (v_conv_jane_id, v_user_id, v_contact_jane_id, 'The invoice has been sent.', 'agent', 'read', NOW() - INTERVAL '3 hours');

END $$;
