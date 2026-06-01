/**
 * client/src/lib/quickSignal.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure client-side Quick Signal scoring logic.
 * No API calls — all computation is done from Pass 2 classification results
 * and the firm profile loaded from firm_settings.
 */

import type {
  QuickSignals,
  FirmProfile,
  SignalFactor,
  SignalRating,
  QuickSignalScore,
  QuickSignalStrength,
} from "../../../shared/types";

// ─── Value parsing helpers ────────────────────────────────────────────────────

/** Parse a dollar-value string like "$250,000", "250K", "1.2M" into a number. */
function parseValueString(s: string | null): number | null {
  if (!s) return null;
  const clean = s.replace(/[$,\s]/g, "").toUpperCase();
  const mMatch = clean.match(/^([\d.]+)M$/);
  if (mMatch) return parseFloat(mMatch[1]) * 1_000_000;
  const kMatch = clean.match(/^([\d.]+)K$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1_000;
  const plain = parseFloat(clean.replace(/[^0-9.]/g, ""));
  return isNaN(plain) ? null : plain;
}

/** Parse an ISO date string (YYYY-MM-DD) into days from today. */
function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Factor scorers ───────────────────────────────────────────────────────────

function scoreAgency(agency: string | null, profile: FirmProfile): SignalFactor {
  if (!agency) {
    return { label: "Agency", rating: "neutral", detail: "Agency not identified" };
  }
  const agencyLower = agency.toLowerCase();
  const isPreferred = profile.preferredAgencies.some(
    (a) => agencyLower.includes(a.toLowerCase()) || a.toLowerCase().includes(agencyLower)
  );
  const isAvoided = profile.avoidedAgencies.some(
    (a) => agencyLower.includes(a.toLowerCase()) || a.toLowerCase().includes(agencyLower)
  );
  if (isAvoided) {
    return { label: "Agency", rating: "unfavorable", detail: `${agency} is on the avoid list` };
  }
  if (isPreferred) {
    return { label: "Agency", rating: "favorable", detail: `${agency} is a preferred agency` };
  }
  return { label: "Agency", rating: "neutral", detail: `${agency} — no existing relationship on record` };
}

function scoreProjectType(projectType: string | null, profile: FirmProfile): SignalFactor {
  if (!projectType) {
    return { label: "Project Type", rating: "neutral", detail: "Project type not identified" };
  }
  const typeLower = projectType.toLowerCase();
  const match = profile.serviceLines.some((sl) => {
    const slLower = sl.toLowerCase();
    return typeLower.includes(slLower) || slLower.includes(typeLower) ||
      // keyword overlap check
      sl.split(/[\s_/]+/).some((word) => word.length > 3 && typeLower.includes(word.toLowerCase()));
  });
  if (match) {
    return { label: "Project Type", rating: "favorable", detail: `${projectType} matches firm service lines` };
  }
  return { label: "Project Type", rating: "unfavorable", detail: `${projectType} may not match firm capabilities` };
}

function scoreValue(estimatedValue: string | null, profile: FirmProfile): SignalFactor {
  const value = parseValueString(estimatedValue);
  if (value === null || (!profile.typicalValueMin && !profile.typicalValueMax)) {
    return { label: "Contract Value", rating: "neutral", detail: estimatedValue ? `${estimatedValue} — firm value range not configured` : "Contract value not identified" };
  }
  const min = profile.typicalValueMin ?? 0;
  const max = profile.typicalValueMax ?? Infinity;
  const tolerance = (max - min) * 0.5; // 50% tolerance band for "close"

  if (value >= min && value <= max) {
    return { label: "Contract Value", rating: "favorable", detail: `${estimatedValue} is within typical range` };
  }
  if (value >= min - tolerance && value <= max + tolerance) {
    return { label: "Contract Value", rating: "neutral", detail: `${estimatedValue} is outside typical range but close` };
  }
  return { label: "Contract Value", rating: "unfavorable", detail: `${estimatedValue} is well outside typical range` };
}

function scoreDueDate(dueDate: string | null, profile: FirmProfile): SignalFactor {
  const days = daysFromToday(dueDate);
  const minDays = profile.minDaysToRespond ?? 14;
  if (days === null) {
    return { label: "Due Date", rating: "neutral", detail: "Due date not identified" };
  }
  if (days < 0) {
    return { label: "Due Date", rating: "unfavorable", detail: "Due date has already passed" };
  }
  if (days >= 21) {
    return { label: "Due Date", rating: "favorable", detail: `${days} days remaining — sufficient time` };
  }
  if (days >= minDays) {
    return { label: "Due Date", rating: "neutral", detail: `${days} days remaining — tight but feasible` };
  }
  return { label: "Due Date", rating: "unfavorable", detail: `Only ${days} days remaining — less than minimum ${minDays} days` };
}

function scoreLocation(location: string | null, profile: FirmProfile): SignalFactor {
  if (!location) {
    return { label: "Location", rating: "neutral", detail: "Location not identified" };
  }
  const locLower = location.toLowerCase();
  const inState = profile.states.some((s) => {
    const sLower = s.toLowerCase();
    return locLower.includes(sLower) || sLower.includes(locLower);
  });
  if (inState) {
    return { label: "Location", rating: "favorable", detail: `${location} — firm is registered/licensed here` };
  }
  return { label: "Location", rating: "unfavorable", detail: `${location} — firm may not be registered here` };
}

function scoreRedFlags(immediateRedFlags: string[]): SignalFactor {
  if (!immediateRedFlags || immediateRedFlags.length === 0) {
    return { label: "Red Flags", rating: "favorable", detail: "No immediate disqualifiers detected" };
  }
  return {
    label: "Red Flags",
    rating: "unfavorable",
    detail: `${immediateRedFlags.length} red flag${immediateRedFlags.length > 1 ? "s" : ""} detected`,
  };
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function computeQuickSignal(
  signals: QuickSignals,
  profile: FirmProfile
): QuickSignalScore {
  const factors: SignalFactor[] = [
    scoreAgency(signals.agency, profile),
    scoreProjectType(signals.projectType, profile),
    scoreValue(signals.estimatedValue, profile),
    scoreDueDate(signals.dueDate, profile),
    scoreLocation(signals.location, profile),
    scoreRedFlags(signals.immediateRedFlags),
  ];

  const favorableCount = factors.filter((f) => f.rating === "favorable").length;

  let strength: QuickSignalStrength;
  if (favorableCount >= 5) strength = "strong";
  else if (favorableCount >= 3) strength = "mixed";
  else strength = "weak";

  return { strength, favorableCount, factors };
}

export const SIGNAL_STRENGTH_CONFIG: Record<
  QuickSignalStrength,
  { icon: string; label: string; subtitle: string; badgeClass: string; borderClass: string }
> = {
  strong: {
    icon: "🟢",
    label: "Strong Signal",
    subtitle: "Proceed to full analysis",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    borderClass: "border-emerald-300",
  },
  mixed: {
    icon: "🟡",
    label: "Mixed Signal",
    subtitle: "Review before committing resources",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    borderClass: "border-amber-300",
  },
  weak: {
    icon: "🔴",
    label: "Weak Signal",
    subtitle: "Likely No-Go — consider archiving",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    borderClass: "border-red-300",
  },
};

export const SIGNAL_RATING_CONFIG: Record<
  SignalRating,
  { icon: string; className: string }
> = {
  favorable:   { icon: "✅", className: "text-emerald-600" },
  neutral:     { icon: "➖", className: "text-gray-500" },
  unfavorable: { icon: "❌", className: "text-red-500" },
};
