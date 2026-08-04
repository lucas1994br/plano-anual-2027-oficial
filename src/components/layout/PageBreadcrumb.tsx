import { ArrowLeft, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface BreadcrumbItem {
  label: string;
  /** If provided, clicking this item navigates/calls onBack. */
  onClick?: () => void;
  /** Display as a colored chip (secondary style). If false/undefined, renders as plain badge. */
  isActive?: boolean;
}

interface PageBreadcrumbProps {
  onBack?: () => void;
  onHome?: () => void;
  /** Breadcrumb trail shown after Voltar and Página inicial buttons. */
  crumbs?: BreadcrumbItem[];
  /** Extra actions rendered on the right side (e.g. send button, status badge). */
  rightContent?: React.ReactNode;
}

/**
 * Standardized top bar used across every page.
 *
 * Layout (matching the design in the screenshot):
 *  ← Voltar  🏠 Página inicial  │  [crumb1]  ›  [crumb2]  ›  ...  │  [rightContent]
 */
export function PageBreadcrumb({
  onBack,
  onHome,
  crumbs = [],
  rightContent,
}: PageBreadcrumbProps) {
  return (
    <div className="px-4 sm:px-6 py-2.5 bg-card border-b shadow-sm sticky top-0 z-30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left side: navigation + crumbs */}
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-sm font-medium hover:bg-accent/60 shrink-0 px-2"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar</span>
            </Button>
          )}

          {onHome && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-sm font-medium hover:bg-accent/60 shrink-0 px-2"
              onClick={onHome}
            >
              <Home className="h-4 w-4" />
              <span>Página inicial</span>
            </Button>
          )}

          {crumbs.length > 0 && (onBack || onHome) && (
            <span className="text-muted-foreground/40 select-none mx-1">|</span>
          )}

          {crumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-1">
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              )}
              {crumb.isActive ? (
                <Badge
                  variant="secondary"
                  className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-default select-none px-2.5 py-0.5"
                  onClick={crumb.onClick}
                  style={crumb.onClick ? { cursor: "pointer" } : undefined}
                >
                  {crumb.label}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs select-none px-2.5 py-0.5"
                  onClick={crumb.onClick}
                  style={crumb.onClick ? { cursor: "pointer" } : undefined}
                >
                  {crumb.label}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Right side: optional extra content */}
        {rightContent && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">{rightContent}</div>
        )}
      </div>
    </div>
  );
}
