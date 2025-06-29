import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WebsiteCard } from "./website-card";
import { WebsiteWithStats, WebsiteFilters } from "@/types";
import { Search, Filter } from "lucide-react";

interface WebsiteGridProps {
  websites: WebsiteWithStats[];
  onWebsiteSelect: (website: WebsiteWithStats) => void;
  isLoading?: boolean;
}

export function WebsiteGrid({ websites, onWebsiteSelect, isLoading = false }: WebsiteGridProps) {
  const [filters, setFilters] = useState<WebsiteFilters>({});
  
  // Get unique categories for filter dropdown
  const categories = Array.from(new Set(websites.map(w => w.category)));
  
  // Filter websites based on current filters
  const filteredWebsites = websites.filter(website => {
    const matchesSearch = !filters.search || 
      website.domain.toLowerCase().includes(filters.search.toLowerCase()) ||
      website.name.toLowerCase().includes(filters.search.toLowerCase());
      
    const matchesCategory = !filters.category || website.category === filters.category;
    
    const matchesCompletionRate = !filters.minCompletionRate || 
      website.completionRate >= filters.minCompletionRate;
    
    return matchesSearch && matchesCategory && matchesCompletionRate;
  });
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading state for filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="h-10 bg-gray-200 rounded animate-pulse flex-1" />
          <div className="h-10 bg-gray-200 rounded animate-pulse w-40" />
          <div className="h-10 bg-gray-200 rounded animate-pulse w-40" />
        </div>
        
        {/* Loading state for grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔥 My Websites</h1>
          <p className="text-gray-600 mt-1">
            Manage backlinks across {websites.length} websites
          </p>
          {websites.length > 0 && (
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span>
                📊 {websites.reduce((acc, w) => acc + w.totalOpportunities, 0)} total opportunities
              </span>
              <span>
                ✅ {websites.reduce((acc, w) => acc + w.placedBacklinks, 0)} placed
              </span>
              <span>
                ⏳ {websites.reduce((acc, w) => acc + w.pendingBacklinks, 0)} pending
              </span>
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-500">
          {filteredWebsites.length} of {websites.length} websites
        </div>
      </div>
      
      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search websites by domain or name..."
            value={filters.search || ""}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10"
          />
        </div>
        
        {/* Category Filter */}
        <Select
          value={filters.category || "all"}
          onValueChange={(value) => setFilters(prev => ({ 
            ...prev, 
            category: value === "all" ? undefined : value 
          }))}
        >
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Completion Rate Filter */}
        <Select
          value={filters.minCompletionRate?.toString() || "0"}
          onValueChange={(value) => setFilters(prev => ({ 
            ...prev, 
            minCompletionRate: value === "0" ? undefined : Number(value)
          }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Progress" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any Progress</SelectItem>
            <SelectItem value="25">25%+ Complete</SelectItem>
            <SelectItem value="50">50%+ Complete</SelectItem>
            <SelectItem value="75">75%+ Complete</SelectItem>
            <SelectItem value="90">90%+ Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Website Grid */}
      {filteredWebsites.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No websites found</h3>
          <p className="text-gray-600">
            {filters.search || filters.category || filters.minCompletionRate 
              ? "Try adjusting your filters to see more results."
              : "Add your first website to get started with backlink tracking."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredWebsites.map((website) => (
            <WebsiteCard
              key={website.id}
              website={website}
              onClick={() => onWebsiteSelect(website)}
            />
          ))}
        </div>
      )}
    </div>
  );
} 