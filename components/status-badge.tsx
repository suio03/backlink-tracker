import { Badge } from "@/components/ui/badge";
import { BacklinkStatus } from "@/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: BacklinkStatus;
  className?: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    variant: "secondary" as const,
    className: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  },
  requested: {
    label: "Requested", 
    variant: "default" as const,
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  },
  placed: {
    label: "Placed",
    variant: "default" as const, 
    className: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  },
  live: {
    label: "Live",
    variant: "default" as const,
    className: "bg-green-100 text-green-800 hover:bg-green-200",
  },
  removed: {
    label: "Removed",
    variant: "destructive" as const,
    className: "bg-red-100 text-red-800 hover:bg-red-200",
  },
  rejected: {
    label: "Rejected", 
    variant: "destructive" as const,
    className: "bg-red-100 text-red-800 hover:bg-red-200",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
} 