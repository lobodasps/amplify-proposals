import { useEntityContext } from "@/contexts/EntityContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, Check } from "lucide-react";

const BADGE_COLORS: Record<string, string> = {
  blue: "bg-blue-600",
  emerald: "bg-emerald-600",
  violet: "bg-violet-600",
  amber: "bg-amber-600",
  rose: "bg-rose-600",
  slate: "bg-slate-600",
};

function EntityBadge({ entity, size = "md" }: { entity: { name: string; shortName?: string | null; badgeColor?: string | null } | null; size?: "sm" | "md" }) {
  if (!entity) {
    return (
      <div className={`${size === "sm" ? "h-5 w-5" : "h-7 w-7"} rounded bg-muted flex items-center justify-center`}>
        <Building2 className={`${size === "sm" ? "h-3 w-3" : "h-4 w-4"} text-muted-foreground`} />
      </div>
    );
  }

  const colorClass = BADGE_COLORS[entity.badgeColor ?? "slate"] ?? "bg-slate-600";
  const label = entity.shortName || entity.name.slice(0, 4).toUpperCase();

  return (
    <div className={`${size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-7 px-2 text-xs"} ${colorClass} rounded flex items-center justify-center text-white font-bold`}>
      {label}
    </div>
  );
}

export function EntitySwitcher() {
  const { activeEntity, setActiveEntityId, allowedEntities, hasMultipleEntities } = useEntityContext();

  if (allowedEntities.length === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  if (!hasMultipleEntities) {
    return (
      <div className="flex items-center gap-2">
        <EntityBadge entity={activeEntity} />
        {activeEntity?.shortName && (
          <span className="text-sm font-semibold text-foreground hidden sm:inline">
            {activeEntity.shortName}
          </span>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-2 py-1 hover:bg-accent">
          <EntityBadge entity={activeEntity} />
          {activeEntity?.shortName && (
            <span className="text-sm font-semibold hidden sm:inline">
              {activeEntity.shortName}
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Switch Entity
        </div>
        <DropdownMenuSeparator />
        {allowedEntities.map(entity => (
          <DropdownMenuItem
            key={entity.id}
            onClick={() => setActiveEntityId(entity.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <EntityBadge entity={entity} size="sm" />
            <span className="flex-1 truncate">{entity.shortName || entity.name}</span>
            {entity.id === activeEntity?.id && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
