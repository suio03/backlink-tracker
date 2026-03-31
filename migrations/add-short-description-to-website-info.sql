-- Migration: Add short_description column to website_extended_info table

ALTER TABLE website_extended_info ADD COLUMN IF NOT EXISTS short_description TEXT;
