import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  type?: "ambulance" | "emergency" | "availability";
}

export const StatusBadge = ({ status, type = "ambulance" }: StatusBadgeProps) => {
  const getVariant = () => {
    if (type === "ambulance") {
      switch (status) {
        case "available":
          return "default";
        case "busy":
          return "secondary";
        case "offline":
          return "outline";
        default:
          return "outline";
      }
    }
    
    if (type === "emergency") {
      switch (status) {
        case "reported":
          return "destructive";
        case "dispatched":
          return "default";
        case "en_route":
          return "default";
        case "arrived":
          return "secondary";
        case "completed":
          return "outline";
        default:
          return "outline";
      }
    }
    
    return "default";
  };

  const getColorClass = () => {
    if (type === "ambulance") {
      switch (status) {
        case "available":
          return "bg-success text-success-foreground";
        case "busy":
          return "bg-warning text-warning-foreground";
        case "offline":
          return "bg-muted text-muted-foreground";
        default:
          return "";
      }
    }
    
    if (type === "emergency") {
      switch (status) {
        case "reported":
          return "bg-destructive text-destructive-foreground";
        case "dispatched":
          return "bg-primary text-primary-foreground";
        case "en_route":
          return "bg-primary text-primary-foreground";
        case "arrived":
          return "bg-warning text-warning-foreground";
        case "completed":
          return "bg-success text-success-foreground";
        default:
          return "";
      }
    }
    
    if (type === "availability") {
      const value = parseInt(status);
      if (value > 50) return "bg-success text-success-foreground";
      if (value > 20) return "bg-warning text-warning-foreground";
      return "bg-destructive text-destructive-foreground";
    }
    
    return "";
  };

  const formatStatus = () => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Badge variant={getVariant()} className={cn(getColorClass(), "font-medium")}>
      {formatStatus()}
    </Badge>
  );
};
