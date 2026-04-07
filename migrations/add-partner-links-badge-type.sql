-- Migration: Add badge support to partner_links
-- Allows partner links to be rendered as image badges instead of text links

ALTER TABLE partner_links ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'link';
ALTER TABLE partner_links ADD COLUMN IF NOT EXISTS image_src TEXT;
ALTER TABLE partner_links ADD COLUMN IF NOT EXISTS image_width INTEGER;
ALTER TABLE partner_links ADD COLUMN IF NOT EXISTS image_height INTEGER;
