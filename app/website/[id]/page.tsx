"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { ResourceTable } from "@/components/resource-table";
import { WebsiteWithStats, BacklinkWithDetails, Resource } from "@/types";

// Mock data - will be replaced with real API calls
const mockWebsite: WebsiteWithStats = {
  id: 1,
  domain: "aianalyticstools.com",
  name: "AI Analytics Tools",
  category: "ai-analytics",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-15T00:00:00Z",
  is_active: true,
  totalOpportunities: 50,
  liveBacklinks: 12,
  pendingBacklinks: 25,
  requestedBacklinks: 8,
  rejectedBacklinks: 5,
  completionRate: 24,
  lastActivity: "2024-01-15T00:00:00Z",
};

const mockResources: Resource[] = [
  {
    id: 1,
    domain: "futuretools.io",
    url: "https://futuretools.io",
    domain_authority: 85,
    category: "ai-directory",
    cost: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    is_active: true,
  },
  {
    id: 2,
    domain: "aitoolnet.com", 
    url: "https://aitoolnet.com",
    domain_authority: 75,
    category: "ai-directory",
    cost: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    is_active: true,
  },
  {
    id: 3,
    domain: "toolscout.ai",
    url: "https://toolscout.ai", 
    domain_authority: 68,
    category: "ai-directory",
    cost: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    is_active: true,
  },
  {
    id: 4,
    domain: "launched.io",
    url: "https://launched.io",
    domain_authority: 73,
    category: "startup-directory", 
    cost: 50,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    is_active: true,
  },
  {
    id: 5,
    domain: "startupstash.com",
    url: "https://startupstash.com",
    domain_authority: 76,
    category: "startup-directory",
    cost: 75,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    is_active: true,
  },
];

// Generate mock backlinks for the selected website
const generateMockBacklinks = (websiteId: number): BacklinkWithDetails[] => {
  return mockResources.map((resource, index) => ({
    id: index + 1,
    website_id: websiteId,
    resource_id: resource.id,
    status: index === 0 ? "live" : 
           index === 1 ? "live" :
           index === 2 ? "requested" :
           index === 3 ? "placed" : "pending",
    anchor_text: index === 0 ? "AI Analytics Dashboard" :
                index === 1 ? "Advanced Analytics with AI" :
                index === 2 ? "Data Analytics AI Tools" : undefined,
    target_url: index === 0 ? "https://aianalyticstools.com/dashboard" :
               index === 1 ? "https://aianalyticstools.com/advanced" :
               index === 2 ? "https://aianalyticstools.com/tools" : undefined,
    placement_date: index < 2 ? "2024-01-15" : undefined,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
    website: mockWebsite,
    resource: resource,
  }));
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function WebsiteResourcesPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [website, setWebsite] = useState<WebsiteWithStats | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call to fetch website and backlinks
    const fetchData = async () => {
      setIsLoading(true);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In real app, fetch based on resolvedParams.id
      const websiteData = mockWebsite;
      const backlinksData = generateMockBacklinks(Number(resolvedParams.id));
      
      setWebsite(websiteData);
      setBacklinks(backlinksData);
      setIsLoading(false);
    };

    fetchData();
  }, [resolvedParams.id]);

  const handleBacklinkUpdate = (id: number, updates: Partial<BacklinkWithDetails>) => {
    setBacklinks(prev => prev.map(backlink => 
      backlink.id === id 
        ? { ...backlink, ...updates }
        : backlink
    ));
    
    // TODO: Call API to update backlink
    console.log("Updating backlink:", id, updates);
  };

  const handleBulkUpdate = (ids: number[], updates: Partial<BacklinkWithDetails>) => {
    setBacklinks(prev => prev.map(backlink => 
      ids.includes(backlink.id)
        ? { ...backlink, ...updates }
        : backlink
    ));
    
    // TODO: Call API for bulk update
    console.log("Bulk updating backlinks:", ids, updates);
  };

  const handleBack = () => {
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <ResourceTable 
            backlinks={[]}
            onBacklinkUpdate={handleBacklinkUpdate}
            onBulkUpdate={handleBulkUpdate}
            isLoading={true}
          />
        </div>
      </div>
    );
  }

  if (!website) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">❌</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Website not found</h3>
            <p className="text-gray-600 mb-4">
              The website you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <button 
              onClick={handleBack}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to websites
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        selectedWebsite={website}
        onBack={handleBack}
        showStats={true}
      />
      
      <div className="container mx-auto px-4 py-8">
        <ResourceTable 
          backlinks={backlinks}
          onBacklinkUpdate={handleBacklinkUpdate}
          onBulkUpdate={handleBulkUpdate}
          isLoading={false}
        />
      </div>
    </div>
  );
} 