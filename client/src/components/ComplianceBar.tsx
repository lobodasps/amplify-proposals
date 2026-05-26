import { CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ComplianceStatus = "ok" | "missing" | "na" | "expiring";

interface ComplianceItemProps {
  label: string;
  status: ComplianceStatus;
  expirationDate?: Date | string | null;
}

function ComplianceItem({ label, status, expirationDate }: ComplianceItemProps) {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  // Check if expiring soon
  let effectiveStatus = status;
  if (status === "ok" && expirationDate) {
    const expDate = new Date(expirationDate);
    if (expDate < now) effectiveStatus = "missing";
    else if (expDate <= thirtyDays) effectiveStatus = "expiring";
  }

  const config: Record<ComplianceStatus, { icon: React.ReactNode; color: string; label: string }> = {
    ok: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: "text-green-600 bg-green-50 border-green-200",
      label: "OK",
    },
    missing: {
      icon: <XCircle className="h-4 w-4" />,
      color: "text-red-600 bg-red-50 border-red-200",
      label: "Missing",
    },
    expiring: {
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      label: "Expiring Soon",
    },
    na: {
      icon: <MinusCircle className="h-4 w-4" />,
      color: "text-muted-foreground bg-muted border-border",
      label: "N/A",
    },
  };

  const { icon, color, label: statusLabel } = config[effectiveStatus];

  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2", color)}>
      {icon}
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{label}</p>
        <p className="text-xs opacity-75">
          {statusLabel}
          {expirationDate && effectiveStatus !== "na" && (
            <> · {new Date(expirationDate).toLocaleDateString()}</>
          )}
        </p>
      </div>
    </div>
  );
}

interface ComplianceBarProps {
  contract: {
    hasSignedContract?: boolean | null;
    fullyExecutedContractReceived?: boolean | null;
    hasCOI?: boolean | null;
    coiRequired?: boolean | null;
    coiReceived?: boolean | null;
    coiExpirationDate?: Date | string | null;
    primeAgreementOnFile?: boolean | null;
    performingCompanyName?: string | null;
    endDate?: Date | string | null;
  };
}

export function ComplianceBar({ contract }: ComplianceBarProps) {
  const executedStatus: ComplianceStatus =
    contract.hasSignedContract || contract.fullyExecutedContractReceived ? "ok" : "missing";

  const coiStatus: ComplianceStatus =
    contract.coiRequired
      ? contract.coiReceived || contract.hasCOI ? "ok" : "missing"
      : "na";

  // Determine if subconsultant — use performingCompanyName as proxy or check role
  const isSubconsultant = false; // Will be enhanced when companyRole field is available
  const primeStatus: ComplianceStatus = isSubconsultant
    ? contract.primeAgreementOnFile ? "ok" : "missing"
    : "na";

  const endDateStatus: ComplianceStatus = contract.endDate ? "ok" : "na";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <ComplianceItem label="Executed Contract" status={executedStatus} />
      <ComplianceItem
        label="Certificate of Insurance"
        status={coiStatus}
        expirationDate={contract.coiExpirationDate}
      />
      <ComplianceItem label="Prime Agreement" status={primeStatus} />
      <ComplianceItem
        label="Contract End Date"
        status={endDateStatus}
        expirationDate={contract.endDate}
      />
    </div>
  );
}
