/**
 * Database Query Functions
 * Handles all database operations for the backlink tracker
 */

import { query } from './database';
import { Website, WebsiteWithStats, BacklinkWithDetails } from '@/types';

// Database row types
interface WebsiteStatsRow {
  id: number;
  domain: string;
  name: string;
  category: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  total_opportunities: string;
  live_backlinks: string;
  pending_backlinks: string;
  placed_backlinks: string;
  rejected_backlinks: string;
  completion_rate: string;
  last_activity: string;
}



/**
 * Get all websites with their statistics
 */
export async function getWebsitesWithStats(): Promise<WebsiteWithStats[]> {
  const sql = `
    SELECT 
      w.*,
      COUNT(b.id) as total_opportunities,
      COUNT(CASE WHEN b.status = 'live' THEN 1 END) as live_backlinks,
      COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_backlinks,
              COUNT(CASE WHEN b.status = 'placed' THEN 1 END) as placed_backlinks,
      COUNT(CASE WHEN b.status = 'rejected' THEN 1 END) as rejected_backlinks,
      CASE 
        WHEN COUNT(b.id) > 0 
        THEN ROUND(COUNT(CASE WHEN b.status = 'placed' THEN 1 END) * 100.0 / COUNT(b.id), 1)
        ELSE 0 
      END as completion_rate,
      MAX(b.updated_at) as last_activity
    FROM websites w
    LEFT JOIN backlinks b ON w.id = b.website_id
    WHERE w.is_active = true
    GROUP BY w.id, w.domain, w.name, w.category, w.created_at, w.updated_at, w.is_active
    ORDER BY w.name;
  `;

  const result = await query(sql);
  
  return result.rows.map((row: WebsiteStatsRow) => ({
    id: row.id,
    domain: row.domain,
    name: row.name,
    category: row.category,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_active: row.is_active,
    totalOpportunities: parseInt(row.total_opportunities) || 0,
    liveBacklinks: parseInt(row.live_backlinks) || 0,
    pendingBacklinks: parseInt(row.pending_backlinks) || 0,
          placedBacklinks: parseInt(row.placed_backlinks) || 0,
    rejectedBacklinks: parseInt(row.rejected_backlinks) || 0,
    completionRate: parseFloat(row.completion_rate) || 0,
    lastActivity: row.last_activity
  }));
}

/**
 * Get website by ID
 */
export async function getWebsiteById(id: number): Promise<Website | null> {
  const sql = `
    SELECT * FROM websites 
    WHERE id = $1 AND is_active = true;
  `;

  const result = await query(sql, [id]);
  
  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Get backlinks for a specific website with resource details
 */
export async function getBacklinksByWebsiteId(websiteId: number): Promise<BacklinkWithDetails[]> {
  const sql = `
    SELECT 
      b.*,
      r.domain as resource_domain,
      r.url as resource_url,
      r.domain_authority,
      r.category as resource_category,
      r.contact_email,
      r.notes as resource_notes,
      w.domain as website_domain,
      w.name as website_name
    FROM backlinks b
    JOIN resources r ON b.resource_id = r.id
    JOIN websites w ON b.website_id = w.id
    WHERE b.website_id = $1 AND r.is_active = true
    ORDER BY 
      CASE b.status 
        WHEN 'live' THEN 1
        WHEN 'placed' THEN 2
        WHEN 'pending' THEN 3
        WHEN 'rejected' THEN 5
        WHEN 'removed' THEN 6
        ELSE 7
      END,
      r.domain_authority DESC,
      r.domain;
  `;

  const result = await query(sql, [websiteId]);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((row: Record<string, any>): BacklinkWithDetails => ({
    id: row.id,
    website_id: row.website_id,
    resource_id: row.resource_id,
    status: row.status,
    anchor_text: row.anchor_text || undefined,
    target_url: row.target_url || undefined,
    placement_date: row.placement_date || undefined,
    removal_date: row.removal_date || undefined,
    cost: parseFloat(row.cost) || 0,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resource: {
      id: row.resource_id,
      domain: row.resource_domain,
      url: row.resource_url,
      contact_email: row.contact_email || undefined,
      domain_authority: parseInt(row.domain_authority) || 0,
      category: row.resource_category,
      cost: parseFloat(row.cost) || 0,
      notes: row.resource_notes || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_active: true
    },
    website: {
      id: row.website_id,
      domain: row.website_domain,
      name: row.website_name,
      category: row.category,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_active: true
    }
  }));
}

/**
 * Update backlink status and details
 */
export async function updateBacklink(
  id: number, 
  updates: {
    status?: string;
    anchor_text?: string;
    target_url?: string;
    placement_date?: string;
    removal_date?: string;
    cost?: number;
    notes?: string;
  }
): Promise<boolean> {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  });

  if (fields.length === 0) {
    return false;
  }

  // Add updated_at
  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  const sql = `
    UPDATE backlinks 
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id;
  `;

  values.push(id);

  try {
    const result = await query(sql, values);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error updating backlink:', error);
    return false;
  }
}

/**
 * Get summary statistics for dashboard
 */
export async function getDashboardStats(): Promise<{
  totalWebsites: number;
  totalResources: number;
  totalOpportunities: number;
  liveBacklinks: number;
  averageCompletionRate: number;
}> {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM websites WHERE is_active = true) as total_websites,
      (SELECT COUNT(*) FROM resources WHERE is_active = true) as total_resources,
      COUNT(b.id) as total_opportunities,
      COUNT(CASE WHEN b.status = 'live' THEN 1 END) as live_backlinks,
      CASE 
        WHEN COUNT(b.id) > 0 
        THEN ROUND(COUNT(CASE WHEN b.status = 'live' THEN 1 END) * 100.0 / COUNT(b.id), 1)
        ELSE 0 
      END as average_completion_rate
    FROM backlinks b
    JOIN websites w ON b.website_id = w.id
    JOIN resources r ON b.resource_id = r.id
    WHERE w.is_active = true AND r.is_active = true;
  `;

  const result = await query(sql);
  const row = result.rows[0];

  return {
    totalWebsites: parseInt(row.total_websites) || 0,
    totalResources: parseInt(row.total_resources) || 0,
    totalOpportunities: parseInt(row.total_opportunities) || 0,
    liveBacklinks: parseInt(row.live_backlinks) || 0,
    averageCompletionRate: parseFloat(row.average_completion_rate) || 0
  };
} 