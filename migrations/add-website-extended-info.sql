-- Migration: Add website_extended_info table
-- This replaces the JSON file storage with proper database storage

CREATE TABLE IF NOT EXISTS website_extended_info (
    id SERIAL PRIMARY KEY,
    website_id INTEGER NOT NULL UNIQUE,
    support_email TEXT,
    title TEXT,
    description TEXT,
    url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
);

-- Create indexes for better performance
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_website_extended_info_website_id') THEN
        CREATE INDEX idx_website_extended_info_website_id ON website_extended_info(website_id);
    END IF;
END $$;

-- Migrate existing data from JSON file (if any)
-- This would need to be run manually with the current JSON data