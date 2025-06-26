import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Globe, BarChart3, Settings } from "lucide-react";
import { WebsiteWithStats } from "@/types";
import Link from "next/link";

interface NavigationProps {
  selectedWebsite?: WebsiteWithStats;
  onBack?: () => void;
  showStats?: boolean;
}

export function Navigation({ selectedWebsite, onBack, showStats = true }: NavigationProps) {
  if (!selectedWebsite) {
    // Homepage navigation - just the logo/title with management links
    return (
      <nav className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Globe className="h-6 w-6 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">Backlink Tracker</h1>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                href="/websites"
                className="flex items-center text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                <Globe className="h-4 w-4 mr-2" />
                Manage Websites
              </Link>
              <Link
                href="/resources"
                className="flex items-center text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Resources
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Resource management navigation with breadcrumbs
  const completionRate = Math.round(selectedWebsite.completionRate || 0);
  
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4 py-4">
        {/* Breadcrumb & Back Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {onBack && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBack}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Websites
              </Button>
            )}
            
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-500">Websites</span>
              <span className="text-gray-400">/</span>
              <span className="font-medium text-gray-900">{selectedWebsite.domain}</span>
            </div>
          </div>
          
          <Badge variant="outline" className="text-xs">
            {selectedWebsite.category}
          </Badge>
        </div>
        
        {/* Website Info Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedWebsite.name}
            </h1>
            <p className="text-gray-600 font-mono text-sm">
              {selectedWebsite.domain}
            </p>
          </div>
          
          {showStats && (
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Overall Progress</div>
              <div className="text-2xl font-bold text-gray-900">{completionRate}%</div>
            </div>
          )}
        </div>
        
        {/* Stats Row */}
        {showStats && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-600">Total</span>
              </div>
              <div className="text-xl font-bold text-gray-900 mt-1">
                {selectedWebsite.totalOpportunities}
              </div>
              <div className="text-xs text-gray-500">opportunities</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                <span className="text-sm text-green-700">Live</span>
              </div>
              <div className="text-xl font-bold text-green-900 mt-1">
                {selectedWebsite.liveBacklinks}
              </div>
              <div className="text-xs text-green-600">backlinks</div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-yellow-500 rounded-full" />
                <span className="text-sm text-yellow-700">Pending</span>
              </div>
              <div className="text-xl font-bold text-yellow-900 mt-1">
                {selectedWebsite.pendingBacklinks}
              </div>
              <div className="text-xs text-yellow-600">to work on</div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full" />
                <span className="text-sm text-blue-700">Placed</span>
              </div>
              <div className="text-xl font-bold text-blue-900 mt-1">
                {selectedWebsite.placedBacklinks}
              </div>
              <div className="text-xs text-blue-600">in progress</div>
            </div>
          </div>
        )}
        
        {/* Progress Bar */}
        {showStats && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Progress to completion</span>
              <span>{selectedWebsite.liveBacklinks} of {selectedWebsite.totalOpportunities} live</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>
        )}
      </div>
    </nav>
  );
} 