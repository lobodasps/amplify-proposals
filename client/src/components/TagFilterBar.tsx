import { Search, X, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagBadge, type TagDef } from "./TagBadge";
import { cn } from "@/lib/utils";

const ASSET_TYPES = [
  { value: "all", label: "All Types" },
  { value: "image", label: "Images" },
  { value: "document", label: "Documents" },
  { value: "presentation", label: "Presentations" },
  { value: "spreadsheet", label: "Spreadsheets" },
  { value: "video", label: "Video" },
  { value: "other", label: "Other" },
];

interface TagFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  assetType: string;
  onAssetTypeChange: (v: string) => void;
  allTags: TagDef[];
  selectedTagIds: number[];
  onTagToggle: (id: number) => void;
  onClearAll: () => void;
}

export function TagFilterBar({
  search, onSearchChange,
  assetType, onAssetTypeChange,
  allTags, selectedTagIds, onTagToggle, onClearAll,
}: TagFilterBarProps) {
  const hasFilters = search || assetType !== "all" || selectedTagIds.length > 0;

  return (
    <div className="space-y-3">
      {/* Search + Type row */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={assetType} onValueChange={onAssetTypeChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Asset type" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll} className="text-muted-foreground">
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Tag chips row */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
            <Tag className="h-3 w-3" /> Filter by tag:
          </span>
          {allTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              active={selectedTagIds.includes(tag.id)}
              onClick={() => onTagToggle(tag.id)}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Active filter summary */}
      {selectedTagIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing assets tagged with:{" "}
          <span className="font-medium text-foreground">
            {allTags.filter((t) => selectedTagIds.includes(t.id)).map((t) => t.name).join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
