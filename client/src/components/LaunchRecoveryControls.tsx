import React, { useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getGoNoGoActionLabel } from "@/lib/launchRecoveryUi";

interface LaunchRecoveryControlsProps {
  hasSession: boolean;
  canRun: boolean;
  isScoring: boolean;
  hasSavedResult: boolean;
  isCurrentResult: boolean;
  isStaleResult: boolean;
  onStartOver: () => void;
  onRunGoNoGo: () => void;
  onReextract: () => void;
}

export function LaunchRecoveryControls({
  hasSession,
  canRun,
  isScoring,
  hasSavedResult,
  isCurrentResult,
  isStaleResult,
  onStartOver,
  onRunGoNoGo,
  onReextract,
}: LaunchRecoveryControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const label = getGoNoGoActionLabel({ hasResult: hasSavedResult, isCurrent: isCurrentResult, isStale: isStaleResult });
  return (
    <div className="space-y-3">
      {isStaleResult && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Saved Go/No-Go result is out of date</p>
            <p className="mt-0.5 text-xs">You changed the review details. Re-run only Go/No-Go; source documents will not be processed again.</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onStartOver} className="text-muted-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Start Over
          </Button>
          {hasSession && (
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} className="text-muted-foreground">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Re-extract package
            </Button>
          )}
        </div>
        <Button size="lg" onClick={onRunGoNoGo} disabled={!canRun || isScoring} className="gap-2">
          {isScoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          {label}
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-extract the saved RFP package?</AlertDialogTitle>
            <AlertDialogDescription>
              This is the only recovery action that reruns document extraction and may use additional model tokens. Uploaded files are preserved and will not be uploaded again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onReextract}>Re-extract package</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
