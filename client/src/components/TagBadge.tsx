import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagDef {
  id: number;
  name: string;
  color: string;
  usageCount?: number;
}

interface TagBadgeProps {
  tag: TagDef;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  size?: "sm" | "md";
}

/** Converts a hex color to a low-opacity background for the badge */
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function TagBadge({ tag, onRemove, onClick, active, size = "md" }: TagBadgeProps) {
  const bg = hexToRgba(tag.color ?? "#6366f1", active ? 0.25 : 0.12);
  const border = hexToRgba(tag.color ?? "#6366f1", active ? 0.7 : 0.35);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium transition-all",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        onClick && "cursor-pointer hover:opacity-80",
        active && "ring-1",
      )}
      style={{
        backgroundColor: bg,
        borderColor: border,
        border: `1px solid ${border}`,
        color: tag.color ?? "#6366f1",
      }}
      onClick={onClick}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          className="ml-0.5 rounded-full hover:bg-black/10 transition-colors"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remove tag ${tag.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
