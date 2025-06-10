"use client";

import { useRouter } from "next/navigation";
import { WebsiteGrid } from "@/components/website-grid";
import { Navigation } from "@/components/navigation";
import { WebsiteWithStats } from "@/types";

// Mock data for development - will be replaced with real API calls
const mockWebsites: WebsiteWithStats[] = [
  {
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
  },
  {
    id: 2,
    domain: "smartautomation.io",
    name: "Smart Automation Hub",
    category: "ai-automation",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-20T00:00:00Z",
    is_active: true,
    totalOpportunities: 50,
    liveBacklinks: 8,
    pendingBacklinks: 30,
    requestedBacklinks: 7,
    rejectedBacklinks: 5,
    completionRate: 16,
    lastActivity: "2024-01-20T00:00:00Z",
  },
  {
    id: 3,
    domain: "nlpworkshop.net",
    name: "NLP Workshop",
    category: "ai-nlp",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-25T00:00:00Z",
    is_active: true,
    totalOpportunities: 50,
    liveBacklinks: 15,
    pendingBacklinks: 20,
    requestedBacklinks: 10,
    rejectedBacklinks: 5,
    completionRate: 30,
    lastActivity: "2024-01-25T00:00:00Z",
  },
  {
    id: 4,
    domain: "computervisionsuite.co",
    name: "Computer Vision Suite",
    category: "ai-vision",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-30T00:00:00Z",
    is_active: true,
    totalOpportunities: 50,
    liveBacklinks: 6,
    pendingBacklinks: 35,
    requestedBacklinks: 4,
    rejectedBacklinks: 5,
    completionRate: 12,
    lastActivity: "2024-01-30T00:00:00Z",
  },
  {
    id: 5,
    domain: "aiwritingassistants.org",
    name: "AI Writing Assistants",
    category: "ai-writing",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-02-01T00:00:00Z",
    is_active: true,
    totalOpportunities: 50,
    liveBacklinks: 20,
    pendingBacklinks: 15,
    requestedBacklinks: 12,
    rejectedBacklinks: 3,
    completionRate: 40,
    lastActivity: "2024-02-01T00:00:00Z",
  },
];

export default function Home() {
  const router = useRouter();
  
  const handleWebsiteSelect = (website: WebsiteWithStats) => {
    console.log("Selected website:", website.domain);
    // Navigate to resource management page
    router.push(`/website/${website.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <WebsiteGrid 
          websites={mockWebsites}
          onWebsiteSelect={handleWebsiteSelect}
        />
      </div>
    </div>
  );
}
