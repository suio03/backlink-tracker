-- Migration: Add image_alt support to partner_links
-- Allows custom alt text for badge images (needed for publisher badge verification)

ALTER TABLE partner_links ADD COLUMN IF NOT EXISTS image_alt TEXT;
