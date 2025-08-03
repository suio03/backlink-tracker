/**
 * Database-based Website Extended Info Storage
 * Replaces the JSON file approach for production compatibility
 */

import { query } from '@/lib/database';
import { WebsiteExtendedInfo } from '@/types';

// Read all website extended info
export async function getAllWebsiteInfo(): Promise<WebsiteExtendedInfo[]> {
  try {
    const sql = `
      SELECT 
        website_id,
        support_email,
        title,
        description,
        url,
        updated_at as last_updated
      FROM website_extended_info
      ORDER BY website_id;
    `;
    
    const result = await query(sql);
    
    return result.rows.map(row => ({
      websiteId: row.website_id,
      supportEmail: row.support_email || undefined,
      title: row.title || undefined,
      description: row.description || undefined,
      url: row.url || undefined,
      lastUpdated: row.last_updated
    }));
  } catch (error) {
    console.error('Error reading website info from database:', error);
    return [];
  }
}

// Get extended info for a specific website
export async function getWebsiteInfo(websiteId: number): Promise<WebsiteExtendedInfo | null> {
  try {
    const sql = `
      SELECT 
        website_id,
        support_email,
        title,
        description,
        url,
        updated_at as last_updated
      FROM website_extended_info
      WHERE website_id = $1;
    `;
    
    const result = await query(sql, [websiteId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      websiteId: row.website_id,
      supportEmail: row.support_email || undefined,
      title: row.title || undefined,
      description: row.description || undefined,
      url: row.url || undefined,
      lastUpdated: row.last_updated
    };
  } catch (error) {
    console.error('Error getting website info from database:', error);
    return null;
  }
}

// Create or update website extended info
export async function saveWebsiteInfo(websiteInfo: Omit<WebsiteExtendedInfo, 'lastUpdated'>): Promise<boolean> {
  try {
    const sql = `
      INSERT INTO website_extended_info (website_id, support_email, title, description, url, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (website_id) DO UPDATE SET
        support_email = EXCLUDED.support_email,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        url = EXCLUDED.url,
        updated_at = EXCLUDED.updated_at
      RETURNING website_id;
    `;
    
    const result = await query(sql, [
      websiteInfo.websiteId,
      websiteInfo.supportEmail || null,
      websiteInfo.title || null,
      websiteInfo.description || null,
      websiteInfo.url || null
    ]);
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error saving website info to database:', error);
    return false;
  }
}

// Delete website extended info
export async function deleteWebsiteInfo(websiteId: number): Promise<boolean> {
  try {
    const sql = `
      DELETE FROM website_extended_info 
      WHERE website_id = $1
      RETURNING website_id;
    `;
    
    const result = await query(sql, [websiteId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting website info from database:', error);
    return false;
  }
}

// Batch operations
export async function bulkSaveWebsiteInfo(websiteInfoList: Omit<WebsiteExtendedInfo, 'lastUpdated'>[]): Promise<boolean> {
  try {
    // Use a transaction for bulk operations
    await query('BEGIN');
    
    for (const websiteInfo of websiteInfoList) {
      const sql = `
        INSERT INTO website_extended_info (website_id, support_email, title, description, url, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (website_id) DO UPDATE SET
          support_email = EXCLUDED.support_email,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          url = EXCLUDED.url,
          updated_at = EXCLUDED.updated_at;
      `;
      
      await query(sql, [
        websiteInfo.websiteId,
        websiteInfo.supportEmail || null,
        websiteInfo.title || null,
        websiteInfo.description || null,
        websiteInfo.url || null
      ]);
    }
    
    await query('COMMIT');
    return true;
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error bulk saving website info to database:', error);
    return false;
  }
}