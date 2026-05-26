/**
 * AnnotatedProposalViewer
 *
 * Renders proposal text with inline color-coded highlights for passages
 * that fail to meet RFP evaluation criteria. Each highlighted span shows
 * a hover tooltip with the criterion name, severity, and suggested fix.
 *
 * Severity color coding:
 *   critical   → red    (missing required element)
 *   warning    → amber  (present but weak/vague)
 *   suggestion → blue   (could be stronger)
 */
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, AlertTriangle, Lightbulb, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Annotation {
  exactText: string;
  criterion: string;
  severity: "critical" | "warning" | "suggestion";
  suggestion: string;
}

interface TextSegment {
  text: string;
  annotation: Annotation | null;
  segmentIndex: number;
}

interface AnnotatedProposalViewerProps {
  text: string;
  annotations: Annotation[];
  /** Show the sidebar legend panel (default: true) */
  showLegend?: boolean;
  className?: string;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    bg: "bg-red-100 dark:bg-red-950/40",
    border: "border-b-2 border-red-500",
    hover: "hover:bg-red-200 dark:hover:bg-red-900/60",
    badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-400",
    icon: AlertCircle,
    iconColor: "text-red-500",
    label: "Critical",
    dot: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-100 dark:bg-amber-950/40",
    border: "border-b-2 border-amber-500",
    hover: "hover:bg-amber-200 dark:hover:bg-amber-900/60",
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    label: "Warning",
    dot: "bg-amber-500",
  },
  suggestion: {
    bg: "bg-blue-100 dark:bg-blue-950/40",
    border: "border-b-2 border-blue-400",
    hover: "hover:bg-blue-200 dark:hover:bg-blue-900/60",
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400",
    icon: Lightbulb,
    iconColor: "text-blue-500",
    label: "Suggestion",
    dot: "bg-blue-400",
  },
} as const;

// ─── Text segmentation ────────────────────────────────────────────────────────

/**
 * Splits the proposal text into plain and annotated segments.
 * When multiple annotations overlap the same passage, the first match wins.
 */
function buildSegments(text: string, annotations: Annotation[]): TextSegment[] {
  if (!text || annotations.length === 0) {
    return [{ text, annotation: null, segmentIndex: 0 }];
  }

  // Build a list of (start, end, annotation) ranges, sorted by start position
  type Range = { start: number; end: number; annotation: Annotation };
  const ranges: Range[] = [];

  for (const ann of annotations) {
    if (!ann.exactText || ann.exactText.trim().length < 3) continue;
    // Find the first occurrence of exactText in the full text
    const idx = text.indexOf(ann.exactText);
    if (idx === -1) {
      // Try case-insensitive match as fallback
      const lower = text.toLowerCase();
      const lowerExact = ann.exactText.toLowerCase();
      const fallbackIdx = lower.indexOf(lowerExact);
      if (fallbackIdx !== -1) {
        ranges.push({ start: fallbackIdx, end: fallbackIdx + ann.exactText.length, annotation: ann });
      }
      continue;
    }
    ranges.push({ start: idx, end: idx + ann.exactText.length, annotation: ann });
  }

  // Sort by start position, then by length descending (prefer longer matches)
  ranges.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  // Merge overlapping ranges (first match wins)
  const merged: Range[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue; // overlaps with previous — skip
    merged.push(r);
    cursor = r.end;
  }

  // Build segments
  const segments: TextSegment[] = [];
  let pos = 0;
  let idx = 0;

  for (const r of merged) {
    if (r.start > pos) {
      // Plain text before this annotation
      segments.push({ text: text.slice(pos, r.start), annotation: null, segmentIndex: idx++ });
    }
    segments.push({ text: text.slice(r.start, r.end), annotation: r.annotation, segmentIndex: idx++ });
    pos = r.end;
  }

  // Remaining plain text
  if (pos < text.length) {
    segments.push({ text: text.slice(pos), annotation: null, segmentIndex: idx++ });
  }

  return segments;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipState {
  annotation: Annotation;
  x: number;
  y: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnnotatedProposalViewer({
  text,
  annotations,
  showLegend = true,
  className,
}: AnnotatedProposalViewerProps) {
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  const filteredAnnotations = useMemo(
    () => filterSeverity ? annotations.filter((a) => a.severity === filterSeverity) : annotations,
    [annotations, filterSeverity]
  );

  const segments = useMemo(
    () => buildSegments(text, filteredAnnotations),
    [text, filteredAnnotations]
  );

  const counts = useMemo(() => ({
    critical: annotations.filter((a) => a.severity === "critical").length,
    warning: annotations.filter((a) => a.severity === "warning").length,
    suggestion: annotations.filter((a) => a.severity === "suggestion").length,
  }), [annotations]);

  const handleMouseEnter = (e: React.MouseEvent, ann: Annotation) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setActiveTooltip({
      annotation: ann,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setActiveAnnotation(ann);
  };

  const handleMouseLeave = () => {
    setActiveTooltip(null);
    setActiveAnnotation(null);
  };

  return (
    <div className={cn("flex gap-4", className)}>
      {/* ── Annotated Text Panel ── */}
      <div className="flex-1 min-w-0">
        {/* Filter bar */}
        {annotations.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Filter:</span>
            {(["critical", "warning", "suggestion"] as const).map((sev) => {
              const cfg = SEVERITY_CONFIG[sev];
              const count = counts[sev];
              if (count === 0) return null;
              return (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    filterSeverity === sev
                      ? cfg.badge + " ring-2 ring-offset-1 ring-current"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                  {cfg.label} ({count})
                </button>
              );
            })}
            {filterSeverity && (
              <button
                onClick={() => setFilterSeverity(null)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}

        {/* Proposal text with inline highlights */}
        <div className="relative rounded-lg border border-border bg-card p-5 text-sm leading-relaxed font-sans whitespace-pre-wrap">
          {segments.map((seg) => {
            if (!seg.annotation) {
              return <span key={seg.segmentIndex}>{seg.text}</span>;
            }
            const sev = (seg.annotation.severity as keyof typeof SEVERITY_CONFIG) in SEVERITY_CONFIG
              ? (seg.annotation.severity as keyof typeof SEVERITY_CONFIG)
              : "suggestion";
            const cfg = SEVERITY_CONFIG[sev];
            const isActive = activeAnnotation === seg.annotation;
            return (
              <span
                key={seg.segmentIndex}
                className={cn(
                  "relative cursor-pointer rounded-sm px-0.5 transition-colors duration-100",
                  cfg.bg,
                  cfg.border,
                  cfg.hover,
                  isActive && "ring-2 ring-offset-1 ring-current"
                )}
                onMouseEnter={(e) => handleMouseEnter(e, seg.annotation!)}
                onMouseLeave={handleMouseLeave}
              >
                {seg.text}
              </span>
            );
          })}
        </div>

        {/* Floating tooltip */}
        {activeTooltip && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: Math.min(activeTooltip.x, window.innerWidth - 320),
              top: activeTooltip.y - 8,
              transform: "translate(-50%, -100%)",
              maxWidth: "300px",
            }}
          >
            <div className="bg-popover border border-border rounded-lg shadow-xl p-3 text-xs">
              {(() => {
                const sev = (activeTooltip.annotation.severity as keyof typeof SEVERITY_CONFIG) in SEVERITY_CONFIG
                  ? (activeTooltip.annotation.severity as keyof typeof SEVERITY_CONFIG)
                  : "suggestion";
                const cfg = SEVERITY_CONFIG[sev];
                const Icon = cfg.icon;
                return (
                  <>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", cfg.iconColor)} />
                      <span className={cn("font-semibold text-[11px] px-1.5 py-0.5 rounded border", cfg.badge)}>
                        {cfg.label}
                      </span>
                      <span className="text-muted-foreground font-medium truncate">
                        {activeTooltip.annotation.criterion}
                      </span>
                    </div>
                    <p className="text-foreground leading-snug">
                      {activeTooltip.annotation.suggestion}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend / Annotation List ── */}
      {showLegend && annotations.length > 0 && (
        <div className="w-64 flex-shrink-0">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-2 mb-3 text-[11px]">
              {(["critical", "warning", "suggestion"] as const).map((sev) => {
                const cfg = SEVERITY_CONFIG[sev];
                const count = counts[sev];
                if (count === 0) return null;
                return (
                  <span key={sev} className={cn("px-1.5 py-0.5 rounded border font-medium", cfg.badge)}>
                    {count} {cfg.label.toLowerCase()}
                  </span>
                );
              })}
            </div>
            <Separator className="mb-3" />
            <ScrollArea className="h-[420px]">
              <div className="space-y-3 pr-1">
                {annotations.map((ann, i) => {
                  const sev = (ann.severity as keyof typeof SEVERITY_CONFIG) in SEVERITY_CONFIG
                    ? (ann.severity as keyof typeof SEVERITY_CONFIG)
                    : "suggestion";
                  const cfg = SEVERITY_CONFIG[sev];
                  const Icon = cfg.icon;
                  const isActive = activeAnnotation === ann;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-md p-2.5 border cursor-pointer transition-all",
                        isActive
                          ? "border-current ring-1 ring-current " + cfg.bg
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/40"
                      )}
                      onMouseEnter={() => setActiveAnnotation(ann)}
                      onMouseLeave={() => setActiveAnnotation(null)}
                    >
                      <div className="flex items-start gap-1.5 mb-1">
                        <Icon className={cn("w-3 h-3 flex-shrink-0 mt-0.5", cfg.iconColor)} />
                        <div className="min-w-0">
                          <span className={cn("text-[10px] font-semibold px-1 py-0.5 rounded border", cfg.badge)}>
                            {cfg.label}
                          </span>
                          <span className="ml-1.5 text-[11px] text-muted-foreground font-medium">
                            {ann.criterion}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground italic truncate mb-1">
                        "{ann.exactText.slice(0, 60)}{ann.exactText.length > 60 ? "…" : ""}"
                      </p>
                      <p className="text-[11px] text-foreground leading-snug">
                        {ann.suggestion}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
