-- PostgreSQL Seed Data for Backlink Tracker
-- Real AI tool directories and sample websites

-- =============================================
-- Sample AI Tool Websites (Your portfolio)
-- =============================================
INSERT INTO websites (domain, name, category) VALUES
('aianalyticstools.com', 'AI Analytics Tools', 'ai-analytics'),
('smartautomation.io', 'Smart Automation Hub', 'ai-automation'),
('nlpworkshop.net', 'NLP Workshop', 'ai-nlp'),
('computervisionsuite.co', 'Computer Vision Suite', 'ai-vision'),
('aiwritingassistants.org', 'AI Writing Assistants', 'ai-writing')
ON CONFLICT (domain) DO NOTHING;

-- =============================================
-- Real AI Tool Directory Resources
-- Note: These will auto-create backlink entries for all websites above
-- =============================================
INSERT INTO resources (domain, url, domain_authority, category, cost) VALUES
('futuretools.io', 'https://futuretools.io', 85, 'ai-directory', 0.00),
('aitoolnet.com', 'https://aitoolnet.com', 75, 'ai-directory', 0.00),
('aiailist.com', 'https://aiailist.com', 70, 'ai-directory', 0.00),
('allinai.tools', 'https://allinai.tools', 65, 'ai-directory', 0.00),
('toolscout.ai', 'https://toolscout.ai', 68, 'ai-directory', 0.00),
('aitoolsguide.com', 'https://aitoolsguide.com', 72, 'ai-directory', 0.00),
('startupaitools.com', 'https://startupaitools.com', 67, 'ai-directory', 0.00),
('airegisters.com', 'https://airegisters.com', 60, 'ai-directory', 0.00),
('aitoolmall.com', 'https://aitoolmall.com', 63, 'ai-directory', 0.00),
('goodaitools.com', 'https://goodaitools.com', 58, 'ai-directory', 0.00),
('aitoolsup.com', 'https://aitoolsup.com', 55, 'ai-directory', 0.00),
('findaitools.co', 'https://findaitools.co', 62, 'ai-directory', 0.00),
('aivalley.ai', 'https://aivalley.ai', 69, 'ai-directory', 0.00),
('betteraitools.com', 'https://betteraitools.com', 64, 'ai-directory', 0.00),
('poweredbyai.app', 'https://poweredbyai.app', 66, 'ai-directory', 0.00),
('topapps.ai', 'https://topapps.ai', 61, 'ai-directory', 0.00),
('toollist.ai', 'https://toollist.ai', 59, 'ai-directory', 0.00),
('aitoolguru.com', 'https://aitoolguru.com', 57, 'ai-directory', 0.00),
('aibest.tools', 'https://aibest.tools', 56, 'ai-directory', 0.00),
('insanelycooltools.com', 'https://insanelycooltools.com', 71, 'ai-directory', 0.00),
('magicbox.tools', 'https://magicbox.tools', 54, 'ai-directory', 0.00),
('nextgentools.me', 'https://nextgentools.me', 53, 'ai-directory', 0.00),
('launched.io', 'https://launched.io', 73, 'startup-directory', 50.00),
('startupstash.com', 'https://startupstash.com', 76, 'startup-directory', 75.00),
('startupbase.io', 'https://startupbase.io', 68, 'startup-directory', 25.00),
('saasworthy.com', 'https://saasworthy.com', 74, 'saas-directory', 100.00),
('tools.so', 'https://tools.so', 65, 'tools-directory', 30.00),
('insidr.ai', 'https://insidr.ai', 62, 'ai-directory', 0.00),
('dang.ai', 'https://dang.ai', 60, 'ai-directory', 0.00),
('whattheai.tech', 'https://whattheai.tech', 58, 'ai-directory', 0.00),
('aitoolbox.tools', 'https://aitoolbox.tools', 55, 'ai-directory', 0.00),
('smartaitools.run', 'https://smartaitools.run', 52, 'ai-directory', 0.00),
('aitooltrek.com', 'https://aitooltrek.com', 54, 'ai-directory', 0.00),
('seektop.ai', 'https://seektop.ai', 51, 'ai-directory', 0.00),
('seekais.com', 'https://seekais.com', 50, 'ai-directory', 0.00),
('aitoolly.com', 'https://aitoolly.com', 49, 'ai-directory', 0.00),
('aiai.tools', 'https://aiai.tools', 53, 'ai-directory', 0.00),
('aidirectory.org', 'https://aidirectory.org', 57, 'ai-directory', 0.00),
('ai-toolify.com', 'https://ai-toolify.com', 56, 'ai-directory', 0.00),
('gptforge.net', 'https://gptforge.net', 55, 'ai-directory', 0.00),
('aitoprank.com', 'https://aitoprank.com', 48, 'ai-directory', 0.00),
('aitooldr.com', 'https://aitooldr.com', 47, 'ai-directory', 0.00),
('flameitup.net', 'https://flameitup.net', 45, 'tools-directory', 0.00),
('creati.ai', 'https://creati.ai', 46, 'ai-directory', 0.00),
('hiaitools.com', 'https://hiaitools.com', 44, 'ai-directory', 0.00),
('aistage.net', 'https://aistage.net', 43, 'ai-directory', 0.00),
('soai.tools', 'https://soai.tools', 42, 'ai-directory', 0.00),
('futur-ia.com', 'https://futur-ia.com/', 41, 'ai-directory', 0.00),
('dokeyai.com', 'https://dokeyai.com', 40, 'ai-directory', 0.00),
('aipure.ai', 'https://aipure.ai', 39, 'ai-directory', 0.00),
('ypforai.com', 'https://ypforai.com', 38, 'ai-directory', 0.00),
('aimonstr.com', 'https://aimonstr.com', 50, 'ai-directory', 0.00),
('promoteproject.com', 'https://promoteproject.com', 65, 'project-directory', 40.00);

-- Wait a moment for triggers to create backlinks, then update some statuses
-- Note: In PostgreSQL, we need to wait for the auto-linking triggers to complete
-- before updating the backlink statuses

-- =============================================
-- Update some backlink statuses to show progress
-- (The backlinks were auto-created by triggers above)
-- =============================================

-- AI Analytics Tools has made good progress
UPDATE backlinks SET 
    status = 'live',
    anchor_text = 'AI Analytics Dashboard',
    target_url = 'https://aianalyticstools.com/dashboard',
    placement_date = '2024-01-15'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'aianalyticstools.com') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'futuretools.io');

UPDATE backlinks SET 
    status = 'live',
    anchor_text = 'Advanced Analytics with AI',
    target_url = 'https://aianalyticstools.com/advanced',
    placement_date = '2024-01-20'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'aianalyticstools.com') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'aitoolnet.com');

UPDATE backlinks SET 
    status = 'requested',
    anchor_text = 'Data Analytics AI Tools',
    target_url = 'https://aianalyticstools.com/tools'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'aianalyticstools.com') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'toolscout.ai');

-- Smart Automation progress
UPDATE backlinks SET 
    status = 'live',
    anchor_text = 'Intelligent Automation Platform',
    target_url = 'https://smartautomation.io/platform',
    placement_date = '2024-01-25'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'smartautomation.io') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'startupaitools.com');

UPDATE backlinks SET 
    status = 'placed',
    anchor_text = 'AI Automation Solutions',
    target_url = 'https://smartautomation.io/solutions',
    placement_date = '2024-02-01'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'smartautomation.io') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'launched.io');

-- NLP Workshop progress  
UPDATE backlinks SET 
    status = 'live',
    anchor_text = 'Natural Language Processing Tools',
    target_url = 'https://nlpworkshop.net/tools',
    placement_date = '2024-01-30'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'nlpworkshop.net') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'aiailist.com');

-- Computer Vision Suite progress
UPDATE backlinks SET 
    status = 'requested',
    anchor_text = 'AI Computer Vision Platform',
    target_url = 'https://computervisionsuite.co/platform'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'computervisionsuite.co') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'aivalley.ai');

UPDATE backlinks SET 
    status = 'live',
    anchor_text = 'Computer Vision AI Tools',
    target_url = 'https://computervisionsuite.co/tools',
    placement_date = '2024-02-05'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'computervisionsuite.co') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'betteraitools.com');

-- AI Writing Assistants progress
UPDATE backlinks SET 
    status = 'placed',
    anchor_text = 'AI Writing and Content Tools',
    target_url = 'https://aiwritingassistants.org/tools',
    placement_date = '2024-02-10'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'aiwritingassistants.org') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'insanelycooltools.com');

-- Some rejected attempts
UPDATE backlinks SET 
    status = 'rejected',
    notes = 'Directory full, not accepting new submissions'
WHERE website_id = (SELECT id FROM websites WHERE domain = 'nlpworkshop.net') 
    AND resource_id = (SELECT id FROM resources WHERE domain = 'aitoprank.com');

-- =============================================
-- Verify the data and auto-linking worked
-- =============================================

-- This should show 5 AI tool websites × 50 real directory resources = 250 total backlink opportunities
-- Uncomment to verify:
/*
SELECT 
    w.domain as website,
    COUNT(b.id) as total_opportunities,
    SUM(CASE WHEN b.status = 'live' THEN 1 ELSE 0 END) as live_backlinks,
    SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) as pending_backlinks
FROM websites w
LEFT JOIN backlinks b ON w.id = b.website_id  
GROUP BY w.id, w.domain
ORDER BY w.domain;

-- View high-value opportunities (DA > 70)
SELECT r.domain, r.domain_authority, r.category, r.cost
FROM resources r
WHERE r.domain_authority > 70
ORDER BY r.domain_authority DESC;
*/ 