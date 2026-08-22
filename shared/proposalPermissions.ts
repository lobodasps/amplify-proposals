export const PROPOSAL_PERMISSION_KEYS = [
  "proposalsSettingsAdmin",
  "qbSyncAdmin",
  "proposalsReportsView",
  "complianceView",
  "contractAnalyzerView",
  "pursuitsProposalsView",
  "bdView",
  "rfpIntelligenceView",
  "firmRecordView",
  "firmRecordEdit",
  "contractsView",
  "contractsEdit",
] as const;

export type ProposalPermissionKey = (typeof PROPOSAL_PERMISSION_KEYS)[number];

export type ProposalPermissions = Record<ProposalPermissionKey, boolean>;

export const EMPTY_PROPOSAL_PERMISSIONS: ProposalPermissions = Object.fromEntries(
  PROPOSAL_PERMISSION_KEYS.map((key) => [key, false]),
) as ProposalPermissions;

export const NAV_PERMISSION_BY_PATH: Record<string, ProposalPermissionKey> = {
  "/dashboard": "pursuitsProposalsView",
  "/pipeline": "pursuitsProposalsView",
  "/opportunities": "bdView",
  "/proposals": "pursuitsProposalsView",
  "/launch": "pursuitsProposalsView",
  "/rfp-wiki": "rfpIntelligenceView",
  "/knowledge-hub": "firmRecordView",
  "/projects": "firmRecordView",
  "/staff": "firmRecordView",
  "/compliance": "complianceView",
  "/contracts": "contractsView",
  "/contract-analyzer": "contractAnalyzerView",
  "/reports": "proposalsReportsView",
  "/settings": "proposalsSettingsAdmin",
};
