-- Cloudflare D1 Database Schema for Backlink Tracker
-- SQLite-based schema with auto-linking triggers

-- =============================================
-- Table: websites
-- Stores all user's websites that need backlinks
-- =============================================
CREATE TABLE IF NOT EXISTS websites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- Table: resources  
-- Stores all backlink opportunities/resources
-- =============================================
CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    url TEXT,
    contact_email TEXT,
    domain_authority INTEGER,
    category TEXT,
    cost REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- Table: backlinks
-- Junction table tracking website-resource relationships
-- =============================================
CREATE TABLE IF NOT EXISTS backlinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'requested', 'placed', 'live', 'removed', 'rejected')),
    anchor_text TEXT,
    target_url TEXT,
    placement_date DATE,
    removal_date DATE,
    cost REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
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
-- Trigger: Auto-add new resource to all active websites
-- When a new resource is added, create backlink entries for all active websites
-- =============================================
CREATE TRIGGER IF NOT EXISTS auto_add_resource_to_websites
    AFTER INSERT ON resources
    WHEN NEW.is_active = TRUE
BEGIN
    INSERT INTO backlinks (website_id, resource_id, status)
    SELECT id, NEW.id, 'pending'
    FROM websites 
    WHERE is_active = TRUE;
END;

-- =============================================
-- Trigger: Auto-add all active resources to new website
-- When a new website is added, create backlink entries for all active resources
-- =============================================
CREATE TRIGGER IF NOT EXISTS auto_add_resources_to_website
    AFTER INSERT ON websites
    WHEN NEW.is_active = TRUE
BEGIN
    INSERT INTO backlinks (website_id, resource_id, status)
    SELECT NEW.id, id, 'pending'
    FROM resources 
    WHERE is_active = TRUE;
END;

-- =============================================
-- Trigger: Update timestamps on websites
-- =============================================
CREATE TRIGGER IF NOT EXISTS update_websites_timestamp
    AFTER UPDATE ON websites
BEGIN
    UPDATE websites SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =============================================
-- Trigger: Update timestamps on resources
-- =============================================
CREATE TRIGGER IF NOT EXISTS update_resources_timestamp
    AFTER UPDATE ON resources
BEGIN
    UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =============================================
-- Trigger: Update timestamps on backlinks
-- =============================================
CREATE TRIGGER IF NOT EXISTS update_backlinks_timestamp
    AFTER UPDATE ON backlinks
BEGIN
    UPDATE backlinks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END; 