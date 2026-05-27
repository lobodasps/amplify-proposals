import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tag, Plus, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { TagBadge, type TagDef } from "./TagBadge";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
];

interface TagManagerPanelProps {
  allTags: TagDef[];
  onClose: () => void;
}

export function TagManagerPanel({ allTags, onClose }: TagManagerPanelProps) {
  const utils = trpc.useUtils();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const createTag = trpc.assets.createTag.useMutation({
    onSuccess: () => {
      toast.success("Tag created");
      utils.assets.listTags.invalidate();
      setNewName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTag = trpc.assets.deleteTag.useMutation({
    onSuccess: () => {
      toast.success("Tag deleted");
      utils.assets.listTags.invalidate();
      utils.assets.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="h-4 w-4" /> Tag Manager
          </CardTitle>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new tag */}
        <div className="space-y-2">
          <Label className="text-xs">Create New Tag</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  createTag.mutate({ name: newName.trim(), color: newColor });
                }
              }}
            />
            <Button
              size="sm"
              disabled={!newName.trim() || createTag.isPending}
              onClick={() => createTag.mutate({ name: newName.trim(), color: newColor })}
            >
              {createTag.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          {/* Color picker */}
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: newColor === c ? "#000" : "transparent" }}
                onClick={() => setNewColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Existing tags */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Existing Tags</Label>
          {allTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tags yet. Create your first tag above.</p>
          ) : (
            <div className="space-y-1.5">
              {allTags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TagBadge tag={tag} size="sm" />
                    <span className="text-xs text-muted-foreground">{tag.usageCount ?? 0} assets</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteTag.mutate({ id: tag.id })}
                    disabled={deleteTag.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
