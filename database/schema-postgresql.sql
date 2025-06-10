-- PostgreSQL Database Schema for Backlink Tracker
-- Converted from SQLite to PostgreSQL

-- =============================================
-- Table: websites
-- Stores all user's websites that need backlinks
-- =============================================
CREATE TABLE IF NOT EXISTS websites (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- Table: resources  
-- Stores all backlink opportunities/resources
-- =============================================
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    url TEXT,
    contact_email VARCHAR(255),
    domain_authority INTEGER,
    category VARCHAR(100),
    cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- Table: backlinks
-- Junction table tracking website-resource relationships
-- =============================================
CREATE TABLE IF NOT EXISTS backlinks (
    id SERIAL PRIMARY KEY,
    website_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'requested', 'placed', 'live', 'removed', 'rejected')),
    anchor_text TEXT,
    target_url TEXT,
    placement_date DATE,
    removal_date DATE,
    cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    UNIQUE (website_id, resource_id)
);

-- =============================================
-- Indexes for better performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_websites_domain ON websites(domain);
CREATE INDEX IF NOT EXISTS idx_websites_active ON websites(is_active);
CREATE INDEX IF NOT EXISTS idx_resources_domain ON resources(domain);
CREATE INDEX IF NOT EXISTS idx_resources_active ON resources(is_active);
CREATE INDEX IF NOT EXISTS idx_resources_da ON resources(domain_authority);
CREATE INDEX IF NOT EXISTS idx_backlinks_website ON backlinks(website_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_resource ON backlinks(resource_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_status ON backlinks(status);
CREATE INDEX IF NOT EXISTS idx_backlinks_website_status ON backlinks(website_id, status);

-- =============================================
-- Function: Update timestamps
-- PostgreSQL equivalent of SQLite triggers
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- Triggers: Update timestamps automatically
-- =============================================
CREATE TRIGGER update_websites_updated_at 
    BEFORE UPDATE ON websites 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at 
    BEFORE UPDATE ON resources 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlinks_updated_at 
    BEFORE UPDATE ON backlinks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Function: Auto-add new resource to all active websites
-- =============================================
CREATE OR REPLACE FUNCTION auto_add_resource_to_websites()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        INSERT INTO backlinks (website_id, resource_id, status)
        SELECT id, NEW.id, 'pending'
        FROM websites 
        WHERE is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- Function: Auto-add all active resources to new website
-- =============================================
CREATE OR REPLACE FUNCTION auto_add_resources_to_website()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        INSERT INTO backlinks (website_id, resource_id, status)
        SELECT NEW.id, id, 'pending'
        FROM resources 
        WHERE is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- Triggers: Auto-linking functionality
-- =============================================
CREATE TRIGGER auto_add_resource_to_websites_trigger
    AFTER INSERT ON resources
    FOR EACH ROW
    EXECUTE FUNCTION auto_add_resource_to_websites();

CREATE TRIGGER auto_add_resources_to_website_trigger
    AFTER INSERT ON websites
    FOR EACH ROW
    EXECUTE FUNCTION auto_add_resources_to_website(); 