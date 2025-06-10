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
import { Search, Filter, Edit2, Save, X, ExternalLink } from "lucide-react";

interface ResourceTableProps {
  backlinks: BacklinkWithDetails[];
  onBacklinkUpdate: (id: number, updates: Partial<BacklinkWithDetails>) => void;
  onBulkUpdate?: (ids: number[], updates: Partial<BacklinkWithDetails>) => void;
  isLoading?: boolean;
}

interface EditingState {
  [key: number]: {
    anchor_text?: string;
    target_url?: string;
    status?: BacklinkStatus;
  };
}

export function ResourceTable({ 
  backlinks, 
  onBacklinkUpdate, 
  onBulkUpdate,
  isLoading = false 
}: ResourceTableProps) {
  const [filters, setFilters] = useState<BacklinkFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingRows, setEditingRows] = useState<EditingState>({});
  
  // Filter backlinks
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
        anchor_text: backlink.anchor_text || "",
        target_url: backlink.target_url || "",
        status: backlink.status,
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

  const saveEditing = (id: number) => {
    const edits = editingRows[id];
    if (edits) {
      onBacklinkUpdate(id, edits);
      cancelEditing(id);
    }
  };

  const updateEditing = (id: number, field: string, value: string) => {
    setEditingRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      }
    }));
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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search resources by domain..."
            value={filters.search || ""}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10"
          />
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
              onClick={() => handleBulkStatusUpdate('requested')}
            >
              Mark as Requested
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleBulkStatusUpdate('live')}
            >
              Mark as Live
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
              <TableHead>Anchor Text</TableHead>
              <TableHead>Target URL</TableHead>
              <TableHead>DA</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Actions</TableHead>
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
                      <div className="font-medium">{backlink.resource.domain}</div>
                      <div className="text-sm text-gray-500">{backlink.resource.category}</div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {isEditing ? (
                      <Select
                        value={isEditing.status}
                        onValueChange={(value) => updateEditing(backlink.id, 'status', value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="requested">Requested</SelectItem>
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
                      <Input
                        value={isEditing.anchor_text}
                        onChange={(e) => updateEditing(backlink.id, 'anchor_text', e.target.value)}
                        placeholder="Enter anchor text..."
                        className="w-40"
                      />
                    ) : (
                      <span className="text-sm">
                        {backlink.anchor_text || (
                          <span className="text-gray-400 italic">No anchor text</span>
                        )}
                      </span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={isEditing.target_url}
                        onChange={(e) => updateEditing(backlink.id, 'target_url', e.target.value)}
                        placeholder="Enter target URL..."
                        className="w-48"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {backlink.target_url ? (
                          <>
                            <span className="text-sm text-blue-600 truncate max-w-32">
                              {backlink.target_url}
                            </span>
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          </>
                        ) : (
                          <span className="text-gray-400 italic text-sm">No URL</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant="outline">
                      {backlink.resource.domain_authority}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <span className="text-sm">
                      {backlink.resource.cost > 0 ? `$${backlink.resource.cost}` : 'Free'}
                    </span>
                  </TableCell>
                  
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => saveEditing(backlink.id)}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => cancelEditing(backlink.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => startEditing(backlink)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
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