-- Insert Real User Websites
-- Based on my-website.txt

-- Clear existing sample data first (optional - remove if you want to keep sample data)
-- DELETE FROM backlinks WHERE website_id IN (SELECT id FROM websites WHERE domain LIKE '%.com' OR domain LIKE '%.io' OR domain LIKE '%.net' OR domain LIKE '%.co');
-- DELETE FROM websites WHERE domain LIKE 'ai%' OR domain LIKE 'smart%' OR domain LIKE 'nlp%' OR domain LIKE 'computer%';

-- Insert real websites
INSERT INTO websites (domain, name, category) VALUES
('muzix.app', 'Muzix - AI Music Platform', 'ai-music'),
('photorater.io', 'PhotoRater - AI Photo Rating', 'ai-photo'),
('soundifytext.io', 'SoundifyText - Text to Speech AI', 'ai-audio'),
('pixfy.io', 'Pixfy - AI Image Processing', 'ai-image')
ON CONFLICT (domain) DO NOTHING;

-- Verify insertion
SELECT 
    domain,
    name,
    category,
    created_at
FROM websites 
WHERE domain IN ('muzix.app', 'photorater.io', 'soundifytext.io', 'pixfy.io')
ORDER BY domain; 