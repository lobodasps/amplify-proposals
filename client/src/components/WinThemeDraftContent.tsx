import React from "react";
import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getWinThemeDraftDisplay } from "@/lib/winThemeDraft";

export function WinThemeDraftContent({ content }: { content: string | null | undefined }) {
  const display = getWinThemeDraftDisplay(content);

  if (display.kind === "recovery") {
    return (
      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/70 dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">Win Themes formatting needs review</p>
        <p className="mt-1 text-amber-800/80 dark:text-amber-200/70">
          This legacy structured result cannot be displayed as theme cards. Select Edit to review and repair the saved content; the raw payload is intentionally hidden from the proposal draft.
        </p>
      </div>
    );
  }

  if (display.kind !== "cards") return null;

  return (
    <div className="space-y-4">
      {display.data.winThemes.map((theme, index) => (
        <div key={theme.themeId ?? index} className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-snug">{theme.title.replace(/\*\*/g, "")}</h3>
              {theme.themeId && <span className="text-[10px] text-muted-foreground font-mono">{theme.themeId}</span>}
            </div>
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          </div>
          <div className="space-y-2 pl-10">
            <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Statement</p><p className="text-sm leading-relaxed">{theme.statement}</p></div>
            {theme.rationale && <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Rationale</p><p className="text-sm text-muted-foreground leading-relaxed">{theme.rationale}</p></div>}
            {theme.proof && <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Proof Point</p><p className="text-sm text-muted-foreground leading-relaxed">{theme.proof}</p></div>}
            {theme.applicableSections && theme.applicableSections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {theme.applicableSections.map((section) => <Badge key={section} variant="secondary" className="text-[10px] px-2 py-0">{section}</Badge>)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
