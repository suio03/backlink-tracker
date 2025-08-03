#!/usr/bin/env node
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('supabase.co') 
      ? { rejectUnauthorized: false } 
      : false
  });

  try {
    console.log('🚀 Running website_extended_info migration...\n');

    // Check if table already exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'website_extended_info'
      );
    `);

    if (checkTable.rows[0].exists) {
      console.log('✅ Table already exists, skipping creation');
    } else {
      // Create table
      await pool.query(`
        CREATE TABLE website_extended_info (
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
      `);

      // Create index
      await pool.query(`
        CREATE INDEX idx_website_extended_info_website_id ON website_extended_info(website_id);
      `);

      console.log('✅ Table created successfully');
    }

    // Migrate existing JSON data if it exists
    try {
      const jsonPath = path.join(__dirname, 'data', 'website-info.json');
      if (fs.existsSync(jsonPath)) {
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        for (const website of jsonData.websites) {
          await pool.query(`
            INSERT INTO website_extended_info (website_id, support_email, title, description, url, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (website_id) DO UPDATE SET
              support_email = EXCLUDED.support_email,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              url = EXCLUDED.url,
              updated_at = EXCLUDED.updated_at
          `, [
            website.websiteId,
            website.supportEmail || null,
            website.title || null,
            website.description || null,
            website.url || null,
            new Date(website.lastUpdated)
          ]);
        }
        
        console.log(`✅ Migrated ${jsonData.websites.length} website info records`);
      } else {
        console.log('ℹ️  No existing JSON data found');
      }
    } catch (jsonError) {
      console.log('⚠️  JSON migration failed (non-critical):', jsonError.message);
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);