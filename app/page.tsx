"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WebsiteGrid } from "@/components/website-grid";
import { Navigation } from "@/components/navigation";
import { WebsiteWithStats } from "@/types";

export default function Home() {
  const router = useRouter();
  const [websites, setWebsites] = useState<WebsiteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchWebsites() {
      try {
        setLoading(true);
        const response = await fetch('/api/websites');
        const result = await response.json();
        
        if (result.success) {
          setWebsites(result.data);
        } else {
          setError(result.message || 'Failed to fetch websites');
        }
      } catch (err) {
        console.error('Error fetching websites:', err);
        setError('Failed to connect to the server');
      } finally {
        setLoading(false);
      }
    }

    fetchWebsites();
  }, []);
  
  const handleWebsiteSelect = (website: WebsiteWithStats) => {
    console.log("Selected website:", website.domain);
    // Navigate to resource management page
    router.push(`/website/${website.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your websites...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
              <p className="text-gray-600">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <WebsiteGrid 
          websites={websites}
          onWebsiteSelect={handleWebsiteSelect}
        />
      </div>
    </div>
  );
}
