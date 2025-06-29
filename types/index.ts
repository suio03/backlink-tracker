// TypeScript interfaces for Backlink Tracker

// Extended website information stored in JSON
export interface WebsiteExtendedInfo {
  websiteId: number;
  supportEmail?: string;
  title?: string;
  description?: string;
  url?: string;
  lastUpdated: string;
}

export interface Website {
  id: number;
  domain: string;
  name: string;
  category: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Computed fields for UI
  totalOpportunities?: number;
  liveBacklinks?: number;
  pendingBacklinks?: number;
  completionRate?: number;
}

export interface Resource {
  id: number;
  domain: string;
  url: string;
  contact_email?: string;
  domain_authority: number;
  category: string;
  cost: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Backlink {
  id: number;
  website_id: number;
  resource_id: number;
  status: BacklinkStatus;
  anchor_text?: string;
  target_url?: string;
  placement_date?: string;
  removal_date?: string;
  cost?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data for UI
  website?: Website;
  resource?: Resource;
}

export type BacklinkStatus = 
  | 'pending' 
  | 'placed' 
  | 'live' 
  | 'removed' 
  | 'rejected';

// UI-specific interfaces
export interface WebsiteWithStats extends Website {
  totalOpportunities: number;
  liveBacklinks: number;
  pendingBacklinks: number;
  placedBacklinks: number;
  rejectedBacklinks: number;
  completionRate: number;
  lastActivity?: string;
}

export interface BacklinkWithDetails extends Backlink {
  resource: Resource;
  website: Website;
}

// Filter and search interfaces
export interface WebsiteFilters {
  category?: string;
  search?: string;
  minCompletionRate?: number;
}

export interface BacklinkFilters {
  status?: BacklinkStatus[];
  category?: string;
  minDomainAuthority?: number;
  maxCost?: number;
  search?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Bulk operation interfaces
export interface BulkUpdateBacklinks {
  backlink_ids: number[];
  updates: Partial<Pick<Backlink, 'status' | 'anchor_text' | 'target_url' | 'notes'>>;
}

// API response interfaces
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  success: boolean;
  message?: string;
}

// Form interfaces
export interface CreateWebsiteForm {
  domain: string;
  name: string;
  category: string;
}

export interface CreateResourceForm {
  domain: string;
  url: string;
  contact_email?: string;
  domain_authority: number;
  category: string;
  cost: number;
  notes?: string;
}

export interface UpdateBacklinkForm {
  status?: BacklinkStatus;
  anchor_text?: string;
  target_url?: string;
  placement_date?: string;
  removal_date?: string;
  cost?: number;
  notes?: string;
} 