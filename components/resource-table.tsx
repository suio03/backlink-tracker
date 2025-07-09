"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { BacklinkWithDetails, BacklinkStatus, BacklinkFilters } from "@/types";
import { Search, Filter, Edit2, Save, X, MousePointer, Globe, Trash2 } from "lucide-react";

interface ResourceTableProps {
  backlinks: BacklinkWithDetails[];
  onBacklinkUpdate: (id: number, updates: Partial<BacklinkWithDetails>) => void;
  onBulkUpdate?: (ids: number[], updates: Partial<BacklinkWithDetails>) => void;
  onBacklinkDelete?: (id: number) => void;
  isLoading?: boolean;
}

interface EditingState {
  [key: number]: {
    status?: BacklinkStatus;
    domain_authority?: number;
  };
}

export function ResourceTable({ 
  backlinks, 
  onBacklinkUpdate, 
  onBulkUpdate,
  onBacklinkDelete,
  isLoading = false 
}: ResourceTableProps) {
  const [filters, setFilters] = useState<BacklinkFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingRows, setEditingRows] = useState<EditingState>({});
  
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Filter and sort backlinks - placed items go to bottom
  const filteredBacklinks = backlinks.filter(backlink => {
    const matchesSearch = !filters.search || 
      backlink.resource.domain.toLowerCase().includes(filters.search.toLowerCase());
      
    const matchesStatus = !filters.status?.length || 
      filters.status.includes(backlink.status);
      
    const matchesDA = !filters.minDomainAuthority || 
      backlink.resource.domain_authority >= filters.minDomainAuthority;
      
    const matchesCost = !filters.maxCost || 
      backlink.resource.cost <= filters.maxCost;
    
    return matchesSearch && matchesStatus && matchesDA && matchesCost;
  }).sort((a, b) => {
    // Sort placed/live items to bottom, maintain original order within groups
    const aIsPlaced = a.status === 'placed' || a.status === 'live';
    const bIsPlaced = b.status === 'placed' || b.status === 'live';
    
    if (aIsPlaced && !bIsPlaced) return 1;  // a goes after b
    if (!aIsPlaced && bIsPlaced) return -1; // a goes before b
    
    // Within same group, sort by priority and domain authority
    if (!aIsPlaced && !bIsPlaced) {
      // For non-placed: pending first, then by DA desc
      const statusPriority: Record<string, number> = {
        'pending': 1,
        'requested': 2,
        'rejected': 3,
        'removed': 4
      };
      
      const aPriority = statusPriority[a.status] || 5;
      const bPriority = statusPriority[b.status] || 5;
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.resource.domain_authority - a.resource.domain_authority;
    }
    
    // For placed items, sort by domain authority desc
    return b.resource.domain_authority - a.resource.domain_authority;
  });

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBacklinks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBacklinks.map(b => b.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Editing handlers
  const startEditing = (backlink: BacklinkWithDetails) => {
    setEditingRows(prev => ({
      ...prev,
      [backlink.id]: {
        status: backlink.status,
        domain_authority: backlink.resource.domain_authority,
      }
    }));
  };

  const cancelEditing = (id: number) => {
    setEditingRows(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const saveEditing = async (id: number) => {
    const edits = editingRows[id];
    if (!edits) return;

    const backlink = filteredBacklinks.find(b => b.id === id);
    if (!backlink) return;

    try {
      // Handle domain authority update (resource-level)
      if (edits.domain_authority !== undefined && edits.domain_authority !== backlink.resource.domain_authority) {
        const response = await fetch(`/api/resources/${backlink.resource.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            domain_authority: edits.domain_authority,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          alert(`Failed to update domain authority: ${result.message}`);
          return;
        }
      }

      // Handle backlink-level updates (status, etc.)
      const backlinkUpdates: Partial<BacklinkWithDetails> = {};
      if (edits.status !== undefined && edits.status !== backlink.status) {
        backlinkUpdates.status = edits.status;
      }

      if (Object.keys(backlinkUpdates).length > 0) {
        onBacklinkUpdate(id, backlinkUpdates);
      }

      // Cancel editing mode
      cancelEditing(id);

      // Refresh the page to show updated DA across all backlinks
      if (edits.domain_authority !== undefined && edits.domain_authority !== backlink.resource.domain_authority) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const updateEditing = (id: number, value: BacklinkStatus) => {
    setEditingRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: value
      }
    }));
  };

  const updateEditingDA = (id: number, value: number) => {
    setEditingRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        domain_authority: value
      }
    }));
  };

  // Quick selection functions - focus on non-placed backlinks
  const getNonPlacedBacklinks = () => {
    return filteredBacklinks.filter(b => b.status !== 'placed' && b.status !== 'live');
  };

  const selectFirst5 = () => {
    const nonPlaced = getNonPlacedBacklinks();
    const first5Ids = nonPlaced.slice(0, 5).map(b => b.id);
    setSelectedIds(new Set(first5Ids));
  };

  const selectLast5 = () => {
    const nonPlaced = getNonPlacedBacklinks();
    const last5Ids = nonPlaced.slice(-5).map(b => b.id);
    setSelectedIds(new Set(last5Ids));
  };

  const selectFirst10 = () => {
    const nonPlaced = getNonPlacedBacklinks();
    const first10Ids = nonPlaced.slice(0, 10).map(b => b.id);
    setSelectedIds(new Set(first10Ids));
  };

  const selectLast10 = () => {
    const nonPlaced = getNonPlacedBacklinks();
    const last10Ids = nonPlaced.slice(-10).map(b => b.id);
    setSelectedIds(new Set(last10Ids));
  };

  const selectAllNonPlaced = () => {
    const nonPlaced = getNonPlacedBacklinks();
    const nonPlacedIds = nonPlaced.map(b => b.id);
    setSelectedIds(new Set(nonPlacedIds));
  };

  // Open selected backlinks in new tabs (without changing status)
  const openSelectedBacklinks = () => {
    const selectedBacklinks = filteredBacklinks.filter(b => selectedIds.has(b.id));
    const validBacklinks = selectedBacklinks.filter(b => b.resource.url);
    
    if (validBacklinks.length === 0) {
      alert('No valid URLs found in selected backlinks.');
      return;
    }

    // Open URLs with delay to prevent popup blocker
    validBacklinks.forEach((backlink, index) => {
      setTimeout(() => {
        window.open(backlink.resource.url, '_blank', 'noopener,noreferrer');
      }, index * 100); // 100ms delay between each tab
    });

    // Show confirmation
    const invalidUrls = selectedBacklinks.length - validBacklinks.length;
    
    if (invalidUrls > 0) {
      alert(`Opening ${validBacklinks.length} tabs. ${invalidUrls} backlinks had no URL.`);
    } else {
      console.log(`Opening ${validBacklinks.length} tabs for review.`);
    }
  };

  // Open selected backlinks and mark as placed
  const openAndMarkPlaced = () => {
    const selectedBacklinks = filteredBacklinks.filter(b => selectedIds.has(b.id));
    const validBacklinks = selectedBacklinks.filter(b => b.resource.url);
    
    if (validBacklinks.length === 0) {
      alert('No valid URLs found in selected backlinks.');
      return;
    }

    // Open URLs with delay to prevent popup blocker
    const openedBacklinks: number[] = [];
    validBacklinks.forEach((backlink, index) => {
      setTimeout(() => {
        window.open(backlink.resource.url, '_blank', 'noopener,noreferrer');
      }, index * 100); // 100ms delay between each tab
      openedBacklinks.push(backlink.id);
    });

    // Auto-mark opened backlinks as "placed"
    if (openedBacklinks.length > 0 && onBulkUpdate) {
      onBulkUpdate(openedBacklinks, { status: 'placed' });
    }

    // Clear selection
    setSelectedIds(new Set());

    // Show confirmation
    const invalidUrls = selectedBacklinks.length - validBacklinks.length;
    
    if (invalidUrls > 0) {
      alert(`Opening ${validBacklinks.length} tabs and marked them as "Placed". ${invalidUrls} backlinks had no URL.`);
    } else {
      console.log(`Opening ${validBacklinks.length} tabs and marked them as "Placed".`);
    }
  };

  // Delete individual backlink
  const handleDeleteBacklink = async (backlinkId: number) => {
    const backlink = filteredBacklinks.find(b => b.id === backlinkId);
    if (!backlink) return;

    const confirmMessage = `Are you sure you want to delete this backlink from "${backlink.resource.domain}"?\n\nThis will only remove the backlink relationship for this website, not the resource itself.\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/backlinks/${backlinkId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Call the parent callback to update the UI
        if (onBacklinkDelete) {
          onBacklinkDelete(backlinkId);
        } else {
          // Fallback: refresh the page
          window.location.reload();
        }
      } else {
        alert(`Failed to delete backlink: ${result.message}`);
      }
    } catch (error) {
      console.error('Error deleting backlink:', error);
      alert('Failed to delete backlink. Please try again.');
    }
  };

  // Delete selected resources (for broken/non-working links)
  const deleteSelectedResources = async () => {
    const selectedBacklinks = filteredBacklinks.filter(b => selectedIds.has(b.id));
    const uniqueResourceIds = [...new Set(selectedBacklinks.map(b => b.resource.id))];
    
    if (uniqueResourceIds.length === 0) return;

    // Get unique resource domains for confirmation
    const selectedResources = selectedBacklinks.reduce((acc, backlink) => {
      if (!acc.find(r => r.id === backlink.resource.id)) {
        acc.push(backlink.resource);
      }
      return acc;
    }, [] as Array<{id: number, domain: string}>);

    const resourceList = selectedResources.map(r => `• ${r.domain}`).join('\n');
    const confirmMessage = `Are you sure you want to delete ${uniqueResourceIds.length} resource(s)?\n\nResources to be deleted:\n${resourceList}\n\nThis will permanently remove these resources and all their backlinks from the system for ALL websites.\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Delete each resource
      const deletePromises = uniqueResourceIds.map(resourceId =>
        fetch(`/api/resources/${resourceId}`, {
          method: 'DELETE',
        })
      );

      const responses = await Promise.all(deletePromises);
      const results = await Promise.all(responses.map(r => r.json()));

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        // Refresh the page to show updated data
        window.location.reload();
      }

      // Clear selection
      setSelectedIds(new Set());

      // Show results
      if (failureCount > 0) {
        alert(`Deleted ${successCount} resources successfully. ${failureCount} failed to delete.`);
      } else {
        alert(`Successfully deleted ${successCount} resource(s) and all their backlinks.`);
      }

    } catch (error) {
      console.error('Error deleting resources:', error);
      alert('Failed to delete resources. Please try again.');
    }
  };

  // Bulk operations
  const handleBulkStatusUpdate = (status: BacklinkStatus) => {
    if (onBulkUpdate && selectedIds.size > 0) {
      onBulkUpdate(Array.from(selectedIds), { status });
      setSelectedIds(new Set());
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Loading filters */}
        <div className="flex gap-4">
          <div className="h-10 bg-gray-200 rounded animate-pulse flex-1" />
          <div className="h-10 bg-gray-200 rounded animate-pulse w-32" />
          <div className="h-10 bg-gray-200 rounded animate-pulse w-32" />
        </div>
        {/* Loading table */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search resources by domain..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Search
          </button>
        </div>
        
        <Select
          value={filters.status?.[0] || "all"}
          onValueChange={(value) => setFilters(prev => ({ 
            ...prev, 
            status: value === "all" ? undefined : [value as BacklinkStatus]
          }))}
        >
          <SelectTrigger className="w-32">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="placed">Placed</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.minDomainAuthority?.toString() || "0"}
          onValueChange={(value) => setFilters(prev => ({ 
            ...prev, 
            minDomainAuthority: value === "0" ? undefined : Number(value)
          }))}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Min DA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any DA</SelectItem>
            <SelectItem value="40">DA 40+</SelectItem>
            <SelectItem value="60">DA 60+</SelectItem>
            <SelectItem value="80">DA 80+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick Selection Toolbar */}
      {filteredBacklinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-sm font-medium text-gray-700 mr-2">Quick Select (Non-Placed):</span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={selectFirst5}
            disabled={getNonPlacedBacklinks().length === 0}
            className="text-xs"
          >
            <MousePointer className="h-3 w-3 mr-1" />
            Top 5
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={selectLast5}
            disabled={getNonPlacedBacklinks().length === 0}
            className="text-xs"
          >
            <MousePointer className="h-3 w-3 mr-1" />
            Last 5
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={selectFirst10}
            disabled={getNonPlacedBacklinks().length === 0}
            className="text-xs"
          >
            <MousePointer className="h-3 w-3 mr-1" />
            Top 10
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={selectLast10}
            disabled={getNonPlacedBacklinks().length === 0}
            className="text-xs"
          >
            <MousePointer className="h-3 w-3 mr-1" />
            Last 10
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={selectAllNonPlaced}
            disabled={getNonPlacedBacklinks().length === 0}
            className="text-xs"
          >
            All Non-Placed ({getNonPlacedBacklinks().length})
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={toggleSelectAll}
            disabled={filteredBacklinks.length === 0}
            className="text-xs bg-blue-50 border-blue-200"
          >
            {selectedIds.size === filteredBacklinks.length && filteredBacklinks.length > 0 
              ? "Deselect All" 
              : `All Items (${filteredBacklinks.length})`
            }
          </Button>
          {selectedIds.size > 0 && (
            <div className="ml-auto">
              <span className="text-sm text-blue-600 font-medium">
                {selectedIds.size} selected
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2 ml-4">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleBulkStatusUpdate('placed')}
            >
              Mark as Placed
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={openSelectedBacklinks}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Globe className="h-3 w-3 mr-1" />
              Open Selected
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={openAndMarkPlaced}
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <Globe className="h-3 w-3 mr-1" />
              Open & Mark Placed
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={deleteSelectedResources}
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete Resources
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>{filteredBacklinks.length} backlink opportunities</span>
        <div className="flex gap-4">
          <span>Non-Placed: {getNonPlacedBacklinks().length}</span>
          <span>Placed: {filteredBacklinks.filter(b => b.status === 'placed').length}</span>
          <span>Live: {filteredBacklinks.filter(b => b.status === 'live').length}</span>
          <span>Pending: {filteredBacklinks.filter(b => b.status === 'pending').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredBacklinks.length && filteredBacklinks.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>DA</TableHead>
              <TableHead>Backlink Actions</TableHead>
              <TableHead>Status Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBacklinks.map((backlink) => {
              const isEditing = editingRows[backlink.id];
              return (
                <TableRow key={backlink.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(backlink.id)}
                      onChange={() => toggleSelect(backlink.id)}
                      className="rounded"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium"><a href={backlink.resource.url} target="_blank" rel="noopener noreferrer">{backlink.resource.domain}</a></div>
                      <div className="text-sm text-gray-500">{backlink.resource.category}</div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {isEditing ? (
                      <Select
                        value={isEditing.status}
                        onValueChange={(value) => updateEditing(backlink.id, value as BacklinkStatus)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="placed">Placed</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge status={backlink.status} />
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={isEditing.domain_authority || 0}
                        onChange={(e) => updateEditingDA(backlink.id, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="DA"
                      />
                    ) : (
                      <Badge variant="outline">
                        {backlink.resource.domain_authority}
                      </Badge>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => startEditing(backlink)}
                        className="text-xs"
                        title="Edit backlink"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteBacklink(backlink.id)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete backlink"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => saveEditing(backlink.id)}
                          title="Save status changes"
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => cancelEditing(backlink.id)}
                          title="Cancel status changes"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredBacklinks.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No backlinks found</h3>
          <p className="text-gray-600">
            {filters.search || filters.status?.length 
              ? "Try adjusting your filters to see more results."
              : "No backlink opportunities available for this website."
            }
          </p>
        </div>
      )}
    </div>
  );
} 