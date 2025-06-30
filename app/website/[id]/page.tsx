"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { ResourceTable } from "@/components/resource-table";
import { WebsiteInfoForm } from "@/components/website-info-form";
import { Button } from "@/components/ui/button";
import { Website, BacklinkWithDetails } from "@/types";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function WebsiteResourcesPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [website, setWebsite] = useState<Website | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWebsiteInfo, setShowWebsiteInfo] = useState(true);

  // Load toggle state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('showWebsiteInfo');
    if (saved !== null) {
      setShowWebsiteInfo(JSON.parse(saved));
    }
  }, []);

  // Save toggle state to localStorage when changed
  const handleToggleWebsiteInfo = () => {
    const newValue = !showWebsiteInfo;
    setShowWebsiteInfo(newValue);
    localStorage.setItem('showWebsiteInfo', JSON.stringify(newValue));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const websiteId = parseInt(resolvedParams.id);
        if (isNaN(websiteId)) {
          setError('Invalid website ID');
          return;
        }

        // Fetch website details and backlinks in parallel
        const [websiteResponse, backlinksResponse] = await Promise.all([
          fetch(`/api/websites/${websiteId}`),
          fetch(`/api/websites/${websiteId}/backlinks`)
        ]);

        const websiteResult = await websiteResponse.json();
        const backlinksResult = await backlinksResponse.json();

        if (!websiteResult.success) {
          setError(websiteResult.message || 'Failed to fetch website');
          return;
        }

        if (!backlinksResult.success) {
          setError(backlinksResult.message || 'Failed to fetch backlinks');
          return;
        }

        setWebsite(websiteResult.data);
        setBacklinks(backlinksResult.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to connect to the server');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id]);

  const handleBacklinkUpdate = async (id: number, updates: Partial<BacklinkWithDetails>) => {
    try {
      // Optimistically update UI
      setBacklinks(prev => prev.map(backlink => 
        backlink.id === id 
          ? { ...backlink, ...updates }
          : backlink
      ));

      // Call API to update backlink
      const response = await fetch(`/api/backlinks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (!result.success) {
        // Revert on failure
        setBacklinks(prev => prev.map(backlink => 
          backlink.id === id 
            ? { ...backlink, ...updates }
            : backlink
        ));
        console.error('Failed to update backlink:', result.message);
      }
    } catch (error) {
      console.error('Error updating backlink:', error);
      // Revert on error
      setBacklinks(prev => prev.map(backlink => 
        backlink.id === id 
          ? { ...backlink, ...updates }
          : backlink
      ));
    }
  };

  const handleBulkUpdate = async (ids: number[], updates: Partial<BacklinkWithDetails>) => {
    try {
      // Optimistically update UI
      setBacklinks(prev => prev.map(backlink => 
        ids.includes(backlink.id)
          ? { ...backlink, ...updates }
          : backlink
      ));

      // Call API for each backlink (could be optimized with bulk endpoint)
      const promises = ids.map(id => 
        fetch(`/api/backlinks/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        })
      );

      const responses = await Promise.all(promises);
      const results = await Promise.all(responses.map(r => r.json()));

      const failedUpdates = results.filter(r => !r.success);
      if (failedUpdates.length > 0) {
        console.error('Some bulk updates failed:', failedUpdates);
      }
    } catch (error) {
      console.error('Error in bulk update:', error);
      // Could revert changes here if needed
    }
  };

  const handleBacklinkDelete = (deletedId: number) => {
    // Remove the deleted backlink from the state
    setBacklinks(prev => prev.filter(backlink => backlink.id !== deletedId));
  };

  const handleBack = () => {
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading backlink opportunities...</p>
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
              <p className="text-gray-600 mb-4">{error}</p>
              <button 
                onClick={handleBack}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2"
              >
                ← Back to Websites
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Try Again
              </button>
            </div>
          </div>
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
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header with Toggle Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{website.name}</h1>
            <p className="text-gray-600">{website.domain}</p>
          </div>
          <Button
            onClick={handleToggleWebsiteInfo}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {showWebsiteInfo ? (
              <>
                <PanelRightClose className="h-4 w-4" />
                Hide Info
              </>
            ) : (
              <>
                <PanelRightOpen className="h-4 w-4" />
                Show Info
              </>
            )}
          </Button>
        </div>

        <div className={`grid gap-6 transition-all duration-300 ease-in-out ${
          showWebsiteInfo ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'
        }`}>
          {/* Main Content - Backlinks Table */}
          <div className={`transition-all duration-300 ease-in-out ${
            showWebsiteInfo ? 'lg:col-span-2' : 'col-span-1'
          }`}>
            <ResourceTable 
              backlinks={backlinks}
              onBacklinkUpdate={handleBacklinkUpdate}
              onBulkUpdate={handleBulkUpdate}
              onBacklinkDelete={handleBacklinkDelete}
              isLoading={false}
            />
          </div>
          
          {/* Sidebar - Website Information */}
          <div className={`lg:col-span-1 transition-all duration-300 ease-in-out overflow-hidden ${
            showWebsiteInfo 
              ? 'opacity-100 translate-x-0 max-w-full' 
              : 'opacity-0 translate-x-full max-w-0 lg:hidden'
          }`}>
            <WebsiteInfoForm 
              websiteId={website.id}
              websiteName={website.name}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 