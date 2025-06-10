import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { WebsiteWithStats } from "@/types";
import { cn } from "@/lib/utils";

interface WebsiteCardProps {
  website: WebsiteWithStats;
  onClick?: () => void;
  className?: string;
}

export function WebsiteCard({ website, onClick, className }: WebsiteCardProps) {
  const completionRate = Math.round(website.completionRate || 0);
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {website.name}
            </CardTitle>
            <p className="text-sm text-gray-600 font-mono">
              {website.domain}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {website.category}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-semibold text-gray-900">
              {completionRate}%
            </span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-gray-600">Live Links</p>
            <p className="text-xl font-bold text-green-600">
              {website.liveBacklinks}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-600">Total Opportunities</p>
            <p className="text-xl font-bold text-gray-900">
              {website.totalOpportunities}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-600">Pending</p>
            <p className="text-lg font-semibold text-yellow-600">
              {website.pendingBacklinks}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-600">Requested</p>
            <p className="text-lg font-semibold text-blue-600">
              {website.requestedBacklinks}
            </p>
          </div>
        </div>
        
        {/* Last Activity */}
        {website.lastActivity && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Last activity: {new Date(website.lastActivity).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 