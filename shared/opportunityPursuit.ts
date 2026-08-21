export interface OpportunityForPursuit {
  id: string;
  title: string;
  rfpNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  serviceLines: unknown;
  estimatedValue: string | null;
  dueDate: Date | null;
  assignedTo: string | null;
}

/** Maps the canonical Business Development opportunity fields into a new Pursuit without losing source linkage. */
export function buildPursuitFromOpportunity(opportunity: OpportunityForPursuit) {
  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    rfpNumber: opportunity.rfpNumber,
    clientId: opportunity.clientId,
    clientName: opportunity.clientName,
    serviceLines: opportunity.serviceLines,
    estimatedValue: opportunity.estimatedValue,
    dueDate: opportunity.dueDate,
    leadId: opportunity.assignedTo,
    status: "identify" as const,
  };
}
